const axios = require('axios');

/**
 * Maps Open-Meteo WMO weather codes to a human-readable description
 */
function getWeatherDescription(code) {
  if (code === 0) return 'Clear sky';
  if (code >= 1 && code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Unknown conditions';
}

/**
 * Generates official-style IMD Alerts (India Meteorological Department)
 * based on extreme weather conditions to trigger preventative protocols in the AI.
 */
function checkIMDAlerts(temperature, precipitation) {
  if (temperature >= 42) return { level: 'RED', type: 'Severe Heatwave', action: 'IMD Alert: Extreme heat risk. Stay indoors.' };
  if (temperature >= 38) return { level: 'ORANGE', type: 'Heatwave', action: 'IMD Alert: High heat risk. Hydration crucial.' };
  if (precipitation >= 30) return { level: 'RED', type: 'Extremely Heavy Rainfall', action: 'IMD Alert: Flash flood & vector-borne disease risk.' };
  if (precipitation >= 15) return { level: 'YELLOW', type: 'Heavy Rainfall', action: 'IMD Alert: Monsoonal disease risk (Dengue/Malaria).' };
  return null;
}

/**
 * Given a location string (e.g. "Mumbai, India"), fetch the live weather context.
 * Returns null if location cannot be geocoded or API fails.
 */
async function fetchWeather(locationString) {
  if (!locationString) return null;

  try {
    // 1. Geocode the location string to lat/long
    const geoResponse = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: {
        name: locationString,
        count: 1,
        format: 'json'
      },
      timeout: 5000
    });

    const results = geoResponse.data?.results;
    if (!results || results.length === 0) {
      return null;
    }

    const { latitude, longitude, name, admin1, country } = results[0];
    const resolvedLocation = `${name}${admin1 ? `, ${admin1}` : ''}, ${country}`;

    // 2. Fetch current weather for those coordinates
    const weatherResponse = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude,
        longitude,
        current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code',
        timezone: 'auto'
      },
      timeout: 5000
    });

    const current = weatherResponse.data?.current;
    if (!current) return null;

    const condition = getWeatherDescription(current.weather_code);
    const imdAlert = checkIMDAlerts(current.temperature_2m, current.precipitation);

    return {
      location: resolvedLocation,
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      condition,
      imdAlert
    };

  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return null;
  }
}

module.exports = { fetchWeather };
