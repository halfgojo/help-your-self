const axios = require('axios');

// Fetch research papers from OpenAlex API
// API wrapper for OpenAlex (academic publications) for HelpYourself.
async function fetchFromOpenAlex(query, disease, maxResults = 80) {
  try {
    const searchTerm = `${query} ${disease}`.trim();

    const response = await axios.get('https://api.openalex.org/works', {
      params: {
        search: searchTerm,
        per_page: Math.min(maxResults, 200),
        select:
          'id,title,abstract_inverted_index,authorships,publication_year,primary_location,open_access,doi',
        sort: 'relevance_score:desc',
        filter: 'has_abstract:true',
      },
      headers: {
        'User-Agent': 'HelpYourself/1.0 (mailto:helpyourself@research.com)',
      },
      timeout: 15000,
    });

    const works = response.data.results || [];

    // Convert OpenAlex inverted index abstract back to readable text
    return works.map((work) => {
      const abstract = reconstructAbstract(work.abstract_inverted_index);
      const authors = (work.authorships || [])
        .slice(0, 3)
        .map((a) => a.author?.display_name)
        .filter(Boolean);
      const url =
        work.doi
          ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}`
          : work.id;

      return {
        title: work.title || 'Untitled',
        abstract: abstract || '',
        authors,
        year: work.publication_year || 'N/A',
        url,
        source: 'OpenAlex',
      };
    });
  } catch (err) {
    console.error('OpenAlex fetch error:', err.message);
    return [];
  }
}

// OpenAlex stores abstracts as an inverted index { word: [positions] }
// This function reconstructs the original sentence from it
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';

  const wordMap = {};
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordMap[pos] = word;
    }
  }

  const maxPos = Math.max(...Object.keys(wordMap).map(Number));
  const words = [];
  for (let i = 0; i <= maxPos; i++) {
    words.push(wordMap[i] || '');
  }

  return words.join(' ').trim();
}

module.exports = { fetchFromOpenAlex };
