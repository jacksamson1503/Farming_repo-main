// ==========================================================================
// ALL-INDIA LOCATION & GPS SERVICE
// Device Geolocation, Reverse Geocoding, Search & Hierarchical Picker
// ==========================================================================

import { ALL_INDIAN_STATES, DISTRICT_COORDINATES } from './data.js';

/**
 * Retrieves user's current GPS position using browser Geolocation API
 * @returns {Promise<{lat: number, lon: number, accuracy: number}>}
 */
export function getCurrentGPSLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      err => {
        let msg = 'Unable to retrieve your location.';
        if (err.code === 1) msg = 'Location permission denied by user.';
        if (err.code === 2) msg = 'Location position unavailable.';
        if (err.code === 3) msg = 'Location request timed out.';
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Reverse geocodes coordinates to State, District, Taluk and Village
 * Uses OpenStreetMap Nominatim with BigDataCloud and nearest district fallback
 * @param {number} lat
 * @param {number} lon
 */
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=14&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const state = addr.state || 'Tamil Nadu';
      const district = addr.state_district || addr.county || addr.district || findNearestDistrict(lat, lon).name;
      const taluk = addr.subdistrict || addr.county || '';
      const village = addr.village || addr.town || addr.suburb || addr.neighbourhood || '';

      return {
        state,
        district: cleanDistrictName(district),
        taluk,
        village,
        lat,
        lon,
        displayName: data.display_name
      };
    }
  } catch (err) {
    console.warn('Reverse geocode API failed, resolving via nearest district centroid:', err);
  }

  // Fallback to nearest district in our database
  const nearest = findNearestDistrict(lat, lon);
  return {
    state: nearest.state,
    district: nearest.name,
    taluk: nearest.taluks[0] || '',
    village: '',
    lat,
    lon
  };
}

/**
 * Calculates straight line distance between two coordinates
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Finds the nearest recorded district centroid in data.js
 */
export function findNearestDistrict(lat, lon) {
  let closest = null;
  let minDistance = Infinity;

  for (const [name, info] of Object.entries(DISTRICT_COORDINATES)) {
    const dist = getDistance(lat, lon, info.lat, info.lon);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { name, ...info };
    }
  }

  return closest || {
    name: 'Dharmapuri',
    state: 'Tamil Nadu',
    lat: 12.1211,
    lon: 78.1582,
    taluks: ['Pennagaram', 'Dharmapuri', 'Palacode']
  };
}

/**
 * Normalizes district names from external geocoders
 */
function cleanDistrictName(raw) {
  if (!raw) return 'Dharmapuri';
  let cleaned = raw.replace(/\s+district$/i, '').trim();
  for (const known of Object.keys(DISTRICT_COORDINATES)) {
    if (known.toLowerCase() === cleaned.toLowerCase()) return known;
  }
  return cleaned;
}

/**
 * Returns all districts belonging to a state
 */
export function getDistrictsForState(stateName) {
  const list = [];
  for (const [name, info] of Object.entries(DISTRICT_COORDINATES)) {
    if (info.state.toLowerCase() === (stateName || '').toLowerCase()) {
      list.push(name);
    }
  }
  return list.length > 0 ? list : ['District Center'];
}

/**
 * Returns taluks/blocks for a selected district
 */
export function getTaluksForDistrict(districtName) {
  const found = DISTRICT_COORDINATES[districtName];
  if (found && found.taluks && found.taluks.length > 0) {
    return found.taluks;
  }
  return ['Taluk 1', 'Taluk 2', 'Main Block'];
}

/**
 * Global search across Indian locations
 */
export function searchIndianLocations(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const results = [];

  // Search districts
  for (const [district, info] of Object.entries(DISTRICT_COORDINATES)) {
    if (district.toLowerCase().includes(q) || info.state.toLowerCase().includes(q)) {
      results.push({
        type: 'district',
        label: `${district}, ${info.state}`,
        district,
        state: info.state,
        lat: info.lat,
        lon: info.lon
      });
    }

    // Search taluks
    if (info.taluks) {
      for (const t of info.taluks) {
        if (t.toLowerCase().includes(q)) {
          results.push({
            type: 'taluk',
            label: `${t}, ${district}, ${info.state}`,
            taluk: t,
            district,
            state: info.state,
            lat: info.lat,
            lon: info.lon
          });
        }
      }
    }
  }

  // Search States
  for (const st of ALL_INDIAN_STATES) {
    if (st.toLowerCase().includes(q)) {
      results.push({
        type: 'state',
        label: `${st} (State)`,
        state: st
      });
    }
  }

  return results.slice(0, 10);
}

/**
 * Formats location object for top bar & hero card displays
 */
export function formatLocationTitle(loc) {
  if (!loc) return '📍 Pennagaram, Dharmapuri, Tamil Nadu';
  const parts = [];
  if (loc.village) parts.push(loc.village);
  if (loc.taluk && !parts.includes(loc.taluk)) parts.push(loc.taluk);
  if (loc.district) parts.push(loc.district);
  if (loc.state) parts.push(loc.state);

  return parts.length > 0 ? parts.join(', ') : 'Dharmapuri, Tamil Nadu';
}
