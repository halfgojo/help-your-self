const axios = require('axios');
const xml2js = require('xml2js');

const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// PubMed uses a two-step process:
// 1. esearch -> get article IDs
// 2. efetch  -> get full article data for those IDs
async function fetchFromPubMed(query, disease, maxResults = 80) {
  try {
    const searchTerm = `${query} ${disease}`.trim();

    // Step 1: Search and get IDs
    const searchResponse = await axios.get(`${PUBMED_BASE}/esearch.fcgi`, {
      params: {
        db: 'pubmed',
        term: searchTerm,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance',
      },
      timeout: 15000,
    });

    const ids = searchResponse.data?.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    // Step 2: Fetch summaries for those IDs
    const summaryResponse = await axios.get(`${PUBMED_BASE}/efetch.fcgi`, {
      params: {
        db: 'pubmed',
        id: ids.join(','),
        retmode: 'xml',
        rettype: 'abstract',
      },
      timeout: 20000,
    });

    const parsed = await xml2js.parseStringPromise(summaryResponse.data, {
      explicitArray: false,
    });

    const articles = parsed?.PubmedArticleSet?.PubmedArticle;
    if (!articles) return [];

    const articleList = Array.isArray(articles) ? articles : [articles];

    return articleList.map((article) => {
      const medline = article.MedlineCitation;
      const articleData = medline?.Article;

      const title = articleData?.ArticleTitle || 'Untitled';

      // Abstract can be a string or an object with sections
      let abstract = '';
      const abstractData = articleData?.Abstract?.AbstractText;
      if (typeof abstractData === 'string') {
        abstract = abstractData;
      } else if (Array.isArray(abstractData)) {
        abstract = abstractData.map((a) => (typeof a === 'string' ? a : a._ || '')).join(' ');
      } else if (abstractData?._) {
        abstract = abstractData._;
      }

      // Parse authors list
      const authorList = articleData?.AuthorList?.Author;
      const authors = parseAuthors(authorList);

      const pmid = medline?.PMID?._ || medline?.PMID || '';
      const year =
        articleData?.Journal?.JournalIssue?.PubDate?.Year ||
        articleData?.ArticleDate?.Year ||
        'N/A';

      return {
        title,
        abstract,
        authors,
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        source: 'PubMed',
      };
    });
  } catch (err) {
    console.error('PubMed fetch error:', err.message);
    return [];
  }
}

function parseAuthors(authorList) {
  if (!authorList) return [];
  const list = Array.isArray(authorList) ? authorList : [authorList];
  return list
    .slice(0, 3)
    .map((a) => {
      const last = a.LastName || '';
      const first = a.ForeName || a.Initials || '';
      return `${last} ${first}`.trim();
    })
    .filter(Boolean);
}

module.exports = { fetchFromPubMed };
