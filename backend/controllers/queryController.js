/**
 * queryController.js
 * Main pipeline orchestrator for Curalink.
 *
 * Pipeline:
 * 1. Parse & validate input
 * 2. Query expansion (compound terms)
 * 3. Parallel retrieval from PubMed + OpenAlex + ClinicalTrials
 * 4. Dedup + TF-IDF re-ranking
 * 5. Context assembly (conversation history)
 * 6. Ollama LLM reasoning
 * 7. Persist to MongoDB
 * 8. Return structured response
 */

const { v4: uuidv4 } = require('uuid');
const { fetchFromPubMed } = require('../services/pubmed');
const { fetchFromOpenAlex } = require('../services/openAlex');
const { fetchFromClinicalTrials } = require('../services/clinicalTrials');
const { rankPublications, rankTrials } = require('../services/ranking');
const { generateMedicalInsights, generateMedicalInsightsStream, expandSearchQuery } = require('../services/llm');
const { fetchWeather } = require('../services/weather');
const Conversation = require('../models/Conversation');

// ---------- Query Expansion ----------

// Removed manual expandQuery in favor of LLM-based expandSearchQuery from llm.js

// ---------- Main Handler ----------

async function handleQuery(req, res) {
  try {
    const {
      patientName = '',
      disease,
      query: rawQuery = '',
      location = '',
      indianFocus = false,
      conversationId: existingConvId,
    } = req.body;

    // Validate required fields
    if (!disease || disease.trim() === '') {
      return res.status(400).json({
        error: 'Missing required field: disease',
      });
    }

    const disease_ = disease.trim();
    const query_ = rawQuery.trim();

    // Determine conversation session
    let conversationId = existingConvId;
    let conversation = null;

    if (conversationId) {
      conversation = await Conversation.findOne({ conversationId });
    }

    if (!conversation) {
      // Start a new conversation session
      conversationId = uuidv4();
      conversation = new Conversation({
        conversationId,
        patientName,
        disease: disease_,
        location,
        indianFocus,
        messages: [],
      });
    }

    // ---- Step 2: Query Expansion ----
    const resolvedIndianFocus = indianFocus || (conversation && conversation.indianFocus);
    const { primary: primaryQuery } = await expandSearchQuery(disease_, query_, resolvedIndianFocus);

    console.log(`[HelpYourself] Query: "${primaryQuery}" | Session: ${conversationId}`);

    // ---- Step 3: Parallel Retrieval ----
    // 50 per source = ~100 publications + 50 trials candidate pool.
    // This balances depth (enough to rank well) against response speed.
    const [pubmedResults, openAlexResults, trialsResults, weatherResult] = await Promise.allSettled([
      fetchFromPubMed(query_, disease_, 50),
      fetchFromOpenAlex(query_, disease_, 60),
      fetchFromClinicalTrials(disease_, query_, 50),
      location ? fetchWeather(location) : Promise.resolve(null)
    ]);

    const rawPubs = [
      ...(pubmedResults.status === 'fulfilled' ? pubmedResults.value : []),
      ...(openAlexResults.status === 'fulfilled' ? openAlexResults.value : []),
    ];

    const rawTrials =
      trialsResults.status === 'fulfilled' ? trialsResults.value : [];
    
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

    console.log(
      `[HelpYourself] Retrieved: ${rawPubs.length} publications, ${rawTrials.length} trials`
    );

    // ---- Step 4: Re-rank ----
    const rankedPubs = await rankPublications(rawPubs, query_, disease_, 8);
    const rankedTrials = await rankTrials(rawTrials, query_, disease_, 8);

    console.log(
      `[Curalink] After ranking: ${rankedPubs.length} pubs, ${rankedTrials.length} trials`
    );

    // ---- Step 5: Context Assembly ----
    const conversationHistory = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // ---- Step 6: LLM Reasoning ----
    const llmResponse = await generateMedicalInsights({
      patientName: patientName || conversation.patientName,
      disease: disease_,
      query: query_,
      location: location || conversation.location,
      publications: rankedPubs,
      trials: rankedTrials,
      weather: weather,
      conversationHistory,
    });

    // ---- Step 7: Persist to MongoDB ----
    // Store user message
    conversation.messages.push({
      role: 'user',
      content: query_ || disease_,
    });

    // Compose assistant response content
    const assistantContent = llmResponse.conditionOverview || `Research on ${disease_}`;

    conversation.messages.push({
      role: 'assistant',
      content: assistantContent,
      sources: [...rankedPubs.slice(0, 6), ...rankedTrials.slice(0, 6)],
    });

    // Update metadata if this is a continuing conversation
    if (!conversation.patientName && patientName) {
      conversation.patientName = patientName;
    }

    await conversation.save();

    // ---- Step 8: Return structured response ----
    return res.json({
      conversationId,
      patientName: conversation.patientName,
      disease: disease_,
      query: query_,
      location: location || conversation.location,
      indianFocus: indianFocus || conversation.indianFocus,
      llmInsights: llmResponse,
      weather: weather,
      publications: rankedPubs.map((p) => ({
        title: p.title,
        abstract: p.abstract,
        authors: p.authors,
        year: p.year,
        source: p.source,
        url: p.url,
        score: Math.round((p._score || 0) * 1000) / 1000,
      })),
      clinicalTrials: rankedTrials.map((t) => ({
        nctId: t.nctId,
        title: t.title,
        summary: t.summary,
        status: t.status,
        phase: t.phase,
        eligibility: t.eligibility,
        locations: t.locations,
        contact: t.contact,
        startDate: t.startDate,
        completionDate: t.completionDate,
        url: t.url,
        source: t.source,
        score: Math.round((t._score || 0) * 1000) / 1000,
      })),
      stats: {
        totalPublicationsRetrieved: rawPubs.length,
        totalTrialsRetrieved: rawTrials.length,
        publicationsShown: rankedPubs.length,
        trialsShown: rankedTrials.length,
      },
    });
  } catch (err) {
    console.error('[Curalink] handleQuery error:', err.message);
    return res.status(500).json({
      error: 'Failed to process query',
      message: err.message,
    });
  }
}

async function handleQueryStream(req, res) {
  try {
    const { patientName = '', disease, query = '', location = '', indianFocus = false, conversationId: existingConvId } = req.body;

    if (!disease || disease.trim() === '') {
      return res.status(400).json({ error: 'Missing required field: disease' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Establish SSE connection immediately

    // Normalize disease to Title Case to prevent "Lung Cancer" and "lung cancer" dupes
    const disease_ = disease
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    
    const query_ = query.trim();

    let conversationId = existingConvId;
    let conversation = null;

    if (conversationId) {
      conversation = await Conversation.findOne({ conversationId });
    }

    if (!conversation) {
      conversationId = uuidv4();
      conversation = new Conversation({
        conversationId,
        patientName,
        disease: disease_,
        location,
        indianFocus,
        messages: [],
      });
    }

    // Write initial connected state so frontend knows to show "searching..."
    res.write('event: status\ndata: {"status": "searching"}\n\n');

    const resolvedIndianFocusStream = indianFocus || (conversation && conversation.indianFocus);
    const { primary: primaryQuery } = await expandSearchQuery(disease_, query_, resolvedIndianFocusStream);

    // 50 per source = ~110 publications + 50 trials candidate pool.
    // This balances depth (enough to rank well) against response speed.
    const [pubmedResults, openAlexResults, trialsResults, weatherResult] = await Promise.allSettled([
      fetchFromPubMed(query_, disease_, 50),
      fetchFromOpenAlex(query_, disease_, 60),
      fetchFromClinicalTrials(disease_, query_, 50),
      location ? fetchWeather(location) : Promise.resolve(null)
    ]);

    const rawPubs = [
      ...(pubmedResults.status === 'fulfilled' ? pubmedResults.value : []),
      ...(openAlexResults.status === 'fulfilled' ? openAlexResults.value : []),
    ];
    const rawTrials = trialsResults.status === 'fulfilled' ? trialsResults.value : [];
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

    const rankedPubs = await rankPublications(rawPubs, query_, disease_, 8);
    const rankedTrials = await rankTrials(rawTrials, query_, disease_, 8);

    const stats = {
      totalPublicationsRetrieved: rawPubs.length,
      totalTrialsRetrieved: rawTrials.length,
      publicationsShown: rankedPubs.length,
      trialsShown: rankedTrials.length,
    };

    // Send the structured data immediately so UI can populate tabs while LLM generates text
    res.write(`event: data\ndata: ${JSON.stringify({ 
      conversationId,
      disease: disease_,
      query: query_,
      publications: rankedPubs,
      clinicalTrials: rankedTrials,
      weather: weather,
      stats
    })}\n\n`);

    const conversationHistory = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // BUG FIX: Correct argument order — llm.js expects (res, config), not (config, res)
    // Also inject missing weather + indianFocus that were previously dropped from the stream pipeline
    const fullLLMText = await generateMedicalInsightsStream(res, {
      patientName: patientName || conversation.patientName,
      disease: disease_,
      query: query_,
      location: location || conversation.location,
      weather: weather,
      indianFocus: resolvedIndianFocusStream,
      publications: rankedPubs,
      trials: rankedTrials,
      conversationHistory,
    });

    // Save to DB — guard against session save errors not crashing the stream
    try {
      conversation.messages.push({ role: 'user', content: query_ || disease_ });
      conversation.messages.push({
        role: 'assistant',
        content: fullLLMText || 'Research complete.',
        sources: [...rankedPubs.slice(0, 6), ...rankedTrials.slice(0, 6)],
      });
      if (!conversation.patientName && patientName) conversation.patientName = patientName;
      if (!conversation.indianFocus && resolvedIndianFocusStream) conversation.indianFocus = true;
      await conversation.save();
    } catch (dbErr) {
      console.error('[HelpYourself] DB save error (non-fatal):', dbErr.message);
    }

    res.write('event: done\ndata: {"status": "complete"}\n\n');
    res.end();

  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed' });
    }
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
}

module.exports = { handleQuery, handleQueryStream };
