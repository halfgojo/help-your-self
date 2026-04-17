const axios = require('axios');

// Fetch clinical trials from ClinicalTrials.gov v2 API
async function fetchFromClinicalTrials(disease, query = '', maxResults = 100) {
  try {
    // Combine disease and query for a better search
    const searchTerm = query ? `${disease} ${query}` : disease;

    const response = await axios.get('https://clinicaltrials.gov/api/v2/studies', {
      params: {
        'query.term': searchTerm,
        pageSize: Math.min(maxResults, 100),
        format: 'json',
        fields: [
          'NCTId',
          'BriefTitle',
          'OfficialTitle',
          'BriefSummary',
          'OverallStatus',
          'Phase',
          'EligibilityCriteria',
          'LocationFacility',
          'LocationCity',
          'LocationCountry',
          'CentralContactName',
          'CentralContactPhone',
          'CentralContactEMail',
          'StartDate',
          'CompletionDate',
          'StudyType',
        ].join('|'),
      },
      timeout: 15000,
    });

    const studies = response.data?.studies || [];

    return studies.map((study) => {
      const proto = study.protocolSection;
      const id = proto?.identificationModule;
      const status = proto?.statusModule;
      const description = proto?.descriptionModule;
      const eligibility = proto?.eligibilityModule;
      const contacts = proto?.contactsLocationsModule;

      // Extract locations (Prioritize country first, drop long facility names)
      const locations = (contacts?.locations || []).slice(0, 3).map((loc) => {
        const parts = [loc.country, loc.city].filter(Boolean);
        return parts.join(' - ');
      });

      // Extract contact info
      const centralContact = contacts?.centralContacts?.[0] || {};

      return {
        nctId: id?.nctId || '',
        title: id?.briefTitle || id?.officialTitle || 'Untitled Trial',
        summary: description?.briefSummary || '',
        status: status?.overallStatus || 'Unknown',
        phase: proto?.designModule?.phases?.join(', ') || 'N/A',
        eligibility: eligibility?.eligibilityCriteria || '',
        locations: locations.length ? locations : ['Location not specified'],
        contact: {
          name: centralContact.name || '',
          phone: centralContact.phone || '',
          email: centralContact.email || '',
        },
        startDate: status?.startDateStruct?.date || 'N/A',
        completionDate: status?.completionDateStruct?.date || 'N/A',
        url: id?.nctId
          ? `https://clinicaltrials.gov/study/${id.nctId}`
          : 'https://clinicaltrials.gov',
        source: 'ClinicalTrials.gov',
      };
    });
  } catch (err) {
    console.error('ClinicalTrials fetch error:', err.message);
    return [];
  }
}

module.exports = { fetchFromClinicalTrials };
