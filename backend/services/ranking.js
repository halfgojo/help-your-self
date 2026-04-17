/**
 * ranking.js
 * Ranking and filtering logic for HelpYourself.
 * Semantic re-ranking using @xenova/transformers (all-MiniLM-L6-v2).
 *
 * @xenova/transformers is ESM-only, so we must use dynamic import().
 * The pipeline is lazily loaded on first call and cached for all subsequent requests.
 */

let _extractPipeline = null;

async function getEmbeddingPipeline() {
  if (_extractPipeline) return _extractPipeline;

  // Dynamic import required — @xenova/transformers is ESM only
  const { pipeline } = await import('@xenova/transformers');
  console.log('[Curalink] Loading semantic embedding model (first request only)…');
  _extractPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('[Curalink] Semantic embedding model ready');
  return _extractPipeline;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function recencyScore(year) {
  const currentYear = new Date().getFullYear();
  if (!year || year === 'N/A') return 0.2;
  const age = Math.max(0, currentYear - parseInt(year, 10));
  return Math.max(0, 1 - age / 10);
}

const SOURCE_WEIGHT = {
  PubMed: 1.0,
  OpenAlex: 0.85,
  'ClinicalTrials.gov': 0.9,
};

const STATUS_PRIORITY = {
  RECRUITING: 1.0,
  'NOT YET RECRUITING': 0.85,
  'ACTIVE, NOT RECRUITING': 0.7,
  ENROLLING_BY_INVITATION: 0.65,
  COMPLETED: 0.5,
};

async function embedText(extract, text) {
  const safeText = (text || '').substring(0, 1500).trim();
  if (!safeText) return null;
  try {
    const out = await extract(safeText, { pooling: 'mean', normalize: true });
    return out.data;
  } catch {
    return null;
  }
}

async function rankItems(items, query, disease, topK, isTrial) {
  if (!items || items.length === 0) return [];

  let extract;
  try {
    extract = await getEmbeddingPipeline();
  } catch (err) {
    console.error('[Curalink] Embedding model failed to load, using fallback ranking:', err.message);
    // Fallback — return items as-is (up to topK), no semantic scoring
    return items.slice(0, topK).map((item) => ({ ...item, _score: 0 }));
  }

  const queryVec = await embedText(extract, `${disease} ${query}`.trim());
  if (!queryVec) return items.slice(0, topK);

  const scored = [];
  for (const item of items) {
    const text = `${item.title || ''} ${item.abstract || item.summary || ''}`;
    const docVec = await embedText(extract, text);

    if (!docVec) {
      scored.push({ ...item, _score: 0 });
      continue;
    }

    const semantic = cosineSimilarity(queryVec, docVec);

    let score;
    if (!isTrial) {
      const recency = recencyScore(item.year);
      const credibility = SOURCE_WEIGHT[item.source] || 0.8;
      score = semantic * 0.6 + recency * 0.25 + credibility * 0.15;
    } else {
      const statusBoost = STATUS_PRIORITY[(item.status || '').toUpperCase()] || 0.3;
      score = semantic * 0.65 + statusBoost * 0.35;
    }

    scored.push({ ...item, _score: score });
  }

  // Sort descending by score
  scored.sort((a, b) => b._score - a._score);

  // Deduplicate by title similarity (simple substring check)
  const unique = [];
  for (const item of scored) {
    const t1 = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isDup = unique.some((u) => {
      const t2 = (u.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return t1.length > 10 && t2.length > 10 && (t1.includes(t2) || t2.includes(t1));
    });
    if (!isDup) unique.push(item);
    if (unique.length >= topK) break;
  }

  return unique;
}

async function rankPublications(pubs, query, disease, topK = 8) {
  return rankItems(pubs, query, disease, topK, false);
}

async function rankTrials(trials, query, disease, topK = 8) {
  return rankItems(trials, query, disease, topK, true);
}

module.exports = { rankPublications, rankTrials };
