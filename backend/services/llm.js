/**
 * llm.js
 * Ollama LLM wrapper for Curalink.
 * Uses llama3.2:3b via local Ollama API.
 *
 * Generates structured, personalized, research-backed medical responses.
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama3-8b-8192'; // extremely fast, reliable Llama 3 model on Groq

/**
 * Build the system prompt that shapes the LLM into a medical research assistant.
 */
function buildSystemPrompt() {
  return `You are HelpYourself, an expert AI Medical Research Assistant. Your role is to analyze medical research publications and clinical trials, then provide structured, evidence-based insights to patients and caregivers.

CRITICAL RULES:
1. NEVER fabricate information. Every claim must reference the provided research.
2. Always recommend consulting a qualified healthcare professional.
3. Be empathetic, clear, and personalized to the patient's context.
4. Structure your response EXACTLY in the JSON format specified.
5. Do not include any text outside the JSON object.

Your response tone should be warm, professional, and evidence-driven — like a knowledgeable medical librarian who deeply cares about the patient.`;
}

/**
 * Build the user prompt with all research context.
 */
function buildUserPrompt({ patientName, disease, query, location, weather, indianFocus, publications, trials, conversationHistory }) {
  const patientContext = [
    patientName && `Patient: ${patientName}`,
    disease && `Condition: ${disease}`,
    query && `Research Query: ${query}`,
    location && `Location: ${location}`,
    indianFocus && `CRITICAL REQUIREMENT: The user has requested EXCLUSIVELY Indian-focused medical help. You MUST tailor all your insights, preventatives, and context explicitly for the Indian medical landscape.`,
    weather && `Current Local Weather: ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.condition}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Summarize top publications for the prompt (keep token count manageable)
  const pubSummaries = publications
    .slice(0, 6)
    .map(
      (p, i) =>
        `[PUB${i + 1}] "${p.title}" (${p.source}, ${p.year})
Authors: ${(p.authors || []).join(', ') || 'N/A'}
Abstract: ${(p.abstract || '').substring(0, 400)}...
URL: ${p.url}`
    )
    .join('\n\n');

  // Summarize top trials
  const trialSummaries = trials
    .slice(0, 6)
    .map(
      (t, i) =>
        `[TRIAL${i + 1}] "${t.title}" (${t.status}, Phase: ${t.phase || 'N/A'})
Summary: ${(t.summary || '').substring(0, 300)}...
Location: ${(t.locations || []).slice(0, 2).join('; ')}
URL: ${t.url}`
    )
    .join('\n\n');

  // Include recent conversation turns for context continuity
  const historyContext =
    conversationHistory.length > 0
      ? `\nPREVIOUS CONVERSATION (use for context continuity):\n${conversationHistory
          .slice(-4)
          .map((m) => `${m.role.toUpperCase()}: ${m.content.substring(0, 200)}`)
          .join('\n')}\n`
      : '';

  return `${historyContext}
PATIENT CONTEXT:
${patientContext}

RESEARCH PUBLICATIONS (${publications.length} retrieved, top shown):
${pubSummaries || 'No publications found.'}

CLINICAL TRIALS (${trials.length} retrieved, top shown):
${trialSummaries || 'No clinical trials found.'}

TASK: Generate a comprehensive, personalized medical research summary for this patient. You MUST respond with ONLY a valid JSON object in this exact structure:

{
  "conditionOverview": "A clear, personalized 2-3 sentence overview of the condition in the context of the patient's query. Mention the patient by name if provided. Be empathetic.",
  "researchInsights": [
    {
      "insight": "Key research finding or insight (1-2 sentences, specific and evidence-based)",
      "supportingPublication": "PUB1" 
    }
  ],
  "clinicalTrialsInsights": [
    {
      "insight": "What this trial offers and why it may be relevant to this patient",
      "trialReference": "TRIAL1"
    }
  ],
  "personalizedRecommendations": "Personalized, research-backed guidance tailored to the patient's specific situation. Include practical next steps.",
  "environmentalPreventativeMeasures": "If weather data is provided in the context, give explicit medical preventatives (e.g. hydration for heat, vector-control for monsoons, etc.) based on the climate. If no weather provided, return empty string.",
  "keyTakeaway": "Single most important takeaway from the research for this patient (1 sentence)"
}

Generate 3-5 research insights and 2-4 clinical trial insights (fewer if trials are unavailable). Be specific, cite the publications using PUB1/TRIAL1 references, and personalize to the patient context.`;
}

/**
 * Call Ollama and get a structured response.
 * Falls back gracefully if JSON parsing fails.
 */
async function generateMedicalInsights({
  patientName,
  disease,
  query,
  location,
  weather,
  indianFocus,
  publications,
  trials,
  conversationHistory = [],
}) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    patientName,
    disease,
    query,
    location,
    weather,
    indianFocus,
    publications,
    trials,
    conversationHistory,
  });

  try {
    const response = await axios.post(
      `${GROQ_API_URL}/chat/completions`,
      {
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        temperature: 0.3,  // Low temp for factual accuracy
        top_p: 0.9,
        response_format: { type: 'json_object' } // Enforce JSON
      },
      { 
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content || '';

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('LLM did not return valid JSON, using fallback structure');
      return buildFallbackResponse(disease, query, publications, trials, rawContent);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      conditionOverview: parsed.conditionOverview || '',
      researchInsights: parsed.researchInsights || [],
      clinicalTrialsInsights: parsed.clinicalTrialsInsights || [],
      personalizedRecommendations: parsed.personalizedRecommendations || '',
      environmentalPreventativeMeasures: parsed.environmentalPreventativeMeasures || '',
      keyTakeaway: parsed.keyTakeaway || '',
      rawLLMResponse: rawContent,
    };
  } catch (err) {
    console.error('Ollama LLM error:', err.message);
    return buildFallbackResponse(disease, query, publications, trials, '');
  }
}

/**
 * Fallback response when LLM fails or returns malformed JSON.
 * Ensures the API always returns a usable structure.
 */
function buildFallbackResponse(disease, query, publications, trials, rawContent) {
  return {
    conditionOverview: `Research summary for ${disease}${query ? ` focused on ${query}` : ''}. The AI engine is assembling evidence-based insights.`,
    researchInsights: publications.length > 0
      ? [{ insight: `Retrieved ${publications.length} peer-reviewed publications. Review the Publications tab for full abstracts.`, supportingPublication: 'PUB1' }]
      : [],
    clinicalTrialsInsights: trials.length > 0
      ? [{ insight: `Found ${trials.length} potentially relevant clinical trials tracking experimental treatments.`, trialReference: 'TRIAL1' }]
      : [],
    personalizedRecommendations: 'Please consult a specialist for rigorous personalized advice based on this curated research.',
    environmentalPreventativeMeasures: '',
    keyTakeaway: 'This is a data-driven fallback response as the AI reasoning engine encountered a formatting hurdle.',
    rawOutput: rawContent
  };
}

/**
 * Use LLM to expand a base query into better keyword searches.
 */
async function expandSearchQuery(disease, rawQuery, indianFocus = false) {
  const prompt = `You are a medical research assistant. The user wants to search medical databases (PubMed, ClinicalTrials.gov) for information.
Disease/Condition: ${disease}
User Query: ${rawQuery}
${indianFocus ? 'Requirement: Must focus on Indian research or demographics.\n' : ''}
Generate 2 highly optimized, distinct search query strings to use in our search engine. 
Make them concise (2-5 words). Do not include quotes or bullet points. Output exactly 2 lines, one for each search query.`;

  try {
    const response = await axios.post(
      `${GROQ_API_URL}/chat/completions`,
      {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 
      }
    );

    const text = response.data?.choices?.[0]?.message?.content || '';
    const lines = text.split('\n').map(l => l.replace(/^- /, '').replace(/^\d+\.\s*/, '').trim()).filter(l => l.length > 0);
    
    return {
      primary: `${disease} ${rawQuery}${indianFocus ? ' India' : ''}`.trim(),
      extras: lines.slice(0, 2)
    };
  } catch (err) {
    console.error('LLM Query Expansion error:', err.message);
    return {
      primary: `${disease} ${rawQuery}${indianFocus ? ' India' : ''}`.trim(),
      extras: [`${disease} treatment${indianFocus ? ' India' : ''}`, `${disease} recent trials${indianFocus ? ' India' : ''}`]
    };
  }
}

/**
 * Call Ollama and stream a Markdown response back to the client via Server-Sent Events (SSE).
 */
async function generateMedicalInsightsStream(
  res,
  { patientName, disease, query, location, weather, indianFocus, publications, trials, conversationHistory = [] }
) {
  const patientContext = [
    patientName && `Patient: ${patientName}`,
    disease && `Condition: ${disease}`,
    query && `Research Query: ${query}`,
    location && `Location: ${location}`,
    indianFocus && `CRITICAL REQUIREMENT: EXCLUSIVELY tailored for the Indian medical context.`,
    weather && `Weather: ${weather.temperature}°C, ${weather.condition}`,
  ].filter(Boolean).join('\n');

  const pubSummaries = publications.slice(0, 6).map((p, i) => `[PUB${i + 1}] "${p.title}"`).join('\n');
  const trialSummaries = trials.slice(0, 6).map((t, i) => `[TRIAL${i + 1}] "${t.title}"`).join('\n');

  const systemPrompt = `You are HelpYourself, an expert AI Medical Research Assistant. Analyze the provided publications and trials to write a structured, deeply personalized research summary. 
Format your output purely in Markdown. Use headings like "### Condition Overview", "### Research Insights", "### Clinical Trials", "### Environmental Health Watch" (if weather data is provided), and "### Personalized Guidance".
Important: Cite the sources exactly as provided (e.g., [PUB1], [TRIAL1]). Be warm and professional. Do NOT generate JSON. Write beautiful Markdown.`;

  const userPrompt = `PATIENT CONTEXT:\n${patientContext}\n\nPUBLICATIONS:\n${pubSummaries}\n\nTRIALS:\n${trialSummaries}\n\nTASK: Write the personalized markdown analysis.`;

  try {
    const response = await axios.post(`${GROQ_API_URL}/chat/completions`, {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      temperature: 0.3
    }, { 
      responseType: 'stream',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let fullContent = '';

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.includes('[DONE]')) continue;
        if (!line.startsWith('data: ')) continue;
        try {
          const jsonStr = line.replace('data: ', '');
          const parsed = JSON.parse(jsonStr);
          const textChunk = parsed.choices?.[0]?.delta?.content || '';
          fullContent += textChunk;
          
          if (textChunk) {
            res.write(`event: chunk\ndata: ${JSON.stringify({ text: textChunk })}\n\n`);
          }
        } catch (e) {
          // Ignore incomplete JSON chunks from edge cases
        }
      }
    });

    return new Promise((resolve) => {
      response.data.on('end', () => resolve(fullContent));
      response.data.on('error', () => resolve(fullContent));
    });

  } catch (err) {
    console.error('LLM Streaming error:', err.message);
    // Build rich structured markdown from actual data so the AI Analysis tab
    // remains useful even when Ollama is unavailable or slow
    const fallback = buildDataDrivenFallback(disease, query, patientName, publications, trials);
    res.write(`event: chunk\ndata: ${JSON.stringify({ text: fallback })}\n\n`);
    return fallback;
  }
}

/**
 * Build a structured markdown summary purely from the retrieved data.
 * Used as fallback when Ollama is unavailable, or as an initial rapid response.
 */
function buildDataDrivenFallback(disease, query, patientName, publications, trials) {
  const greeting = patientName ? `For **${patientName}**, here` : 'Here';
  const topPubs = publications.slice(0, 6);
  const topTrials = trials.slice(0, 6);
  const recruitingTrials = topTrials.filter(t =>
    (t.status || '').toUpperCase().includes('RECRUITING') &&
    !(t.status || '').toUpperCase().includes('NOT YET')
  );

  let md = '';

  md += `### Condition Overview\n\n`;
  md += `${greeting} is a curated research summary on **${disease}**`;
  md += query ? ` focusing on **${query}**` : '';
  md += `. The data below is sourced directly from PubMed, OpenAlex, and ClinicalTrials.gov - `;
  md += `${publications.length} publications and ${trials.length} trials were retrieved and ranked by semantic relevance.\n\n`;

  if (topPubs.length > 0) {
    md += `### Research Insights\n\n`;
    topPubs.slice(0, 5).forEach((p, i) => {
      const abstract = (p.abstract || '').substring(0, 220).trim();
      md += `**[PUB${i + 1}]** **${p.title}** *(${p.source}, ${p.year})*\n`;
      if (abstract) md += `> ${abstract}${abstract.length >= 220 ? '…' : ''}\n`;
      if (p.authors && p.authors.length > 0) {
        md += `*Authors: ${p.authors.slice(0, 3).join(', ')}${p.authors.length > 3 ? ' et al.' : ''}*\n`;
      }
      md += '\n';
    });
  }

  if (topTrials.length > 0) {
    md += `### Clinical Trials\n\n`;
    topTrials.slice(0, 4).forEach((t, i) => {
      const statusText = (t.status || '').toUpperCase().includes('RECRUITING') ? '[Recruiting]' : '[Active]';
      md += `**[TRIAL${i + 1}]** ${statusText} **${t.title}**\n`;
      md += `- **Status:** ${t.status || 'Unknown'} · **Phase:** ${t.phase || 'N/A'}\n`;
      if (t.locations && t.locations[0] !== 'Location not specified') {
        md += `- **Location:** ${t.locations.slice(0, 2).join(', ')}\n`;
      }
      const summary = (t.summary || '').substring(0, 180).trim();
      if (summary) md += `- ${summary}${summary.length >= 180 ? '…' : ''}\n`;
      md += '\n';
    });
  }

  md += `### Recommended Measures\n\n`;
  md += `Based on the research retrieved, here are key action areas for **${disease}**:\n\n`;
  md += `- **Consult a specialist** — A qualified physician or specialist in ${disease} can review the latest treatment protocols with you.\n`;
  if (recruitingTrials.length > 0) {
    md += `- **Consider clinical trials** — ${recruitingTrials.length} currently recruiting trial(s) were found. Check the **Clinical Trials** tab for eligibility and contact details.\n`;
  }
  md += `- **Review the publications** — The **Publications** tab contains the full list of ranked research papers with abstracts and direct links.\n`;
  md += `- **Follow-up queries** — You can ask follow-up questions below. Context from this session is automatically remembered.\n\n`;
  md += `---\n*This summary is AI-assisted and research-sourced. Always consult a licensed healthcare professional before making medical decisions.*\n`;

  return md;
}

module.exports = { generateMedicalInsights, generateMedicalInsightsStream, expandSearchQuery };
