const axios = require('axios');

/**
 * Service to translate AI generated medical insights into 22 Indian languages
 * using the Bhashini National Language Translation Mission (ULCA API).
 */
async function translateText(text, targetLangCode) {
  const apiKey = process.env.BHASHINI_API_KEY;
  const userId = process.env.BHASHINI_USER_ID;

  if (!apiKey || !userId) {
    console.warn('[HelpYourself] Bhashini keys missing. Falling back to mock translation.');
    return `[Mock Translation to ${targetLangCode}] 
Please add BHASHINI_API_KEY and BHASHINI_USER_ID to your Render or local .env file to enable live translation of this medical text.

Original text: 
${text.substring(0, 100)}...`;
  }

  try {
    // Note: The specific ULCA endpoint depends on the environment setup in Bhashini.
    // This is the standard format for their pipeline inference.
    const response = await axios.post(
      'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
      {
        pipelineTasks: [
          {
            taskType: "translation",
            config: {
              language: {
                sourceLanguage: "en",
                targetLanguage: targetLangCode
              }
            }
          }
        ],
        inputData: {
          input: [{ source: text }]
        }
      },
      {
        headers: {
          'Authorization': apiKey,
          'userID': userId,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const translated = response.data?.pipelineResponse?.[0]?.output?.[0]?.target || '';
    return translated || text;
  } catch (err) {
    console.error('[HelpYourself] Bhashini translation error:', err.message);
    return text; // Fallback to English respectfully instead of crashing
  }
}

module.exports = { translateText };
