// ==========================================================================
// SMART FARMING APPLICATION - MAIN CONTROLLER & ROUTER
// Mobile-First Architecture for Indian Farmers with 25 Primary UI Pages
// ==========================================================================

import {
  ALL_INDIAN_STATES,
  DISTRICT_COORDINATES,
  CROPS,
  MANDI_PRICES,
  GOVT_SCHEMES,
  VERIFIED_CONTACTS,
  NEARBY_HELP_CENTERS,
  PLANT_DISEASES,
  SOILS,
  WATER_SOURCES,
  SEASONS
} from './data.js';

import { getLang, setLang, t, getText } from './i18n.js';
import {
  getWeather,
  getCachedWeather,
  weatherText,
  getWeatherIcon,
  getWindDirection,
  formatTimeAgo,
  generateAgriAdvisory,
  getWeatherAlerts
} from './weather.js';

import {
  getCurrentGPSLocation,
  reverseGeocode,
  findNearestDistrict,
  getDistrictsForState,
  getTaluksForDistrict,
  searchIndianLocations,
  formatLocationTitle
} from './location.js';

import {
  loadProfile,
  saveProfile,
  loadAppSettings,
  saveAppSettings,
  loadSavedCalculations,
  saveCalculation,
  deleteCalculation,
  loadCalendarTaskStatus,
  toggleCalendarTask,
  loadAdminAnnouncements,
  saveAdminAnnouncement,
  clearAllLocalData
} from './storage.js';

// Application State
const root = document.getElementById('root');
const profile = loadProfile();
const settings = loadAppSettings();

let state = {
  page: profile.started ? 'home' : 'welcome',
  farmer: { ...profile },
  selectedLocation: {
    state: profile.state || 'Tamil Nadu',
    district: profile.district || 'Dharmapuri',
    taluk: profile.taluk || 'Pennagaram',
    village: profile.village || 'Pennagaram West',
    lat: 12.1211,
    lon: 78.1582
  },
  weather: null,
  weatherLoading: false,
  weatherTimestamp: null,
  selectedCropId: profile.mainCrops?.[0] || 'paddy',
  compareCrops: ['paddy', 'groundnut'],
  activeCropFilter: 'all',
  activeSchemeFilter: 'all',
  activeHelpFilter: 'all',
  activeNotificationTab: 'all',
  activeAdminTab: 'announcements',
  drawerOpen: false,
  searchModalOpen: false,
  searchQuery: '',
  emergencyModalOpen: false,
  toastMessage: '',
  aiMessages: [
    {
      sender: 'ai',
      textEn: 'Hello farmer friend! I am your Smart Agriculture Assistant. How can I help with your crops, weather, soil, or government schemes today?',
      textTa: 'வணக்கம் விவசாயி தோழரே! நான் உங்கள் ஸ்மார்ட் வேளாண் உதவியாளர். பயிர்கள், வானிலை, உரம், மானியம் அல்லது நோய் தடுப்பு குறித்து என்ன கேட்க விரும்புகிறீர்கள்?'
    }
  ],
  diseaseScanResult: null,
  soilAnalysisResult: null,
  cropRecommendResult: null,
  calendarSowingDate: new Date().toISOString().split('T')[0],
  isSpeaking: false
};

// Initialize coordinates from district database if not present
const initialDistrict = DISTRICT_COORDINATES[state.selectedLocation.district];
if (initialDistrict) {
  state.selectedLocation.lat = initialDistrict.lat;
  state.selectedLocation.lon = initialDistrict.lon;
}

// Utility Helpers
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = n => '₹' + Math.max(0, Math.round(Number(n) || 0)).toLocaleString('en-IN');
const cropObj = id => CROPS.find(c => c.id === id) || CROPS[0];
const cropName = c => (getLang() === 'ta' ? c.ta : c.en);

function showToast(msg) {
  state.toastMessage = msg;
  render();
  setTimeout(() => {
    state.toastMessage = '';
    render();
  }, 3500);
}

function go(pageId, options = {}) {
  state.page = pageId;
  state.drawerOpen = false;
  state.searchModalOpen = false;
  state.emergencyModalOpen = false;
  if (options.cropId) state.selectedCropId = options.cropId;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Fetch Weather Asynchronously
async function fetchCurrentWeather(forceRefresh = false) {
  state.weatherLoading = true;
  render();

  try {
    const lat = state.selectedLocation.lat;
    const lon = state.selectedLocation.lon;
    const data = await getWeather(lat, lon);
    state.weather = data;
    state.weatherTimestamp = Date.now();
    state.weatherLoading = false;
  } catch (err) {
    console.warn('Live weather fetch failed, attempting cached fallback:', err);
    const cached = getCachedWeather();
    if (cached) {
      state.weather = cached.data;
      state.weatherTimestamp = cached.timestamp;
    }
    state.weatherLoading = false;
  }
  render();
}

// Speech Synthesis Helper (Text-to-Speech)
function speakText(text) {
  if (!('speechSynthesis' in window)) {
    showToast(t('expertDisclaimer'));
    return;
  }

  if (state.isSpeaking) {
    window.speechSynthesis.cancel();
    state.isSpeaking = false;
    render();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getLang() === 'ta' ? 'ta-IN' : 'en-IN';
  utterance.rate = 0.9;

  utterance.onstart = () => {
    state.isSpeaking = true;
    render();
  };
  utterance.onend = () => {
    state.isSpeaking = false;
    render();
  };
  utterance.onerror = () => {
    state.isSpeaking = false;
    render();
  };

  window.speechSynthesis.speak(utterance);
}

// ==========================================================================
// SHARED UI COMPONENTS (Status Bar, Header, Bottom Nav, Drawer, Search Modal)
// ==========================================================================

function renderHeader() {
  if (state.page === 'welcome') return '';

  const locTitle = formatLocationTitle(state.selectedLocation);

  return `
    <header class="app-header">
      <div class="header-top-row">
        <button class="header-icon-btn" id="openDrawerBtn" title="${t('allServices')}">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <div class="header-location-pill" id="headerLocationBtn" title="${t('changeLocation')}">
          <span class="loc-pin-icon">📍</span>
          <span class="loc-text-label">${esc(locTitle)}</span>
          <span class="loc-chevron">▾</span>
        </div>

        <div class="header-actions-group">
          <!-- Language Switcher Button -->
          <button class="lang-pill-btn" id="toggleLangBtn" title="Switch Language">
            ${getLang() === 'ta' ? 'English' : 'தமிழ்'}
          </button>

          <!-- Search Button -->
          <button class="header-icon-btn" id="openSearchBtn" title="${t('search')}">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>

          <!-- Emergency Call Button -->
          <button class="emergency-icon-btn" id="openEmergencyBtn" title="${t('emergencyCall')}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.72 11.72 0 003.68.59 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.72 11.72 0 00.59 3.68 1 1 0 01-.24 1.02l-2.23 2.09z"/></svg>
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderBottomNav() {
  if (state.page === 'welcome') return '';

  const items = [
    { id: 'home', icon: '🌾', label: t('home') },
    { id: 'weather', icon: '🌦️', label: t('weather') },
    { id: 'crop-library', icon: '🌱', label: t('crops') },
    { id: 'calendar', icon: '📅', label: t('calendar') },
    { id: 'more', icon: '☰', label: t('more') }
  ];

  return `
    <nav class="bottom-nav-bar">
      ${items.map(item => `
        <button class="nav-item-btn ${state.page === item.id ? 'active' : ''}" data-nav="${item.id}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${state.page === item.id ? '<span class="nav-indicator-dot"></span>' : ''}
        </button>
      `).join('')}
    </nav>
  `;
}

function renderDrawer() {
  if (!state.drawerOpen) return '';

  const categories = [
    {
      title: getLang() === 'ta' ? 'முக்கிய பண்ணை சேவைகள்' : 'Farm Essentials',
      items: [
        { id: 'home', icon: '🌾', label: t('home') },
        { id: 'profile', icon: '👨‍🌾', label: t('profile') },
        { id: 'location', icon: '📍', label: t('locationTitle') },
        { id: 'weather', icon: '🌦️', label: t('liveWeather') },
        { id: 'weather-alerts', icon: '⚠️', label: t('severeAlert') }
      ]
    },
    {
      title: getLang() === 'ta' ? 'பயிர் & மண் கருவிகள்' : 'Crop & Soil Tools',
      items: [
        { id: 'crop-recommend', icon: '✨', label: t('cropRecommendTitle') },
        { id: 'soil-analysis', icon: '🧪', label: t('soilAnalysisTitle') },
        { id: 'crop-library', icon: '📚', label: t('cropLibraryTitle') },
        { id: 'crop-compare', icon: '⚖️', label: t('cropComparisonTitle') },
        { id: 'disease', icon: '🔍', label: t('diseaseTitle') }
      ]
    },
    {
      title: getLang() === 'ta' ? 'திட்டம் & நிதி மேலாண்மை' : 'Planning & Finances',
      items: [
        { id: 'calendar', icon: '📅', label: t('calendarTitle') },
        { id: 'irrigation', icon: '💧', label: t('irrigationTitle') },
        { id: 'calculator', icon: '🧮', label: t('calculatorTitle') },
        { id: 'market', icon: '📈', label: t('marketPricesTitle') }
      ]
    },
    {
      title: getLang() === 'ta' ? 'அரசு உதவி & அவசர எண்கள்' : 'Support & Schemes',
      items: [
        { id: 'schemes', icon: '🏛️', label: t('schemesTitle') },
        { id: 'help-near-me', icon: '🏢', label: t('helpNearMeTitle') },
        { id: 'contacts', icon: '📞', label: t('verifiedContactsTitle') },
        { id: 'notifications', icon: '🔔', label: t('notifications') }
      ]
    },
    {
      title: getLang() === 'ta' ? 'AI & அமைப்புகள்' : 'AI & Settings',
      items: [
        { id: 'ai-assistant', icon: '🤖', label: t('aiAssistantTitle') },
        { id: 'settings', icon: '⚙️', label: t('settingsTitle') },
        { id: 'admin', icon: '🛡️', label: t('adminTitle') }
      ]
    }
  ];

  return `
    <div class="drawer-backdrop" id="closeDrawerBackdrop">
      <div class="drawer-menu-panel" onclick="event.stopPropagation()">
        <div class="drawer-header">
          <div class="drawer-branding">
            <span class="drawer-logo">🌾</span>
            <div>
              <h3>${t('appName')}</h3>
              <p>${t('version')}</p>
            </div>
          </div>
          <button class="drawer-close-btn" id="closeDrawerBtn">&times;</button>
        </div>

        <div class="drawer-scroll-body">
          ${categories.map(cat => `
            <div class="drawer-section">
              <h4 class="drawer-section-title">${cat.title}</h4>
              <div class="drawer-nav-list">
                ${cat.items.map(i => `
                  <button class="drawer-link-btn ${state.page === i.id ? 'active' : ''}" data-goto="${i.id}">
                    <span class="drawer-link-icon">${i.icon}</span>
                    <span class="drawer-link-text">${i.label}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="drawer-footer">
          <button class="btn-emergency-call" onclick="window.location.href='tel:18001801551'">
            📞 ${t('emergencyCall')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderSearchModal() {
  if (!state.searchModalOpen) return '';

  const q = state.searchQuery.trim().toLowerCase();
  let matchedCrops = [];
  let matchedSchemes = [];
  let matchedMarkets = [];

  if (q.length >= 2) {
    matchedCrops = CROPS.filter(c => c.en.toLowerCase().includes(q) || c.ta.includes(q)).slice(0, 4);
    matchedSchemes = GOVT_SCHEMES.filter(s => s.nameEn.toLowerCase().includes(q) || s.nameTa.includes(q)).slice(0, 4);
    matchedMarkets = MANDI_PRICES.filter(m => m.market.toLowerCase().includes(q) || m.cropId.includes(q)).slice(0, 4);
  }

  return `
    <div class="modal-backdrop" id="closeSearchBackdrop">
      <div class="search-dialog" onclick="event.stopPropagation()">
        <div class="search-input-wrap">
          <span class="search-lens-icon">🔍</span>
          <input type="text" id="globalSearchInput" placeholder="${t('searchPlaceholder')}" value="${esc(state.searchQuery)}" autofocus>
          <button class="search-clear-btn" id="clearSearchBtn">&times;</button>
        </div>

        <div class="search-results-container">
          ${q.length < 2 ? `
            <div class="search-suggestions-box">
              <p class="search-hint-title">${t('quickAccess')}:</p>
              <div class="search-chips-row">
                <button class="search-chip" data-search="Paddy">🌾 ${getLang() === 'ta' ? 'நெல்' : 'Paddy'}</button>
                <button class="search-chip" data-search="PM-KISAN">🏛️ PM-KISAN</button>
                <button class="search-chip" data-search="Tomato">🍅 ${getLang() === 'ta' ? 'தக்காளி' : 'Tomato'}</button>
                <button class="search-chip" data-search="Weather">🌦️ ${t('weather')}</button>
                <button class="search-chip" data-search="Mandi">📈 ${t('market')}</button>
              </div>
            </div>
          ` : `
            ${matchedCrops.length === 0 && matchedSchemes.length === 0 && matchedMarkets.length === 0 ? `
              <div class="search-empty-state">
                <p>No matches found for "${esc(state.searchQuery)}"</p>
              </div>
            ` : `
              ${matchedCrops.map(c => `
                <div class="search-result-row" data-action="view-crop" data-crop="${c.id}">
                  <span class="sr-icon">🌱</span>
                  <div>
                    <h4>${esc(cropName(c))}</h4>
                    <p>${esc(c.season)} · ${esc(c.days)} ${t('days')}</p>
                  </div>
                </div>
              `).join('')}
              ${matchedSchemes.map(s => `
                <div class="search-result-row" data-action="view-schemes">
                  <span class="sr-icon">🏛️</span>
                  <div>
                    <h4>${esc(getLang() === 'ta' ? s.nameTa : s.nameEn)}</h4>
                    <p>${esc(s.type)} Scheme</p>
                  </div>
                </div>
              `).join('')}
              ${matchedMarkets.map(m => `
                <div class="search-result-row" data-action="view-market" data-crop="${m.cropId}">
                  <span class="sr-icon">📈</span>
                  <div>
                    <h4>${esc(m.market)}</h4>
                    <p>${esc(m.district)}, ${esc(m.state)} · ${money(m.modal)} ${esc(m.unit)}</p>
                  </div>
                </div>
              `).join('')}
            `}
          `}
        </div>
      </div>
    </div>
  `;
}

function renderEmergencyModal() {
  if (!state.emergencyModalOpen) return '';

  return `
    <div class="modal-backdrop" id="closeEmergencyBackdrop">
      <div class="emergency-dialog" onclick="event.stopPropagation()">
        <div class="emergency-dialog-header">
          <span class="emergency-siren-icon">🚨</span>
          <h3>${t('emergencyHelplines')}</h3>
          <button class="modal-close-btn" id="closeEmergencyBtn">&times;</button>
        </div>

        <div class="emergency-dialog-body">
          ${VERIFIED_CONTACTS.map(c => `
            <div class="emergency-contact-card">
              <div class="ecc-info">
                <h4>${esc(getLang() === 'ta' ? c.nameTa : c.nameEn)}</h4>
                <div class="ecc-hours">${esc(c.hours)}</div>
                <div class="ecc-number">${esc(c.number)}</div>
                <div class="verified-badge-mini">✓ ${t('verified')}</div>
              </div>
              <button class="btn-call-mini" onclick="window.location.href='tel:${c.number.replace(/[^0-9]/g, '')}'">
                📞 ${t('callNow')}
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// 25 PRIMARY SCREENS IMPLEMENTATIONS
// ==========================================================================

// Screen 1: Welcome / Splash
function screenWelcome() {
  return `
    <div class="screen-welcome">
      <div class="welcome-hero-banner">
        <div class="welcome-overlay-glow"></div>
        <div class="welcome-badge">🌱 ${t('appName')}</div>
        <h1 class="welcome-heading">${t('welcomeHeroTitle')}</h1>
        <p class="welcome-desc">${t('welcomeHeroSub')}</p>
      </div>

      <div class="welcome-card-box">
        <div class="lang-selector-group">
          <label class="form-label">${t('preferredLang')}</label>
          <div class="lang-choice-cards">
            <button class="lang-choice-card ${getLang() === 'ta' ? 'active' : ''}" data-lang="ta">
              <span class="flag">🇮🇳</span>
              <strong>தமிழ்</strong>
              <span>தமிழ்நாடு & தென்னிந்தியா</span>
            </button>
            <button class="lang-choice-card ${getLang() === 'en' ? 'active' : ''}" data-lang="en">
              <span class="flag">🌐</span>
              <strong>English</strong>
              <span>All India Farmers</span>
            </button>
          </div>
        </div>

        <button class="btn-primary-large" id="welcomeStartBtn">
          ${t('getStarted')} ➔
        </button>
        <button class="btn-secondary-large" data-goto="login">
          ${t('demoOtp')}
        </button>
      </div>
    </div>
  `;
}

// Screen 2: Dedicated Language Picker
function screenLanguage() {
  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="settings">←</button>
        <h2>${t('languageSelection')}</h2>
      </div>

      <div class="selection-card-list">
        <div class="option-card ${getLang() === 'ta' ? 'active' : ''}" data-lang="ta">
          <div class="option-card-left">
            <span class="option-icon">🇮🇳</span>
            <div>
              <h3>தமிழ் (Tamil)</h3>
              <p>முழு செயலியும் எளிய தமிழில் காண்பிக்கப்படும்</p>
            </div>
          </div>
          ${getLang() === 'ta' ? '<span class="check-tick">✓</span>' : ''}
        </div>

        <div class="option-card ${getLang() === 'en' ? 'active' : ''}" data-lang="en">
          <div class="option-card-left">
            <span class="option-icon">🇬🇧</span>
            <div>
              <h3>English</h3>
              <p>Complete application in standard Indian English</p>
            </div>
          </div>
          ${getLang() === 'en' ? '<span class="check-tick">✓</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

// Screen 3: Login / Registration
function screenLogin() {
  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="welcome">←</button>
        <h2>${t('demoOtp')}</h2>
      </div>

      <div class="card-form-box">
        <div class="auth-icon-circle">📱</div>
        <p class="form-helper-text">${t('welcomeHeroSub')}</p>

        <div class="form-group">
          <label class="form-label">${t('mobile')}</label>
          <div class="input-with-prefix">
            <span class="prefix">+91</span>
            <input type="tel" id="loginMobileInput" value="${esc(state.farmer.mobile)}" placeholder="9876543210" maxlength="10">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">${t('name')}</label>
          <input type="text" id="loginNameInput" value="${esc(state.farmer.farmerName)}" placeholder="Warren Samson">
        </div>

        <button class="btn-primary-large" id="loginSubmitBtn">
          ${t('sendOtp')} ➔
        </button>
      </div>
    </div>
  `;
}

// Screen 4: Farmer Profile (Editable & Complete)
function screenProfile() {
  const f = state.farmer;
  const districts = getDistrictsForState(f.state);
  const taluks = getTaluksForDistrict(f.district);

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('profileTitle')}</h2>
      </div>

      <div class="card-form-box">
        <div class="profile-hero-badge">
          <div class="profile-avatar-icon">👨‍🌾</div>
          <div>
            <h3>${esc(f.farmerName)}</h3>
            <p>📍 ${esc(f.village)}, ${esc(f.district)}, ${esc(f.state)}</p>
          </div>
        </div>

        <form id="profileForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">${t('name')}</label>
            <input type="text" id="profName" value="${esc(f.farmerName)}" required>
          </div>

          <div class="form-group">
            <label class="form-label">${t('mobile')}</label>
            <input type="tel" id="profMobile" value="${esc(f.mobile)}" required>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('state')}</label>
              <select id="profState">
                ${ALL_INDIAN_STATES.map(st => `<option value="${st}" ${f.state === st ? 'selected' : ''}>${st}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('district')}</label>
              <select id="profDistrict">
                ${districts.map(d => `<option value="${d}" ${f.district === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('taluk')}</label>
              <input type="text" id="profTaluk" value="${esc(f.taluk)}" placeholder="e.g. Pennagaram">
            </div>
            <div class="form-group">
              <label class="form-label">${t('village')}</label>
              <input type="text" id="profVillage" value="${esc(f.village)}" placeholder="e.g. Pennagaram West">
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('landSize')}</label>
              <input type="number" step="0.5" id="profLand" value="${f.landSize || 2.5}">
            </div>
            <div class="form-group">
              <label class="form-label">${t('soilType')}</label>
              <select id="profSoil">
                ${SOILS.map(s => `<option value="${s[0]}" ${f.soilType === s[0] ? 'selected' : ''}>${getLang() === 'ta' ? s[1] : s[2]}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${t('irrigationType')}</label>
            <select id="profIrrigation">
              ${WATER_SOURCES.map(w => `<option value="${w[0]}" ${f.irrigationType === w[0] ? 'selected' : ''}>${getLang() === 'ta' ? w[1] : w[2]}</option>`).join('')}
            </select>
          </div>

          <button class="btn-primary-large" id="saveProfileBtn">
            💾 ${t('save')}
          </button>
        </form>
      </div>
    </div>
  `;
}

// Screen 5: Prioritized Home Dashboard (Strictly Requirement #31)
function screenHome() {
  const w = state.weather;
  const cur = w?.current;
  const temp = cur ? Math.round(cur.temperature_2m) : 31;
  const cond = cur ? weatherText(cur.weather_code) : 'Fair Weather';
  const condIcon = cur ? getWeatherIcon(cur.weather_code) : '🌤️';
  const rainProb = w?.daily?.precipitation_probability_max?.[0] || 15;
  const humidity = cur ? cur.relative_humidity_2m : 65;
  const wind = cur ? Math.round(cur.wind_speed_10m) : 8;
  const rainSum = cur?.precipitation || 0;
  const timeAgo = formatTimeAgo(state.weatherTimestamp);

  const alerts = getWeatherAlerts(w);
  const advisories = generateAgriAdvisory(w);
  const myCrop = cropObj(state.selectedCropId);
  const sampleMandi = MANDI_PRICES.find(m => m.district === state.selectedLocation.district) || MANDI_PRICES[0];

  return `
    <div class="dashboard-page">
      <!-- 1. 📍 LOCATION BAR (Top of Dashboard) -->
      <div class="dash-location-strip" data-goto="location">
        <div class="dls-left">
          <span class="dls-pin">📍</span>
          <div>
            <div class="dls-main-title">${esc(formatLocationTitle(state.selectedLocation))}</div>
            <div class="dls-sub">${t('changeLocation')} ➔</div>
          </div>
        </div>
        <button class="btn-gps-mini" id="quickGpsRefresh" title="${t('useGps')}">🛰️ GPS</button>
      </div>

      <!-- 2. 🌦️ LIVE HYPERLOCAL WEATHER HERO CARD -->
      <div class="weather-hero-card" data-goto="weather">
        <div class="wh-top-row">
          <div>
            <div class="wh-temp-big">${temp}°C</div>
            <div class="wh-condition-line">
              <span class="wh-cond-icon">${condIcon}</span>
              <span class="wh-cond-text">${cond}</span>
            </div>
            <div class="wh-feels-like">${t('feelsLike')} ${cur ? Math.round(cur.apparent_temperature) : temp + 2}°C</div>
          </div>
          <div class="wh-refresh-box">
            <button class="btn-weather-refresh ${state.weatherLoading ? 'spinning' : ''}" id="weatherRefreshBtn" title="${t('refresh')}">
              🔄
            </button>
            <span class="wh-time-ago">${timeAgo}</span>
          </div>
        </div>

        <div class="wh-metrics-grid">
          <div class="wh-metric">
            <span class="m-icon">🌧️</span>
            <span class="m-val">${rainProb}%</span>
            <span class="m-lbl">${t('rainChance')}</span>
          </div>
          <div class="wh-metric">
            <span class="m-icon">💧</span>
            <span class="m-val">${humidity}%</span>
            <span class="m-lbl">${t('humidity')}</span>
          </div>
          <div class="wh-metric">
            <span class="m-icon">💨</span>
            <span class="m-val">${wind} km/h</span>
            <span class="m-lbl">${t('wind')}</span>
          </div>
          <div class="wh-metric">
            <span class="m-icon">☀️</span>
            <span class="m-val">${cur?.uv_index !== undefined ? cur.uv_index : 6}</span>
            <span class="m-lbl">${t('uvIndex')}</span>
          </div>
        </div>
        <div class="wh-source-tag">${t('weatherSourceNotice')}</div>
      </div>

      <!-- 3. 🚨 IMPORTANT WEATHER ALERT (When present or primary advisory) -->
      ${alerts.length > 0 ? `
        <div class="weather-alert-card severity-${alerts[0].severity}" data-goto="weather-alerts">
          <div class="wac-header">
            <span class="wac-badge">${alerts[0].badge}</span>
            <span class="wac-time">${timeAgo}</span>
          </div>
          <h4 class="wac-title">${getLang() === 'ta' ? alerts[0].titleTa : alerts[0].titleEn}</h4>
          <p class="wac-msg">${getLang() === 'ta' ? alerts[0].messageTa : alerts[0].messageEn}</p>
        </div>
      ` : `
        <div class="weather-alert-card severity-info" data-goto="weather-alerts">
          <div class="wac-header">
            <span class="wac-badge">💡 ${t('weatherAdvisoryTitle')}</span>
          </div>
          <h4 class="wac-title">${getLang() === 'ta' ? advisories[0].titleTa : advisories[0].titleEn}</h4>
          <p class="wac-msg">${getLang() === 'ta' ? advisories[0].descTa : advisories[0].descEn}</p>
        </div>
      `}

      <!-- 4. 🌱 MY CROPS CARD -->
      <div class="dash-section-card">
        <div class="dsc-header">
          <h3>🌱 ${getLang() === 'ta' ? 'என் பயிர்கள்' : 'My Crops'}</h3>
          <button class="dsc-link-btn" data-goto="crop-library">${t('viewDetails')} ›</button>
        </div>
        <div class="my-crop-active-box" data-goto="crop-details" data-crop="${myCrop.id}">
          <div class="mc-avatar">🌾</div>
          <div class="mc-info">
            <h4>${esc(cropName(myCrop))}</h4>
            <p>${esc(myCrop.season)} · ${esc(myCrop.days)} ${t('days')}</p>
          </div>
          <span class="mc-badge">${esc(myCrop.yield.split(' ')[0])}</span>
        </div>
      </div>

      <!-- 5. 📅 TODAY'S FARMING TASKS -->
      <div class="dash-section-card" data-goto="calendar">
        <div class="dsc-header">
          <h3>📅 ${t('todaysTasks')}</h3>
          <button class="dsc-link-btn" data-goto="calendar">${t('calendar')} ›</button>
        </div>
        <div class="task-preview-box">
          <div class="tpb-checkbox">✓</div>
          <div class="tpb-content">
            <h4>${esc(cropName(myCrop))} — ${getLang() === 'ta' ? myCrop.steps[1].ta : myCrop.steps[1].en}</h4>
            <p>Day ${myCrop.steps[1].day} · ${t('fertilizerGuide')}</p>
          </div>
        </div>
      </div>

      <!-- 6. 🌧️ RAIN FORECAST -->
      <div class="dash-section-card" data-goto="weather">
        <div class="dsc-header">
          <h3>🌧️ ${t('rainfall')} & ${t('rainChance')}</h3>
          <span class="rain-chance-badge">${rainProb}% ${t('rainChance')}</span>
        </div>
        <p class="rain-desc-text">
          ${rainProb > 50 ? t('heavyRainExpected') : t('noRainExpected')}
        </p>
      </div>

      <!-- 7. 💰 LIVE MARKET PRICE TICKER -->
      <div class="dash-section-card" data-goto="market">
        <div class="dsc-header">
          <h3>💰 ${t('marketPrice')}</h3>
          <button class="dsc-link-btn" data-goto="market">${t('all')} Mandis ›</button>
        </div>
        <div class="mandi-ticker-box">
          <div class="mtb-left">
            <span class="mtb-crop">${cropObj(sampleMandi.cropId) ? cropName(cropObj(sampleMandi.cropId)) : 'Crop'}</span>
            <span class="mtb-mandi">${esc(sampleMandi.market)}</span>
          </div>
          <div class="mtb-right">
            <span class="mtb-price">${money(sampleMandi.modal)}</span>
            <span class="mtb-unit">${esc(sampleMandi.unit)}</span>
          </div>
        </div>
        <div class="mandi-source-sub">${esc(sampleMandi.source)} · ${esc(sampleMandi.date)}</div>
      </div>

      <!-- 8. 🦠 CROP HEALTH & DISEASE ALERT -->
      <div class="dash-section-card" data-goto="disease">
        <div class="dsc-header">
          <h3>🦠 ${t('diseaseTitle')}</h3>
          <button class="dsc-link-btn" data-goto="disease">${t('takePhoto')} 📸</button>
        </div>
        <p class="disease-preview-text">
          ${t('diseaseIntro')}
        </p>
      </div>

      <!-- 9. 🏛️ GOVERNMENT SCHEMES SPOTLIGHT -->
      <div class="dash-section-card" data-goto="schemes">
        <div class="dsc-header">
          <h3>🏛️ ${t('schemesTitle')}</h3>
          <button class="dsc-link-btn" data-goto="schemes">${t('viewDetails')} ›</button>
        </div>
        <div class="scheme-spotlight-box">
          <h4>${esc(getLang() === 'ta' ? GOVT_SCHEMES[0].nameTa : GOVT_SCHEMES[0].nameEn)}</h4>
          <p>${esc(getLang() === 'ta' ? GOVT_SCHEMES[0].benefitsTa : GOVT_SCHEMES[0].benefitsEn)}</p>
        </div>
      </div>

      <!-- 10. 🆘 AGRICULTURE HELP NEAR ME -->
      <div class="dash-section-card" data-goto="help-near-me">
        <div class="dsc-header">
          <h3>🆘 ${t('helpNearMeTitle')}</h3>
          <button class="dsc-link-btn" data-goto="help-near-me">${t('all')} ›</button>
        </div>
        <p class="help-preview-sub">
          ${getLang() === 'ta' ? 'உங்கள் மாவட்டத்தில் உள்ள KVK மற்றும் வேளாண் அலுவலகங்களை அணுகவும்' : 'Connect with KVKs, soil test labs & extension officers in your district.'}
        </p>
        <button class="btn-primary-large" onclick="window.location.href='tel:18001801551'">
          📞 ${t('emergencyCall')}
        </button>
      </div>
    </div>
  `;
}

// Screen 6: Location & GPS Management
function screenLocation() {
  const loc = state.selectedLocation;
  const states = ALL_INDIAN_STATES;
  const districts = getDistrictsForState(loc.state);
  const taluks = getTaluksForDistrict(loc.district);

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('locationTitle')}</h2>
      </div>

      <!-- Device GPS Locator -->
      <div class="card-box">
        <h3>🛰️ ${t('useGps')}</h3>
        <p class="helper-note">${t('gpsLocating')}</p>
        <button class="btn-primary-large" id="triggerGpsBtn">
          📍 ${t('useGps')}
        </button>
      </div>

      <!-- Search Box -->
      <div class="card-box">
        <h3>🔍 ${t('search')} Location</h3>
        <input type="text" id="locSearchInput" placeholder="Search District, Taluk or Town..." class="form-input">
        <div id="locSearchResults" class="search-dropdown-list"></div>
      </div>

      <!-- Hierarchical Manual Selector (State -> District -> Taluk -> Village) -->
      <div class="card-box">
        <h3>🗺️ Manual Selection</h3>
        <form id="manualLocForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">${t('selectState')}</label>
            <select id="locStateSelect">
              ${states.map(s => `<option value="${s}" ${loc.state === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">${t('selectDistrict')}</label>
            <select id="locDistrictSelect">
              ${districts.map(d => `<option value="${d}" ${loc.district === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">${t('selectTaluk')}</label>
            <select id="locTalukSelect">
              ${taluks.map(tl => `<option value="${tl}" ${loc.taluk === tl ? 'selected' : ''}>${tl}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">${t('selectVillage')}</label>
            <input type="text" id="locVillageInput" value="${esc(loc.village)}" placeholder="e.g. Pennagaram West">
          </div>

          <button class="btn-primary-large" id="applyLocationBtn">
            ✓ ${t('save')} Location
          </button>
        </form>
      </div>
    </div>
  `;
}

// Screen 7: Live Hyperlocal Weather (Comprehensive)
function screenWeather() {
  const w = state.weather;
  const cur = w?.current;
  const daily = w?.daily;
  const hourly = w?.hourly;
  const temp = cur ? Math.round(cur.temperature_2m) : 31;
  const cond = cur ? weatherText(cur.weather_code) : 'Fair Weather';
  const condIcon = cur ? getWeatherIcon(cur.weather_code) : '🌤️';
  const windDir = cur ? getWindDirection(cur.wind_direction_10m) : 'NE';
  const advisories = generateAgriAdvisory(w);

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('liveWeather')}</h2>
        <button class="btn-header-action" id="weatherRefreshBtn2">🔄</button>
      </div>

      <!-- Current Conditions Card -->
      <div class="weather-hero-card">
        <div class="wh-top-row">
          <div>
            <div class="wh-temp-big">${temp}°C</div>
            <div class="wh-condition-line">
              <span class="wh-cond-icon">${condIcon}</span>
              <span class="wh-cond-text">${cond}</span>
            </div>
            <div class="wh-feels-like">${t('feelsLike')} ${cur ? Math.round(cur.apparent_temperature) : temp + 2}°C</div>
          </div>
          <div class="wh-location-badge">
            📍 ${esc(state.selectedLocation.district)}
          </div>
        </div>

        <div class="weather-details-table">
          <div class="wdt-row"><span>${t('humidity')}:</span><strong>${cur?.relative_humidity_2m || 65}%</strong></div>
          <div class="wdt-row"><span>${t('rainChance')}:</span><strong>${daily?.precipitation_probability_max?.[0] || 15}%</strong></div>
          <div class="wdt-row"><span>${t('rainfall')}:</span><strong>${cur?.precipitation || 0} mm</strong></div>
          <div class="wdt-row"><span>${t('wind')}:</span><strong>${cur ? Math.round(cur.wind_speed_10m) : 8} km/h (${windDir})</strong></div>
          <div class="wdt-row"><span>${t('cloudCover')}:</span><strong>${cur?.cloud_cover || 20}%</strong></div>
          <div class="wdt-row"><span>${t('uvIndex')}:</span><strong>${cur?.uv_index || 6}</strong></div>
          <div class="wdt-row"><span>${t('surfacePressure')}:</span><strong>${Math.round(cur?.surface_pressure || 1012)} hPa</strong></div>
          <div class="wdt-row"><span>${t('sunrise')} / ${t('sunset')}:</span><strong>${daily?.sunrise?.[0]?.split('T')[1] || '06:05'} / ${daily?.sunset?.[0]?.split('T')[1] || '18:15'}</strong></div>
        </div>

        <div class="wh-source-tag">${t('weatherSourceNotice')} · ${formatTimeAgo(state.weatherTimestamp)}</div>
      </div>

      <!-- Agricultural Advisory -->
      <div class="card-box">
        <div class="card-box-header">
          <h3>🌾 ${t('weatherAdvisoryTitle')}</h3>
          <button class="btn-voice-listen" id="listenAdvisoryBtn">
            ${state.isSpeaking ? '⏹️ ' + t('stopVoice') : '🔊 ' + t('listenVoice')}
          </button>
        </div>
        ${advisories.map(adv => `
          <div class="advisory-item-card type-${adv.type}">
            <div class="aic-icon">${adv.icon}</div>
            <div class="aic-text">
              <h4>${getLang() === 'ta' ? adv.titleTa : adv.titleEn}</h4>
              <p>${getLang() === 'ta' ? adv.descTa : adv.descEn}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- 24-Hour Hourly Forecast -->
      ${hourly ? `
        <div class="card-box">
          <h3>⏱️ ${t('hourlyForecast')}</h3>
          <div class="hourly-scroll-strip">
            ${hourly.time.slice(0, 12).map((timeStr, idx) => {
              const hour = timeStr.split('T')[1].slice(0, 5);
              const hTemp = Math.round(hourly.temperature_2m[idx]);
              const hProb = hourly.precipitation_probability[idx];
              const hCode = hourly.weather_code[idx];
              return `
                <div class="hourly-item-pill">
                  <span class="hip-time">${hour}</span>
                  <span class="hip-icon">${getWeatherIcon(hCode)}</span>
                  <span class="hip-temp">${hTemp}°</span>
                  <span class="hip-rain">💧${hProb}%</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 7-Day Extended Forecast -->
      ${daily ? `
        <div class="card-box">
          <h3>📅 ${t('weeklyForecast')}</h3>
          <div class="daily-forecast-list">
            ${daily.time.map((dateStr, idx) => {
              const dObj = new Date(dateStr);
              const dayName = dObj.toLocaleDateString(getLang() === 'ta' ? 'ta-IN' : 'en-IN', { weekday: 'short' });
              const minT = Math.round(daily.temperature_2m_min[idx]);
              const maxT = Math.round(daily.temperature_2m_max[idx]);
              const dCode = daily.weather_code[idx];
              const dProb = daily.precipitation_probability_max[idx];
              const dSum = daily.precipitation_sum[idx];

              return `
                <div class="daily-forecast-row">
                  <div class="dfr-day">${dayName} <small>${dateStr.slice(5)}</small></div>
                  <div class="dfr-icon">${getWeatherIcon(dCode)}</div>
                  <div class="dfr-rain">💧${dProb}% (${dSum}mm)</div>
                  <div class="dfr-temps">
                    <strong>${maxT}°</strong> / <span>${minT}°</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Screen 8: Weather Alerts & Warnings
function screenWeatherAlerts() {
  const alerts = getWeatherAlerts(state.weather);
  const advisories = generateAgriAdvisory(state.weather);

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="weather">←</button>
        <h2>${t('severeAlert')}</h2>
      </div>

      ${alerts.length === 0 ? `
        <div class="card-box text-center">
          <span style="font-size: 44px;">☀️</span>
          <h3>${t('noRainExpected')}</h3>
          <p>${t('advFavorable')}</p>
        </div>
      ` : ''}

      ${alerts.map(a => `
        <div class="weather-alert-card severity-${a.severity}">
          <div class="wac-header">
            <span class="wac-badge">${a.badge}</span>
            <span class="wac-time">${t('lastUpdated')}: ${formatTimeAgo(state.weatherTimestamp)}</span>
          </div>
          <h3 class="wac-title">${getLang() === 'ta' ? a.titleTa : a.titleEn}</h3>
          <p class="wac-msg">${getLang() === 'ta' ? a.messageTa : a.messageEn}</p>
        </div>
      `).join('')}

      <div class="card-box">
        <h3>💡 ${t('weatherAdvisoryTitle')}</h3>
        ${advisories.map(adv => `
          <div class="advisory-item-card type-${adv.type}">
            <div class="aic-icon">${adv.icon}</div>
            <div class="aic-text">
              <h4>${getLang() === 'ta' ? adv.titleTa : adv.titleEn}</h4>
              <p>${getLang() === 'ta' ? adv.descTa : adv.descEn}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Screen 9: AI Crop Recommendation
function screenCropRecommend() {
  const res = state.cropRecommendResult;

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('cropRecommendTitle')}</h2>
      </div>

      <div class="card-box">
        <p class="helper-note">${t('cropRecommendIntro')}</p>

        <form id="cropRecForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">${t('soilType')}</label>
            <select id="recSoil">
              ${SOILS.map(s => `<option value="${s[0]}" ${state.farmer.soilType === s[0] ? 'selected' : ''}>${getLang() === 'ta' ? s[1] : s[2]}</option>`).join('')}
            </select>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('waterAvailability')}</label>
              <select id="recWater">
                ${WATER_SOURCES.map(w => `<option value="${w[0]}" ${state.farmer.irrigationType === w[0] ? 'selected' : ''}>${getLang() === 'ta' ? w[1] : w[2]}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('season')}</label>
              <select id="recSeason">
                ${SEASONS.map(sn => `<option value="${sn[0]}">${getLang() === 'ta' ? sn[1] : sn[2]}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('soilPh')}</label>
              <select id="recPh">
                <option value="neutral">Neutral (6.5 – 7.5)</option>
                <option value="acidic">Acidic (< 6.5)</option>
                <option value="alkaline">Alkaline (> 7.5)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('soilNitrogen')}</label>
              <select id="recN">
                <option value="medium">Medium</option>
                <option value="low">Low (Deficient)</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${t('previousCrop')}</label>
            <input type="text" id="recPrevCrop" placeholder="e.g. Paddy / Fallow">
          </div>

          <button class="btn-primary-large" id="runCropRecommendBtn">
            ✨ ${t('getAiRecommendation')}
          </button>
        </form>
      </div>

      <!-- Results Display -->
      ${res ? `
        <div class="card-box">
          <h3>🎯 ${t('recommendedCropsList')}</h3>
          <p class="expert-disclaimer-tag">⚠️ ${t('aiDisclaimerNotice')}</p>

          ${res.map(c => `
            <div class="crop-rec-result-card" data-goto="crop-details" data-crop="${c.id}">
              <div class="crrc-header">
                <h4>🌾 ${esc(cropName(c))}</h4>
                <span class="crrc-duration">${esc(c.days)} ${t('days')}</span>
              </div>
              <div class="crrc-reason">
                <strong>${t('whySuitable')}:</strong>
                <p>${getLang() === 'ta' ? esc(c.reasonTa) : esc(c.reasonEn)}</p>
              </div>
              <div class="crrc-specs-grid">
                <div><span>${t('waterRequirement')}:</span> <strong>${esc(c.waterReq.split(' ')[0])}</strong></div>
                <div><span>${t('cultivationCost')}:</span> <strong>${money(c.budget)}</strong></div>
                <div><span>${t('expectedYield')}:</span> <strong>${esc(c.yield)}</strong></div>
                <div><span>${t('marketPrice')}:</span> <strong>${esc(c.price)}</strong></div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Screen 10: Soil Analysis
function screenSoilAnalysis() {
  const r = state.soilAnalysisResult;

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('soilAnalysisTitle')}</h2>
      </div>

      <div class="card-box">
        <h3>🧪 ${t('manualEntry')}</h3>
        <form id="soilAnalysisForm" onsubmit="return false;">
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('soilType')}</label>
              <select id="soilFormType">
                ${SOILS.map(s => `<option value="${s[0]}">${getLang() === 'ta' ? s[1] : s[2]}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('phLevel')} (pH)</label>
              <input type="number" step="0.1" id="soilFormPh" value="6.8" min="3" max="11">
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">${t('soilNitrogen')} (N)</label>
              <input type="number" id="soilFormN" value="240" placeholder="kg/ha">
            </div>
            <div class="form-group">
              <label class="form-label">${t('soilPhosphorus')} (P)</label>
              <input type="number" id="soilFormP" value="18" placeholder="kg/ha">
            </div>
            <div class="form-group">
              <label class="form-label">${t('soilPotassium')} (K)</label>
              <input type="number" id="soilFormK" value="280" placeholder="kg/ha">
            </div>
          </div>

          <button class="btn-primary-large" id="analyzeSoilBtn">
            🔍 ${t('analyzeSoil')}
          </button>
        </form>
      </div>

      <!-- Upload Section -->
      <div class="card-box">
        <h3>📄 ${t('uploadReport')}</h3>
        <input type="file" id="soilReportFile" accept="image/*,application/pdf" class="file-picker-input">
        <p class="helper-note">${t('soilPhotoDisclaimer')}</p>
      </div>

      <!-- Analysis Results -->
      ${r ? `
        <div class="card-box">
          <h3>📋 ${t('soilHealthSummary')}</h3>
          <div class="soil-metric-pill ${r.phStatus}">
            <strong>pH: ${r.ph}</strong> — ${r.phLabel}
          </div>
          <div class="soil-recommendation-block">
            <h4>${t('fertilizerGuide')}:</h4>
            <p>${r.recommendation}</p>
          </div>
          <div class="suitable-crops-box">
            <h4>${t('crops')}:</h4>
            <div class="crops-chip-list">
              ${r.suitableCrops.map(cId => `
                <span class="badge-chip" data-goto="crop-details" data-crop="${cId}">${cropName(cropObj(cId))}</span>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Screen 11: Indian Crop Library
function screenCropLibrary() {
  const cat = state.activeCropFilter;
  const filtered = cat === 'all' ? CROPS : CROPS.filter(c => c.category === cat);

  const categories = [
    { id: 'all', label: t('all') },
    { id: 'cereal', label: getLang() === 'ta' ? 'தானியங்கள்' : 'Cereals' },
    { id: 'pulse', label: getLang() === 'ta' ? 'பயறு வகை' : 'Pulses' },
    { id: 'vegetable', label: getLang() === 'ta' ? 'காய்கறிகள்' : 'Vegetables' },
    { id: 'cash', label: getLang() === 'ta' ? 'பணப்பயிர்' : 'Cash Crops' },
    { id: 'oilseed', label: getLang() === 'ta' ? 'எண்ணெய் வித்து' : 'Oilseeds' },
    { id: 'spice', label: getLang() === 'ta' ? 'நறுமணப் பயிர்' : 'Spices' },
    { id: 'plantation', label: getLang() === 'ta' ? 'தோட்டக்கலை' : 'Plantation' }
  ];

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('cropLibraryTitle')}</h2>
      </div>

      <!-- Filter Chips -->
      <div class="category-scroll-bar">
        ${categories.map(c => `
          <button class="cat-pill-btn ${cat === c.id ? 'active' : ''}" data-cropcat="${c.id}">
            ${c.label}
          </button>
        `).join('')}
      </div>

      <!-- Crop Cards Grid -->
      <div class="crop-cards-grid">
        ${filtered.map(c => `
          <div class="crop-grid-card" data-goto="crop-details" data-crop="${c.id}">
            <div class="cgc-top">
              <span class="cgc-icon">🌾</span>
              <span class="cgc-duration">${c.days} ${t('days')}</span>
            </div>
            <h3 class="cgc-title">${esc(cropName(c))}</h3>
            <p class="cgc-season">📅 ${esc(c.season)}</p>
            <div class="cgc-yield">${esc(c.yield)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Screen 12: Crop Details (Complete Agronomy)
function screenCropDetails() {
  const c = cropObj(state.selectedCropId);

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="crop-library">←</button>
        <h2>${esc(cropName(c))}</h2>
        <button class="btn-header-action" data-goto="crop-compare" data-compare="${c.id}">⚖️ ${t('compare')}</button>
      </div>

      <!-- Hero Summary Card -->
      <div class="crop-hero-detail-card">
        <div class="chdc-badge">🌾 ${esc(c.category).toUpperCase()}</div>
        <h3>${esc(cropName(c))}</h3>
        <p class="chdc-reason">${getLang() === 'ta' ? esc(c.reasonTa) : esc(c.reasonEn)}</p>
        <div class="chdc-metric-row">
          <div><span>${t('growingPeriod')}:</span><strong>${c.days} ${t('days')}</strong></div>
          <div><span>${t('cultivationCost')}:</span><strong>${money(c.budget)} / acre</strong></div>
          <div><span>${t('expectedYield')}:</span><strong>${esc(c.yield)}</strong></div>
        </div>
      </div>

      <!-- Agronomy Information Sections -->
      <div class="card-box">
        <h3>🌱 ${t('suitableSoil')} & ${t('climate')}</h3>
        <p><strong>${t('suitableSoil')}:</strong> ${c.soils.join(', ')}</p>
        <p><strong>${t('climate')}:</strong> ${esc(c.climate)}</p>
        <p><strong>${t('waterRequirement')}:</strong> ${esc(c.waterReq)}</p>
      </div>

      <div class="card-box">
        <h3>🧪 ${t('fertilizerGuide')}</h3>
        <p>${esc(c.fertilizer)}</p>
      </div>

      <div class="card-box">
        <h3>🐛 ${t('commonPests')} & ${t('commonDiseases')}</h3>
        <div class="pest-bullet-list">
          <p><strong>${t('commonPests')}:</strong></p>
          <ul>${c.pests.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <p><strong>${t('commonDiseases')}:</strong></p>
          <ul>${c.diseases.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="card-box">
        <h3>📦 ${t('harvestingStorage')}</h3>
        <p><strong>${t('days')} & Maturity:</strong> ${esc(c.harvesting)}</p>
        <p><strong>Storage:</strong> ${esc(c.storage)}</p>
      </div>

      <div class="card-box">
        <h3>📅 ${t('cultivationSteps')}</h3>
        <div class="steps-timeline">
          ${c.steps.map(s => `
            <div class="step-item">
              <div class="step-badge">Day ${s.day}</div>
              <div class="step-desc">${getLang() === 'ta' ? esc(s.ta) : esc(s.en)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn-primary-large" data-goto="calendar" data-crop="${c.id}">
        📅 ${t('calendarTitle')}
      </button>
    </div>
  `;
}

// Screen 13: Crop Comparison
function screenCropCompare() {
  const c1 = cropObj(state.compareCrops[0] || 'paddy');
  const c2 = cropObj(state.compareCrops[1] || 'groundnut');

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="crop-library">←</button>
        <h2>${t('cropComparisonTitle')}</h2>
      </div>

      <p class="helper-note">${t('comparisonTip')}</p>

      <div class="compare-selector-row">
        <select id="compCrop1">
          ${CROPS.map(c => `<option value="${c.id}" ${c.id === c1.id ? 'selected' : ''}>${cropName(c)}</option>`).join('')}
        </select>
        <span>VS</span>
        <select id="compCrop2">
          ${CROPS.map(c => `<option value="${c.id}" ${c.id === c2.id ? 'selected' : ''}>${cropName(c)}</option>`).join('')}
        </select>
      </div>

      <div class="compare-table-card">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>${t('compare')}</th>
              <th>${cropName(c1)}</th>
              <th>${cropName(c2)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${t('growingPeriod')}</td>
              <td><strong>${c1.days} ${t('days')}</strong></td>
              <td><strong>${c2.days} ${t('days')}</strong></td>
            </tr>
            <tr>
              <td>${t('waterRequirement')}</td>
              <td>${esc(c1.waterReq.split(' ')[0])}</td>
              <td>${esc(c2.waterReq.split(' ')[0])}</td>
            </tr>
            <tr>
              <td>${t('cultivationCost')}</td>
              <td>${money(c1.budget)}</td>
              <td>${money(c2.budget)}</td>
            </tr>
            <tr>
              <td>${t('expectedYield')}</td>
              <td>${esc(c1.yield)}</td>
              <td>${esc(c2.yield)}</td>
            </tr>
            <tr>
              <td>${t('marketPrice')}</td>
              <td>${esc(c1.price)}</td>
              <td>${esc(c2.price)}</td>
            </tr>
            <tr>
              <td>${t('sowingSeason')}</td>
              <td>${esc(c1.season)}</td>
              <td>${esc(c2.season)}</td>
            </tr>
            <tr>
              <td>${t('suitableSoil')}</td>
              <td>${c1.soils.join(', ')}</td>
              <td>${c2.soils.join(', ')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Screen 14: AI Crop Disease Detection
function screenDisease() {
  const res = state.diseaseScanResult;

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('diseaseTitle')}</h2>
      </div>

      <div class="card-box">
        <p class="helper-note">${t('diseaseIntro')}</p>

        <div class="form-group">
          <label class="form-label">${t('crops')}</label>
          <select id="diseaseCropSelect">
            ${CROPS.map(c => `<option value="${c.id}">${cropName(c)}</option>`).join('')}
          </select>
        </div>

        <div class="photo-upload-zone" id="diseaseDropZone">
          <div class="puz-icon">📷</div>
          <p><strong>${t('takePhoto')}</strong> or <strong>${t('uploadPhoto')}</strong></p>
          <input type="file" id="diseaseFileInput" accept="image/*" class="file-picker-input">
        </div>

        <button class="btn-primary-large" id="runDiseaseAiBtn">
          🔍 ${t('analyzingImage').split('...')[0]}
        </button>
      </div>

      <!-- Result View -->
      ${res ? `
        <div class="card-box">
          <div class="disease-res-header">
            <span class="drh-badge">Confidence: ${res.confidence}%</span>
            <h3>${getLang() === 'ta' ? esc(res.nameTa) : esc(res.nameEn)}</h3>
          </div>

          <div class="warning-alert-box">
            ⚠️ ${t('expertWarning')}
          </div>

          <div class="dr-section">
            <h4>${t('symptoms')}:</h4>
            <p>${getLang() === 'ta' ? esc(res.symptomsTa) : esc(res.symptomsEn)}</p>
          </div>

          <div class="dr-section">
            <h4>${t('possibleCauses')}:</h4>
            <p>${getLang() === 'ta' ? esc(res.causeTa) : esc(res.causeEn)}</p>
          </div>

          <div class="dr-section">
            <h4>${t('prevention')}:</h4>
            <p>${getLang() === 'ta' ? esc(res.preventionTa) : esc(res.preventionEn)}</p>
          </div>

          <div class="dr-section">
            <h4>${t('treatment')}:</h4>
            <p>${getLang() === 'ta' ? esc(res.treatmentTa) : esc(res.treatmentEn)}</p>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Screen 15: Personalized Farming Calendar
function screenCalendar() {
  const c = cropObj(state.selectedCropId);
  const taskMap = loadCalendarTaskStatus(c.id);
  const sowingDate = state.calendarSowingDate || new Date().toISOString().split('T')[0];

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('calendarTitle')}</h2>
      </div>

      <div class="card-box">
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">${t('crops')}</label>
            <select id="calCropSelect">
              ${CROPS.map(cr => `<option value="${cr.id}" ${cr.id === c.id ? 'selected' : ''}>${cropName(cr)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${t('sowingDate')}</label>
            <input type="date" id="calSowingInput" value="${sowingDate}">
          </div>
        </div>
      </div>

      <div class="calendar-timeline-list">
        ${c.steps.map((step, idx) => {
          const isDone = Boolean(taskMap[idx]);
          const stepDate = new Date(new Date(sowingDate).getTime() + step.day * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

          return `
            <div class="cal-step-card ${isDone ? 'done' : ''}">
              <div class="csc-left">
                <input type="checkbox" class="cal-checkbox" data-crop="${c.id}" data-step="${idx}" ${isDone ? 'checked' : ''}>
                <div>
                  <div class="csc-date">Day ${step.day} · ${stepDate}</div>
                  <h4 class="csc-title">${getLang() === 'ta' ? esc(step.ta) : esc(step.en)}</h4>
                </div>
              </div>
              <button class="btn-reminder-bell" title="${t('addReminder')}">🔔</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Screen 16: Smart Irrigation Guidance
function screenIrrigation() {
  const w = state.weather;
  const rainProb = w?.daily?.precipitation_probability_max?.[0] || 15;
  const temp = w?.current?.temperature_2m || 32;
  const c = cropObj(state.selectedCropId);

  const shouldIrrigate = rainProb < 40 && temp >= 28;

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('irrigationTitle')}</h2>
      </div>

      <!-- Decision Hero -->
      <div class="card-box ${shouldIrrigate ? 'border-lime' : 'border-blue'}">
        <span class="irrigation-hero-icon">${shouldIrrigate ? '💧' : '🌧️'}</span>
        <h3>${shouldIrrigate ? t('irrigateRecommended') : t('doNotIrrigate')}</h3>
        <p class="helper-note">${t('soilMoistureTip')}</p>
      </div>

      <div class="card-box">
        <h3>🌾 ${cropName(c)} — ${t('waterRequirement')}</h3>
        <p><strong>Total Requirement:</strong> ${esc(c.waterReq)}</p>
        <p><strong>Current Temperature:</strong> ${Math.round(temp)}°C</p>
        <p><strong>Rain Forecast:</strong> ${rainProb}% precipitation probability</p>
      </div>

      <div class="card-box">
        <h3>💡 ${getLang() === 'ta' ? 'பாசன மேலாண்மை குறிப்புகள்' : 'Irrigation Best Practices'}</h3>
        <ul class="bullet-list">
          <li>${getLang() === 'ta' ? 'சொட்டு நீர் பாசனம் மூலம் 40-50% தண்ணீரை சேமிக்கலாம்.' : 'Drip irrigation saves 40-50% water and increases fertilizer use efficiency.'}</li>
          <li>${getLang() === 'ta' ? 'மதிய வெயிலில் பாசனம் செய்வதை தவிர்க்கவும்.' : 'Avoid flood irrigation during hot midday sun to minimize root shock.'}</li>
          <li>${getLang() === 'ta' ? 'அறுவடைக்கு 10-14 நாட்கள் முன் பாசனத்தை நிறுத்தவும்.' : 'Withhold irrigation 10-14 days prior to harvest for uniform ripening.'}</li>
        </ul>
      </div>
    </div>
  `;
}

// Screen 17: Cost & Profit Calculator
function screenCalculator() {
  const history = loadSavedCalculations();

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('calculatorTitle')}</h2>
      </div>

      <div class="card-box">
        <p class="helper-note">${t('calcIntro')}</p>

        <form id="calcForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">${t('acres')}</label>
            <input type="number" step="0.5" id="calcArea" value="${state.farmer.landSize || 2}">
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('seedCost')}</label>
              <input type="number" id="calcSeed" value="3500">
            </div>
            <div class="form-group">
              <label class="form-label">${t('fertilizerCost')}</label>
              <input type="number" id="calcFert" value="6200">
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('pesticideCost')}</label>
              <input type="number" id="calcPest" value="2800">
            </div>
            <div class="form-group">
              <label class="form-label">${t('laborCost')}</label>
              <input type="number" id="calcLabor" value="12000">
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('machineryCost')}</label>
              <input type="number" id="calcMach" value="5000">
            </div>
            <div class="form-group">
              <label class="form-label">${t('transportCost')}</label>
              <input type="number" id="calcTrans" value="2500">
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">${t('expectedYieldQty')}</label>
              <input type="number" id="calcYield" value="25">
            </div>
            <div class="form-group">
              <label class="form-label">${t('expectedSellingPrice')}</label>
              <input type="number" id="calcPrice" value="2300">
            </div>
          </div>

          <button class="btn-primary-large" id="computeProfitBtn">
            🧮 ${t('calculateProfit')}
          </button>
        </form>
      </div>

      <!-- Financial Calculation Output -->
      <div id="calcResultsCard" class="card-box" style="display:none;">
        <h3>📊 Financial Summary</h3>
        <div class="calc-metrics-grid">
          <div class="calc-metric-cell">
            <span>${t('totalInvestment')}</span>
            <strong id="resTotalCost">₹0</strong>
          </div>
          <div class="calc-metric-cell">
            <span>${t('expectedGrossRevenue')}</span>
            <strong id="resTotalRev">₹0</strong>
          </div>
          <div class="calc-metric-cell profit-cell">
            <span>${t('estimatedNetProfit')}</span>
            <strong id="resNetProfit">₹0</strong>
          </div>
          <div class="calc-metric-cell">
            <span>${t('roiPercentage')}</span>
            <strong id="resRoi">0%</strong>
          </div>
        </div>

        <button class="btn-primary-large" id="saveCalcBtn">
          💾 ${t('saveCalculation')}
        </button>
      </div>

      <!-- Saved History -->
      ${history.length > 0 ? `
        <div class="card-box">
          <h3>📂 ${t('savedCalculations')}</h3>
          <div class="saved-calc-list">
            ${history.map(item => `
              <div class="saved-calc-item">
                <div>
                  <strong>${esc(item.cropName || 'Farm Plan')} (${item.acres} ${t('acres')})</strong>
                  <p>Inv: ${money(item.investment)} · Net: <span class="${item.profit >= 0 ? 'text-lime' : 'text-danger'}">${money(item.profit)}</span> (${item.timestamp})</p>
                </div>
                <button class="btn-del-mini" data-delcalc="${item.id}">&times;</button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Screen 18: Mandi Market Prices
function screenMarket() {
  const selectedState = state.selectedLocation.state;
  const filtered = MANDI_PRICES.filter(m => m.state === selectedState || m.district === state.selectedLocation.district);
  const displayList = filtered.length > 0 ? filtered : MANDI_PRICES;

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('marketPricesTitle')}</h2>
      </div>

      <p class="helper-note">${t('marketIntro')}</p>

      <div class="mandi-cards-list">
        ${displayList.map(m => {
          const c = cropObj(m.cropId);
          return `
            <div class="mandi-price-card">
              <div class="mpc-top">
                <div>
                  <h3>${esc(cropName(c))}</h3>
                  <p class="mpc-mandi-name">📍 ${esc(m.market)}, ${esc(m.district)}</p>
                </div>
                <span class="mpc-unit-badge">${esc(m.unit)}</span>
              </div>

              <div class="mpc-prices-grid">
                <div class="mpc-col">
                  <span>${t('minPrice')}</span>
                  <strong>${money(m.min)}</strong>
                </div>
                <div class="mpc-col modal-col">
                  <span>${t('modalPrice')}</span>
                  <strong>${money(m.modal)}</strong>
                </div>
                <div class="mpc-col">
                  <span>${t('maxPrice')}</span>
                  <strong>${money(m.max)}</strong>
                </div>
              </div>

              <div class="mpc-footer">
                <span>${esc(m.source)}</span>
                <span>${esc(m.date)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Screen 19: Government Agriculture Schemes
function screenSchemes() {
  const filter = state.activeSchemeFilter;
  const list = filter === 'all' ? GOVT_SCHEMES : GOVT_SCHEMES.filter(s => s.type.toLowerCase().includes(filter));

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('schemesTitle')}</h2>
      </div>

      <div class="category-scroll-bar">
        <button class="cat-pill-btn ${filter === 'all' ? 'active' : ''}" data-schemefilter="all">${t('all')}</button>
        <button class="cat-pill-btn ${filter === 'central' ? 'active' : ''}" data-schemefilter="central">Central Govt</button>
        <button class="cat-pill-btn ${filter === 'state' ? 'active' : ''}" data-schemefilter="state">State Govt</button>
      </div>

      <div class="schemes-list">
        ${list.map(s => `
          <div class="scheme-card">
            <div class="scheme-type-tag">${esc(s.type)}</div>
            <h3>${esc(getLang() === 'ta' ? s.nameTa : s.nameEn)}</h3>

            <div class="sc-block">
              <strong>${t('benefits')}:</strong>
              <p>${esc(getLang() === 'ta' ? s.benefitsTa : s.benefitsEn)}</p>
            </div>

            <div class="sc-block">
              <strong>${t('eligibility')}:</strong>
              <p>${esc(getLang() === 'ta' ? s.eligibilityTa : s.eligibilityEn)}</p>
            </div>

            <div class="sc-block">
              <strong>${t('requiredDocs')}:</strong>
              <p>${esc(getLang() === 'ta' ? s.docsTa : s.docsEn)}</p>
            </div>

            <div class="sc-footer">
              <a href="${s.link}" target="_blank" rel="noopener" class="btn-official-link">
                🌐 ${t('officialLink')} ➔
              </a>
              <span class="sc-updated">${t('lastUpdated')}: ${s.updated}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Screen 20: Nearby Agriculture Help Near Me
function screenHelpNearMe() {
  const currentDistrict = state.selectedLocation.district;
  const filtered = NEARBY_HELP_CENTERS.filter(h => h.district === currentDistrict);
  const displayList = filtered.length > 0 ? filtered : NEARBY_HELP_CENTERS;

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('helpNearMeTitle')}</h2>
      </div>

      <p class="helper-note">${t('helpIntro')}</p>

      <div class="help-centers-list">
        ${displayList.map(h => `
          <div class="help-center-card">
            <div class="hcc-category">${esc(h.category)}</div>
            <h3>${esc(getLang() === 'ta' ? h.nameTa : h.nameEn)}</h3>
            <p class="hcc-address">📍 ${esc(getLang() === 'ta' ? h.addressTa : h.addressEn)}</p>
            <p class="hcc-hours">🕐 ${esc(h.hours)}</p>

            <div class="hcc-actions">
              <button class="btn-call-action" onclick="window.location.href='tel:${h.phone}'">
                📞 ${t('callNow')} (${esc(h.phone)})
              </button>
              <button class="btn-dir-action" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}','_blank')">
                🗺️ ${t('getDirections')}
              </button>
            </div>
            <div class="verified-footer">✓ ${t('verified')} · ${h.updated}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Screen 21: Verified Government Contacts & Helplines
function screenContacts() {
  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('verifiedContactsTitle')}</h2>
      </div>

      <div class="contacts-grid">
        ${VERIFIED_CONTACTS.map(c => `
          <div class="contact-card">
            <div class="cc-badge">✓ ${t('verified')}</div>
            <h3>${esc(getLang() === 'ta' ? c.nameTa : c.nameEn)}</h3>
            <div class="cc-number">${esc(c.number)}</div>
            <p class="cc-desc">${esc(c.descEn)}</p>
            <p class="cc-hours">🕐 ${esc(c.hours)}</p>

            <button class="btn-primary-large" onclick="window.location.href='tel:${c.number.replace(/[^0-9]/g, '')}'">
              📞 ${t('callNow')}
            </button>
            <div class="cc-source">${esc(c.source)} · ${c.updated}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Screen 22: Smart Alerts & Notifications Center
function screenNotifications() {
  const alerts = getWeatherAlerts(state.weather);
  const announcements = loadAdminAnnouncements();

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('notifications')}</h2>
      </div>

      <!-- Weather Alerts Section -->
      <div class="card-box">
        <h3>🌦️ Weather & Field Alerts</h3>
        ${alerts.length > 0 ? alerts.map(a => `
          <div class="notif-row severity-${a.severity}">
            <span class="notif-icon">⚠️</span>
            <div>
              <h4>${getLang() === 'ta' ? a.titleTa : a.titleEn}</h4>
              <p>${getLang() === 'ta' ? a.messageTa : a.messageEn}</p>
            </div>
          </div>
        `).join('') : `
          <p class="helper-note">${t('noRainExpected')}</p>
        `}
      </div>

      <!-- Official Department Broadcasts -->
      <div class="card-box">
        <h3>🏛️ Agriculture Department Announcements</h3>
        ${announcements.map(ann => `
          <div class="notif-row">
            <span class="notif-icon">📢</span>
            <div>
              <h4>${getLang() === 'ta' ? ann.titleTa : ann.titleEn}</h4>
              <p>${getLang() === 'ta' ? ann.messageTa : ann.messageEn}</p>
              <small>${ann.date} · ${ann.author || 'Agri Dept'}</small>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Screen 23: Ask Agriculture AI Assistant
function screenAiAssistant() {
  return `
    <div class="page-container ai-chat-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('aiAssistantTitle')}</h2>
      </div>

      <p class="helper-note">${t('aiAssistantIntro')}</p>

      <!-- Chat History -->
      <div class="ai-chat-messages" id="aiChatBox">
        ${state.aiMessages.map(msg => `
          <div class="chat-bubble ${msg.sender}">
            <div class="chat-bubble-content">
              ${esc(getLang() === 'ta' && msg.textTa ? msg.textTa : msg.textEn)}
            </div>
            ${msg.sender === 'ai' ? `
              <button class="btn-listen-mini" onclick="window.speakAiText('${esc(getLang() === 'ta' && msg.textTa ? msg.textTa : msg.textEn)}')">
                🔊 Listen
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Quick Chips -->
      <div class="smart-chips-box">
        <div class="chips-scroll">
          <button class="chip-btn" data-aiprompt="${t('chip1')}">${t('chip1')}</button>
          <button class="chip-btn" data-aiprompt="${t('chip2')}">${t('chip2')}</button>
          <button class="chip-btn" data-aiprompt="${t('chip3')}">${t('chip3')}</button>
          <button class="chip-btn" data-aiprompt="${t('chip4')}">${t('chip4')}</button>
        </div>
      </div>

      <!-- Input Bar -->
      <div class="ai-input-bar">
        <input type="text" id="aiInputText" placeholder="${t('askPlaceholder')}">
        <button class="ai-send-btn" id="sendAiBtn">➔</button>
      </div>
      <div class="ai-disclaimer-sub">⚠️ ${t('aiConfidenceNotice')}</div>
    </div>
  `;
}

// Screen 24: Application Settings
function screenSettings() {
  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>${t('settingsTitle')}</h2>
      </div>

      <div class="card-box">
        <h3>🌐 ${t('languageSelection')}</h3>
        <div class="lang-choice-cards">
          <button class="lang-choice-card ${getLang() === 'ta' ? 'active' : ''}" data-lang="ta">
            <span class="flag">🇮🇳</span>
            <strong>தமிழ் (Tamil)</strong>
          </button>
          <button class="lang-choice-card ${getLang() === 'en' ? 'active' : ''}" data-lang="en">
            <span class="flag">🌐</span>
            <strong>English</strong>
          </button>
        </div>
      </div>

      <div class="card-box">
        <h3>👨‍🌾 ${t('profileTitle')}</h3>
        <p>${state.farmer.farmerName} · ${state.farmer.district}, ${state.farmer.state}</p>
        <button class="btn-primary-large" data-goto="profile">
          ✏️ ${t('edit')}
        </button>
      </div>

      <div class="card-box">
        <h3>💾 Local Storage & Offline</h3>
        <p class="helper-note">${t('storageNotice')}</p>
        <button class="btn-danger-large" id="clearAllDataBtn">
          🗑️ ${t('clearData')}
        </button>
      </div>
    </div>
  `;
}

// Screen 25: Admin Dashboard
function screenAdmin() {
  const announcements = loadAdminAnnouncements();

  return `
    <div class="page-container">
      <div class="page-header-bar">
        <button class="btn-back" data-goto="home">←</button>
        <h2>🛡️ ${t('adminTitle')}</h2>
      </div>

      <div class="card-box">
        <h3>📢 ${t('publishAnnouncement')}</h3>
        <form id="adminAnnounceForm" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">Announcement Title (English)</label>
            <input type="text" id="adminAnnTitleEn" placeholder="e.g. Free Soil Health Camp" required>
          </div>
          <div class="form-group">
            <label class="form-label">தலைப்பு (தமிழ்)</label>
            <input type="text" id="adminAnnTitleTa" placeholder="எ.கா: இலவச மண் பரிசோதனை முகாம்" required>
          </div>
          <div class="form-group">
            <label class="form-label">${t('announcementText')}</label>
            <textarea id="adminAnnMsg" rows="3" placeholder="Full announcement details..." required></textarea>
          </div>
          <button class="btn-primary-large" id="submitAnnBtn">
            📢 ${t('publishAnnouncement')}
          </button>
        </form>
      </div>

      <div class="card-box">
        <h3>📋 Published Announcements</h3>
        ${announcements.map(ann => `
          <div class="admin-ann-item">
            <h4>${esc(ann.titleEn)} / ${esc(ann.titleTa)}</h4>
            <p>${esc(ann.messageEn)}</p>
            <small>${ann.date} · ${ann.author || 'Admin'}</small>
          </div>
        `).join('')}
      </div>

      <div class="card-box">
        <h3>👨‍🌾 ${t('registeredFarmers')}</h3>
        <div class="admin-farmer-card">
          <p><strong>Name:</strong> ${esc(state.farmer.farmerName)}</p>
          <p><strong>Phone:</strong> ${esc(state.farmer.mobile)}</p>
          <p><strong>Location:</strong> ${esc(state.farmer.village)}, ${esc(state.farmer.district)}, ${esc(state.farmer.state)}</p>
          <p><strong>Land:</strong> ${state.farmer.landSize} acres (${state.farmer.soilType} soil)</p>
          <p><strong>${t('auditTimestamp')}:</strong> ${state.farmer.registeredDate || '15 Sep 2026'}</p>
        </div>
      </div>
    </div>
  `;
}

// Router dispatcher
function renderPage() {
  switch (state.page) {
    case 'welcome': return screenWelcome();
    case 'language': return screenLanguage();
    case 'login': return screenLogin();
    case 'profile': return screenProfile();
    case 'home': return screenHome();
    case 'location': return screenLocation();
    case 'weather': return screenWeather();
    case 'weather-alerts': return screenWeatherAlerts();
    case 'crop-recommend': return screenCropRecommend();
    case 'soil-analysis': return screenSoilAnalysis();
    case 'crop-library': return screenCropLibrary();
    case 'crop-details': return screenCropDetails();
    case 'crop-compare': return screenCropCompare();
    case 'disease': return screenDisease();
    case 'calendar': return screenCalendar();
    case 'irrigation': return screenIrrigation();
    case 'calculator': return screenCalculator();
    case 'market': return screenMarket();
    case 'schemes': return screenSchemes();
    case 'help-near-me': return screenHelpNearMe();
    case 'contacts': return screenContacts();
    case 'notifications': return screenNotifications();
    case 'ai-assistant': return screenAiAssistant();
    case 'settings': return screenSettings();
    case 'admin': return screenAdmin();
    case 'more':
      state.drawerOpen = true;
      return screenHome();
    default:
      return screenHome();
  }
}

// Main Render
function render() {
  root.innerHTML = `
    <div class="app-shell">
      ${renderHeader()}
      <main class="app-main">
        ${renderPage()}
      </main>
      ${renderBottomNav()}
      ${renderDrawer()}
      ${renderSearchModal()}
      ${renderEmergencyModal()}
      ${state.toastMessage ? `<div class="toast-popup">${esc(state.toastMessage)}</div>` : ''}
    </div>
  `;
}

// Global hook for speech synthesis from markup onclick
window.speakAiText = function (text) {
  speakText(text);
};

// ==========================================================================
// EVENT HANDLERS & DELEGATION
// ==========================================================================
function bindEvents() {
  document.addEventListener('click', async e => {
    const target = e.target;

    // 1. Navigation clicks
    const gotoBtn = target.closest('[data-goto]');
    if (gotoBtn) {
      const pageId = gotoBtn.getAttribute('data-goto');
      const cropId = gotoBtn.getAttribute('data-crop');
      go(pageId, { cropId });
      return;
    }

    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
      const navId = navBtn.getAttribute('data-nav');
      if (navId === 'more') {
        state.drawerOpen = true;
        render();
      } else {
        go(navId);
      }
      return;
    }

    // 2. Drawer actions
    if (target.closest('#openDrawerBtn')) {
      state.drawerOpen = true;
      render();
      return;
    }
    if (target.closest('#closeDrawerBtn') || target.id === 'closeDrawerBackdrop') {
      state.drawerOpen = false;
      render();
      return;
    }

    // 3. Search actions
    if (target.closest('#openSearchBtn')) {
      state.searchModalOpen = true;
      render();
      setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 100);
      return;
    }
    if (target.closest('#clearSearchBtn')) {
      state.searchQuery = '';
      render();
      return;
    }
    if (target.id === 'closeSearchBackdrop') {
      state.searchModalOpen = false;
      render();
      return;
    }
    const searchChip = target.closest('.search-chip');
    if (searchChip) {
      state.searchQuery = searchChip.getAttribute('data-search');
      render();
      return;
    }
    const searchResult = target.closest('.search-result-row');
    if (searchResult) {
      const action = searchResult.getAttribute('data-action');
      const cId = searchResult.getAttribute('data-crop');
      if (action === 'view-crop') go('crop-details', { cropId: cId });
      if (action === 'view-schemes') go('schemes');
      if (action === 'view-market') go('market');
      return;
    }

    // 4. Emergency call modal
    if (target.closest('#openEmergencyBtn')) {
      state.emergencyModalOpen = true;
      render();
      return;
    }
    if (target.closest('#closeEmergencyBtn') || target.id === 'closeEmergencyBackdrop') {
      state.emergencyModalOpen = false;
      render();
      return;
    }

    // 5. Language Switcher
    if (target.closest('#toggleLangBtn')) {
      const nextLang = getLang() === 'ta' ? 'en' : 'ta';
      setLang(nextLang);
      state.farmer.preferredLang = nextLang;
      saveProfile(state.farmer);
      render();
      return;
    }
    const langBtn = target.closest('[data-lang]');
    if (langBtn) {
      const chosen = langBtn.getAttribute('data-lang');
      setLang(chosen);
      state.farmer.preferredLang = chosen;
      saveProfile(state.farmer);
      render();
      return;
    }

    // 6. Header Location Click
    if (target.closest('#headerLocationBtn')) {
      go('location');
      return;
    }

    // 7. Weather Refresh
    if (target.closest('#weatherRefreshBtn') || target.closest('#weatherRefreshBtn2')) {
      await fetchCurrentWeather(true);
      showToast(t('refresh') + ' ✓');
      return;
    }

    // 8. Device GPS Trigger
    if (target.closest('#triggerGpsBtn') || target.closest('#quickGpsRefresh')) {
      showToast(t('gpsLocating'));
      try {
        const coords = await getCurrentGPSLocation();
        const geo = await reverseGeocode(coords.lat, coords.lon);
        state.selectedLocation = {
          state: geo.state,
          district: geo.district,
          taluk: geo.taluk || '',
          village: geo.village || '',
          lat: coords.lat,
          lon: coords.lon
        };
        state.farmer.state = geo.state;
        state.farmer.district = geo.district;
        state.farmer.taluk = geo.taluk;
        state.farmer.village = geo.village;
        saveProfile(state.farmer);
        showToast(t('gpsSuccess'));
        await fetchCurrentWeather(true);
      } catch (err) {
        showToast(err.message || t('gpsDenied'));
      }
      return;
    }

    // 9. Crop Category Filter
    const cropCatBtn = target.closest('[data-cropcat]');
    if (cropCatBtn) {
      state.activeCropFilter = cropCatBtn.getAttribute('data-cropcat');
      render();
      return;
    }

    // 10. Scheme Filter
    const schemeFilterBtn = target.closest('[data-schemefilter]');
    if (schemeFilterBtn) {
      state.activeSchemeFilter = schemeFilterBtn.getAttribute('data-schemefilter');
      render();
      return;
    }

    // 11. Welcome Start Button
    if (target.closest('#welcomeStartBtn')) {
      state.farmer.started = true;
      saveProfile(state.farmer);
      go('home');
      return;
    }

    // 12. Save Profile Button
    if (target.closest('#saveProfileBtn')) {
      const name = document.getElementById('profName')?.value.trim();
      const mobile = document.getElementById('profMobile')?.value.trim();
      const st = document.getElementById('profState')?.value;
      const dist = document.getElementById('profDistrict')?.value;
      const taluk = document.getElementById('profTaluk')?.value.trim();
      const village = document.getElementById('profVillage')?.value.trim();
      const land = Number(document.getElementById('profLand')?.value) || 2;
      const soil = document.getElementById('profSoil')?.value;
      const irr = document.getElementById('profIrrigation')?.value;

      state.farmer = {
        ...state.farmer,
        farmerName: name || state.farmer.farmerName,
        mobile: mobile || state.farmer.mobile,
        state: st,
        district: dist,
        taluk,
        village,
        landSize: land,
        soilType: soil,
        irrigationType: irr
      };
      saveProfile(state.farmer);

      state.selectedLocation.state = st;
      state.selectedLocation.district = dist;
      state.selectedLocation.taluk = taluk;
      state.selectedLocation.village = village;
      const coords = DISTRICT_COORDINATES[dist];
      if (coords) {
        state.selectedLocation.lat = coords.lat;
        state.selectedLocation.lon = coords.lon;
      }

      showToast(t('profileSavedSuccess'));
      go('home');
      fetchCurrentWeather(true);
      return;
    }

    // 13. AI Crop Recommendation Runner
    if (target.closest('#runCropRecommendBtn')) {
      const soil = document.getElementById('recSoil')?.value || 'red';
      const water = document.getElementById('recWater')?.value || 'limited';

      // Match crops based on soil and water
      let matches = CROPS.filter(c => c.soils.includes(soil));
      if (matches.length < 2) matches = CROPS.slice(0, 3);
      state.cropRecommendResult = matches.slice(0, 3);
      render();
      return;
    }

    // 14. Soil Analysis Runner
    if (target.closest('#analyzeSoilBtn')) {
      const ph = Number(document.getElementById('soilFormPh')?.value) || 6.8;
      const n = Number(document.getElementById('soilFormN')?.value) || 240;
      const p = Number(document.getElementById('soilFormP')?.value) || 18;
      const k = Number(document.getElementById('soilFormK')?.value) || 280;

      let phLabel = 'Neutral (Optimal for most crops)';
      let phStatus = 'status-success';
      if (ph < 6.0) {
        phLabel = 'Acidic (Apply Agricultural Lime / Dolomite)';
        phStatus = 'status-warning';
      } else if (ph > 7.8) {
        phLabel = 'Alkaline (Apply Gypsum 500 kg/ha & Farmyard Manure)';
        phStatus = 'status-warning';
      }

      let rec = `Nitrogen is ${n < 280 ? 'Low (Apply additional 25 kg Urea in splits)' : 'Sufficient'}. `;
      rec += `Phosphorus is ${p < 20 ? 'Moderate (Add DAP 50 kg/acre)' : 'Good'}. `;
      rec += `Potassium is ${k < 200 ? 'Low (Apply MOP 30 kg/acre)' : 'High'}.`;

      state.soilAnalysisResult = {
        ph,
        phLabel,
        phStatus,
        recommendation: rec,
        suitableCrops: ['paddy', 'groundnut', 'tomato', 'maize']
      };
      render();
      return;
    }

    // 15. AI Disease Detector Runner
    if (target.closest('#runDiseaseAiBtn')) {
      showToast(t('analyzingImage'));
      const cropVal = document.getElementById('diseaseCropSelect')?.value || 'tomato';

      setTimeout(() => {
        const found = PLANT_DISEASES.find(d => d.crop.toLowerCase().includes(cropVal)) || PLANT_DISEASES[0];
        state.diseaseScanResult = found;
        render();
      }, 1200);
      return;
    }

    // 16. Cost & Profit Compute
    if (target.closest('#computeProfitBtn')) {
      const area = Number(document.getElementById('calcArea')?.value) || 1;
      const seed = Number(document.getElementById('calcSeed')?.value) || 0;
      const fert = Number(document.getElementById('calcFert')?.value) || 0;
      const pest = Number(document.getElementById('calcPest')?.value) || 0;
      const labor = Number(document.getElementById('calcLabor')?.value) || 0;
      const mach = Number(document.getElementById('calcMach')?.value) || 0;
      const trans = Number(document.getElementById('calcTrans')?.value) || 0;
      const yieldQty = Number(document.getElementById('calcYield')?.value) || 0;
      const price = Number(document.getElementById('calcPrice')?.value) || 0;

      const totalCost = (seed + fert + pest + labor + mach + trans) * area;
      const grossRev = yieldQty * price * area;
      const netProfit = grossRev - totalCost;
      const roi = totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : 0;

      const resBox = document.getElementById('calcResultsCard');
      if (resBox) {
        resBox.style.display = 'block';
        document.getElementById('resTotalCost').innerText = money(totalCost);
        document.getElementById('resTotalRev').innerText = money(grossRev);
        const profitEl = document.getElementById('resNetProfit');
        profitEl.innerText = money(netProfit);
        profitEl.className = netProfit >= 0 ? 'text-lime' : 'text-danger';
        document.getElementById('resRoi').innerText = `${roi}%`;
      }

      state.lastComputedCalc = {
        cropName: cropName(cropObj(state.selectedCropId)),
        acres: area,
        investment: totalCost,
        revenue: grossRev,
        profit: netProfit,
        roi
      };
      return;
    }

    // 17. Save Calculation
    if (target.closest('#saveCalcBtn')) {
      if (state.lastComputedCalc) {
        saveCalculation(state.lastComputedCalc);
        showToast('Calculation saved to device!');
        render();
      }
      return;
    }

    // Delete Calculation
    const delCalcBtn = target.closest('[data-delcalc]');
    if (delCalcBtn) {
      const id = delCalcBtn.getAttribute('data-delcalc');
      deleteCalculation(id);
      render();
      return;
    }

    // 18. Calendar Checkbox Toggle
    const calCheckbox = target.closest('.cal-checkbox');
    if (calCheckbox) {
      const cId = calCheckbox.getAttribute('data-crop');
      const stepIdx = calCheckbox.getAttribute('data-step');
      toggleCalendarTask(cId, stepIdx, calCheckbox.checked);
      render();
      return;
    }

    // 19. Clear All Data
    if (target.closest('#clearAllDataBtn')) {
      if (confirm('Are you sure you want to reset all farm preferences and stored history?')) {
        clearAllLocalData();
        state.farmer = { ...loadProfile() };
        showToast(t('dataCleared'));
        go('welcome');
      }
      return;
    }

    // 20. AI Assistant Send
    if (target.closest('#sendAiBtn')) {
      const inp = document.getElementById('aiInputText');
      const q = inp?.value.trim();
      if (q) handleAiQuestion(q);
      return;
    }

    const aiPromptChip = target.closest('[data-aiprompt]');
    if (aiPromptChip) {
      const q = aiPromptChip.getAttribute('data-aiprompt');
      handleAiQuestion(q);
      return;
    }

    // 21. Admin Announcement Submit
    if (target.closest('#submitAnnBtn')) {
      const titleEn = document.getElementById('adminAnnTitleEn')?.value.trim();
      const titleTa = document.getElementById('adminAnnTitleTa')?.value.trim();
      const msg = document.getElementById('adminAnnMsg')?.value.trim();

      if (titleEn && msg) {
        saveAdminAnnouncement({
          titleEn,
          titleTa: titleTa || titleEn,
          messageEn: msg,
          messageTa: msg,
          author: 'District Agriculture Office'
        });
        showToast('Announcement broadcasted!');
        render();
      }
      return;
    }
  });

  // Input change for search and filters
  document.addEventListener('input', e => {
    if (e.target.id === 'globalSearchInput') {
      state.searchQuery = e.target.value;
      render();
    }
  });

  // Location selector change handlers
  document.addEventListener('change', e => {
    if (e.target.id === 'locStateSelect') {
      const newState = e.target.value;
      state.selectedLocation.state = newState;
      const districts = getDistrictsForState(newState);
      state.selectedLocation.district = districts[0] || 'District';
      render();
    }
    if (e.target.id === 'locDistrictSelect') {
      const newDist = e.target.value;
      state.selectedLocation.district = newDist;
      const coords = DISTRICT_COORDINATES[newDist];
      if (coords) {
        state.selectedLocation.lat = coords.lat;
        state.selectedLocation.lon = coords.lon;
      }
      render();
    }
    if (e.target.id === 'compCrop1') {
      state.compareCrops[0] = e.target.value;
      render();
    }
    if (e.target.id === 'compCrop2') {
      state.compareCrops[1] = e.target.value;
      render();
    }
  });
}

// AI Question Handler (Context-Aware)
function handleAiQuestion(q) {
  state.aiMessages.push({ sender: 'user', textEn: q, textTa: q });

  let answerEn = "For your field conditions in " + state.selectedLocation.district + ", " +
    "ensure adequate soil moisture and consult your local KVK for verified recommendations.";
  let answerTa = state.selectedLocation.district + " மாவட்டத்தில் உள்ள உங்கள் நிலத்தின் மண் மற்றும் பாசனத்திற்கு, " +
    "சரியான ஈரப்பதத்தை பராமரித்து வேளாண் விரிவாக்க அலுவலரை அணுகவும்.";

  const qLower = q.toLowerCase();

  if (qLower.includes('crop') || qLower.includes('பயிர்') || qLower.includes('red soil') || qLower.includes('செம்மண்')) {
    answerEn = "For red soil with moderate water in " + state.selectedLocation.district + ", Groundnut (Peanut), Maize, and Tomato are highly profitable choices with 90–110 days duration.";
    answerTa = state.selectedLocation.district + " மாவட்ட செம்மண் நிலத்திற்கு நிலக்கடலை, மக்காச்சோளம் மற்றும் தக்காளி பயிரிடுவது குறைந்த நாளில் அதிக லாபம் தரும்.";
  } else if (qLower.includes('leaf curl') || qLower.includes('இலை சுருட்டு') || qLower.includes('chilli') || qLower.includes('மிளகாய்')) {
    answerEn = "Chilli leaf curl is spread by Whitefly pests. Place yellow sticky traps (10/acre) and spray 5% Neem Seed Kernel Extract (NSKE) or Diafenthiuron. Avoid excess nitrogen.";
    answerTa = "மிளகாயில் இலை சுருட்டு நோய் வெள்ளை ஈ மூலம் பரவுகிறது. ஏக்கருக்கு 10 மஞ்சள் வண்ண ஒட்டுப்பொறிகள் வைத்து, 5% வேப்பங்கொட்டை கரைசல் அல்லது டயாபெந்தியூரான் தெளிக்கவும்.";
  } else if (qLower.includes('rain') || qLower.includes('மழை') || qLower.includes('irrigate') || qLower.includes('பாசனம்')) {
    const rainProb = state.weather?.daily?.precipitation_probability_max?.[0] || 15;
    if (rainProb > 45) {
      answerEn = `Rain is forecasted (${rainProb}% probability). Postpone irrigation and fertilizer spraying today to avoid water wastage.`;
      answerTa = `மழை பெய்ய ${rainProb}% வாய்ப்புள்ளது. உரம் மற்றும் பூச்சிக்கொல்லி தெளிப்பதையும் பாசனத்தையும் இன்று தள்ளிப்போடவும்.`;
    } else {
      answerEn = "Weather is clear with low chance of rain. You may safely irrigate your fields during early morning or evening.";
      answerTa = "மழை வாய்ப்பு குறைவு, வானிலை தெளிவாக உள்ளது. காலை அல்லது மாலை வேளையில் பாசனம் செய்வது உகந்தது.";
    }
  } else if (qLower.includes('subsidy') || qLower.includes('மானியம்') || qLower.includes('drip') || qLower.includes('சொட்டு நீர்')) {
    answerEn = "Under PMKSY (Pradhan Mantri Krishi Sinchayee Yojana), small and marginal farmers get up to 100% subsidy for drip and sprinkler systems. Register at your Block Horticulture Office with Patta, Chitta, and Well certificate.";
    answerTa = "பிரதம மந்திரி நுண்ணீர் பாசனத் திட்டத்தின் கீழ் (PMKSY) சிறு, குறு விவசாயிகளுக்கு 100% மானியத்தில் சொட்டு நீர் பாசனம் வழங்கப்படுகிறது. பட்டா, சிட்டா மற்றும் கிணறு சான்றிதழுடன் தோட்டக்கலை அலுவலகத்தை அணுகவும்.";
  }

  state.aiMessages.push({ sender: 'ai', textEn: answerEn, textTa: answerTa });
  render();

  setTimeout(() => {
    const box = document.getElementById('aiChatBox');
    if (box) box.scrollTop = box.scrollHeight;
  }, 50);
}

// Initial Bootstrap
async function initApp() {
  bindEvents();
  render();
  await fetchCurrentWeather();
}

initApp();
