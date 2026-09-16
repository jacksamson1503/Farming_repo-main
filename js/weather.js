// ==========================================================================
// LIVE HYPERLOCAL WEATHER & AGRICULTURAL ADVISORY ENGINE
// Integrates real-time Open-Meteo Forecast API for any Indian coordinate
// ==========================================================================

import { getLang, t } from './i18n.js';

/**
 * Fetches real-time comprehensive weather from Open-Meteo
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather payload
 */
export async function getWeather(lat, lon) {
  const latitude = encodeURIComponent(Number(lat).toFixed(4));
  const longitude = encodeURIComponent(Number(lon).toFixed(4));

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index` +
    `&hourly=temperature_2m,precipitation_probability,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max` +
    `&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service returned HTTP ${response.status}`);
  }

  const data = await response.json();

  // Cache in LocalStorage for offline reliability
  try {
    localStorage.setItem('cached_weather', JSON.stringify({
      data,
      timestamp: Date.now(),
      lat,
      lon
    }));
  } catch (err) {
    console.warn('Unable to cache weather locally:', err);
  }

  return data;
}

/**
 * Returns cached weather if available
 */
export function getCachedWeather() {
  try {
    const raw = localStorage.getItem('cached_weather');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Converts WMO weather code to bilingual condition description
 */
export function weatherText(code) {
  const isTa = getLang() === 'ta';
  const c = Number(code);

  if (c === 0) return isTa ? 'தெளிவான வானம்' : 'Clear Sky';
  if (c === 1) return isTa ? 'பெரும்பாலும் தெளிவு' : 'Mainly Clear';
  if (c === 2) return isTa ? 'பகுதி மேகமூட்டம்' : 'Partly Cloudy';
  if (c === 3) return isTa ? 'முழு மேகமூட்டம்' : 'Overcast';
  if (c === 45 || c === 48) return isTa ? 'மூடுபனி' : 'Foggy';
  if (c >= 51 && c <= 55) return isTa ? 'லேசான தூறல்' : 'Drizzle';
  if (c >= 61 && c <= 65) return isTa ? 'மிதமான மழை' : 'Rain';
  if (c === 66 || c === 67) return isTa ? 'குளிர்ந்த மழை' : 'Freezing Rain';
  if (c >= 71 && c <= 77) return isTa ? 'பனிப்பொழிவு' : 'Snowfall';
  if (c >= 80 && c <= 82) return isTa ? 'மழை பொழிவு' : 'Rain Showers';
  if (c === 95) return isTa ? 'இடி மின்னலுடன் மழை' : 'Thunderstorm';
  if (c >= 96) return isTa ? 'கனமழையுடன் ஆலங்கட்டி' : 'Severe Thunderstorm & Hail';

  return isTa ? 'சாதாரண வானிலை' : 'Fair Weather';
}

/**
 * Returns weather icon illustration based on WMO code
 */
export function getWeatherIcon(code) {
  const c = Number(code);
  if (c === 0) return '☀️';
  if (c === 1 || c === 2) return '🌤️';
  if (c === 3) return '☁️';
  if (c === 45 || c === 48) return '🌫️';
  if (c >= 51 && c <= 55) return '🌦️';
  if (c >= 61 && c <= 65) return '🌧️';
  if (c >= 80 && c <= 82) return '⛈️';
  if (c >= 95) return '⚡';
  return '⛅';
}

/**
 * Converts wind degrees into 8-point compass direction
 */
export function getWindDirection(deg) {
  const isTa = getLang() === 'ta';
  const directionsEn = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const directionsTa = ['வடக்கு', 'வடகிழக்கு', 'கிழக்கு', 'தென்கிழக்கு', 'தெற்கு', 'தென்மேற்கு', 'மேற்கு', 'வடமேற்கு'];
  const index = Math.round((deg % 360) / 45) % 8;
  return isTa ? directionsTa[index] : directionsEn[index];
}

/**
 * Calculates human readable "X minutes ago" string
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return t('justNow');
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('justNow');
  if (diffMins < 60) return `${diffMins} ${t('minutesAgo')}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${t('hoursAgo')}`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Generates practical agricultural advisories based on live weather parameters
 */
export function generateAgriAdvisory(weatherData) {
  const advisories = [];
  if (!weatherData || !weatherData.current) {
    return [
      {
        type: 'info',
        icon: '🌾',
        titleEn: 'Check Field Moisture Regularly',
        titleTa: 'நிலத்தின் ஈரப்பதத்தை தொடர்ந்து கண்காணிக்கவும்',
        descEn: t('expertDisclaimer'),
        descTa: t('expertDisclaimer')
      }
    ];
  }

  const cur = weatherData.current;
  const temp = cur.temperature_2m;
  const humidity = cur.relative_humidity_2m;
  const wind = cur.wind_speed_10m;
  const rain = cur.rain || cur.precipitation || 0;
  const code = cur.weather_code;
  const daily = weatherData.daily;
  const maxRainProb = daily?.precipitation_probability_max ? daily.precipitation_probability_max[0] : 0;
  const maxRainSum = daily?.precipitation_sum ? daily.precipitation_sum[0] : 0;

  // 1. Heavy Rain / Storm Alert
  if (code >= 95 || rain > 10 || maxRainSum > 20 || maxRainProb > 70) {
    advisories.push({
      type: 'danger',
      icon: '⚠️',
      titleEn: 'Heavy Rain / Thunderstorm Alert',
      titleTa: 'கனமழை மற்றும் இடி மின்னல் எச்சரிக்கை',
      descEn: t('advRainHeavy'),
      descTa: t('advRainHeavy')
    });
  } else if (rain > 0.5 || maxRainProb > 45) {
    advisories.push({
      type: 'warning',
      icon: '🌧️',
      titleEn: 'Rain Expected — Delay Spraying',
      titleTa: 'மழை வாய்ப்பு — மருந்து தெளிப்பதை தள்ளிப்போடவும்',
      descEn: t('advRainLight'),
      descTa: t('advRainLight')
    });
  }

  // 2. High Temperature Alert
  if (temp >= 35) {
    advisories.push({
      type: 'warning',
      icon: '🌡️',
      titleEn: 'High Temperature & Evaporation Risk',
      titleTa: 'அதிக வெப்பம் மற்றும் நீர் ஆவியாதல் எச்சரிக்கை',
      descEn: t('advHighTemp'),
      descTa: t('advHighTemp')
    });
  }

  // 3. High Humidity & Fungal Disease Risk
  if (humidity >= 80 && temp >= 22) {
    advisories.push({
      type: 'warning',
      icon: '🦠',
      titleEn: 'High Humidity — Fungal Disease Precaution',
      titleTa: 'அதிக ஈரப்பதம் — பூஞ்சை நோய் தடுப்பு ஆலோசனை',
      descEn: t('advHighHumidity'),
      descTa: t('advHighHumidity')
    });
  }

  // 4. Strong Wind Alert
  if (wind >= 22) {
    advisories.push({
      type: 'info',
      icon: '💨',
      titleEn: 'Strong Winds Alert — Support Tall Crops',
      titleTa: 'பலத்த காற்று எச்சரிக்கை — பயிர்களை தாங்கவும்',
      descEn: t('advStrongWind'),
      descTa: t('advStrongWind')
    });
  }

  // 5. Favorable Conditions
  if (advisories.length === 0) {
    advisories.push({
      type: 'success',
      icon: '☀️',
      titleEn: 'Favorable Farming Conditions',
      titleTa: 'விவசாயத்திற்கு சாதகமான தெளிவான சூழல்',
      descEn: t('advFavorable'),
      descTa: t('advFavorable')
    });
  }

  return advisories;
}

/**
 * Returns weather alerts list for notification cards
 */
export function getWeatherAlerts(weatherData) {
  const alerts = [];
  if (!weatherData?.daily) return alerts;

  const d = weatherData.daily;
  const rainProb = d.precipitation_probability_max?.[0] || 0;
  const rainSum = d.precipitation_sum?.[0] || 0;
  const maxTemp = d.temperature_2m_max?.[0] || 30;
  const uvMax = d.uv_index_max?.[0] || 6;

  if (rainSum >= 20 || rainProb >= 70) {
    alerts.push({
      severity: 'high',
      badge: getLang() === 'ta' ? 'அதி தீவிர எச்சரிக்கை' : 'Severe Warning',
      titleEn: '⚠️ Heavy Rainfall Expected Today',
      titleTa: '⚠️ இன்று மிக கனமழை பெய்ய வாய்ப்பு',
      messageEn: `Expected rainfall: ${rainSum} mm with ${rainProb}% probability. Provide immediate drainage in low-lying fields.`,
      messageTa: `எதிர்பார்க்கப்படும் மழை அளவு: ${rainSum} மி.மீ (${rainProb}% வாய்ப்பு). நிலத்தில் தேங்கும் தண்ணீரை உடனடியாக வடிக்கவும்.`
    });
  }

  if (maxTemp >= 38) {
    alerts.push({
      severity: 'moderate',
      badge: getLang() === 'ta' ? 'வெப்ப எச்சரிக்கை' : 'Heat Wave',
      titleEn: '☀️ Extreme Heat Advisory',
      titleTa: '☀️ தீவிர கோடை வெப்ப எச்சரிக்கை',
      messageEn: `Maximum temperature reaching ${Math.round(maxTemp)}°C. Protect cattle in shaded sheds and avoid field work at noon.`,
      messageTa: `அதிகபட்ச வெப்பநிலை ${Math.round(maxTemp)}°C ஐ எட்டும். கால்நடைகளை நிழலில் கட்டவும்; உச்சி வெயிலில் வேலை செய்வதை தவிர்க்கவும்.`
    });
  }

  if (uvMax >= 9) {
    alerts.push({
      severity: 'info',
      badge: getLang() === 'ta' ? 'புற ஊதா கதிர்' : 'High UV',
      titleEn: '🧴 Very High UV Index',
      titleTa: '🧴 அதிக புற ஊதா கதிர்வீச்சு',
      messageEn: `Peak UV index of ${uvMax}. Wear broad hats and drink plenty of water while working in fields.`,
      messageTa: `புற ஊதா கதிர்வீச்சு அளவு ${uvMax}. வயலில் பணிபுரியும் போது தலைப்பாகை அணிந்து போதுமான தண்ணீர் அருந்தவும்.`
    });
  }

  return alerts;
}
