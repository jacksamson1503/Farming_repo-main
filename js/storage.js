// ==========================================================================
// STORAGE & OFFLINE PERSISTENCE SERVICE
// Manages Farmer Profile, Settings, Financial Calculations, Tasks & Offline Cache
// ==========================================================================

const PROFILE_KEY = 'ai_farm_farmer_profile_v3';
const SETTINGS_KEY = 'ai_farm_app_settings_v3';
const CALC_KEY = 'ai_farm_saved_calculations_v3';
const TASKS_KEY = 'ai_farm_calendar_tasks_v3';
const NOTIFICATIONS_KEY = 'ai_farm_notification_prefs_v3';
const ADMIN_KEY = 'ai_farm_admin_announcements_v3';

const DEFAULT_PROFILE = {
  farmerName: 'Warren Samson',
  mobile: '9876543210',
  state: 'Tamil Nadu',
  district: 'Dharmapuri',
  taluk: 'Pennagaram',
  village: 'Pennagaram West',
  landSize: 2.5,
  soilType: 'red',
  irrigationType: 'borewell',
  mainCrops: ['paddy', 'tomato'],
  preferredLang: 'ta',
  started: true,
  registeredDate: '15 Sep 2026'
};

const DEFAULT_SETTINGS = {
  theme: 'dark-agricultural',
  notificationsEnabled: true,
  offlineSyncEnabled: true,
  lastWeatherRefresh: null,
  cachedCoords: { lat: 12.1211, lon: 78.1582 }
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profileData) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
  } catch (err) {
    console.warn('Failed to save farmer profile to LocalStorage:', err);
  }
}

export function loadAppSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAppSettings(settingsData) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsData));
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
}

// Financial Calculator History
export function loadSavedCalculations() {
  try {
    const raw = localStorage.getItem(CALC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCalculation(calcItem) {
  try {
    const existing = loadSavedCalculations();
    const updated = [
      { id: Date.now().toString(), timestamp: new Date().toLocaleDateString('en-IN'), ...calcItem },
      ...existing
    ].slice(0, 10); // keep last 10 calculations
    localStorage.setItem(CALC_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save financial calculation:', err);
    return [];
  }
}

export function deleteCalculation(id) {
  try {
    const existing = loadSavedCalculations();
    const updated = existing.filter(item => item.id !== id);
    localStorage.setItem(CALC_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// Calendar Task Statuses
export function loadCalendarTaskStatus(cropId) {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[cropId] || {};
  } catch {
    return {};
  }
}

export function toggleCalendarTask(cropId, stepIndex, isCompleted) {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (!map[cropId]) map[cropId] = {};
    map[cropId][stepIndex] = isCompleted;
    localStorage.setItem(TASKS_KEY, JSON.stringify(map));
    return map[cropId];
  } catch (err) {
    console.warn('Failed to update calendar task status:', err);
    return {};
  }
}

// Admin Announcements
export function loadAdminAnnouncements() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : [
      {
        id: 'ann-1',
        titleEn: 'TNAU Organic Seed Subsidy Distribution Camp',
        titleTa: 'தமிழ்நாடு வேளாண் பல்கலைக்கழக இயற்கை விதை மானிய விநியோகம்',
        messageEn: 'Distribution of certified high-yielding paddy & pulse seeds at 50% subsidy through all Block ADA offices.',
        messageTa: 'அனைத்து வட்டார வேளாண் அலுவலகங்களிலும் 50% மானியத்தில் சான்று பெற்ற நெல் மற்றும் பயறு விதைகள் விநியோகம் நடைபெறுகிறது.',
        date: '15 Sep 2026',
        author: 'District Agriculture Officer'
      }
    ];
  } catch {
    return [];
  }
}

export function saveAdminAnnouncement(item) {
  try {
    const existing = loadAdminAnnouncements();
    const updated = [
      { id: Date.now().toString(), date: new Date().toLocaleDateString('en-IN'), ...item },
      ...existing
    ];
    localStorage.setItem(ADMIN_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save admin announcement:', err);
    return [];
  }
}

// Clear all local farm data
export function clearAllLocalData() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(CALC_KEY);
  localStorage.removeItem(TASKS_KEY);
  localStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem('cached_weather');
}
