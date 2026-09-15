import {CROPS,DISTRICTS,SOILS,WATER,STATES} from './data.js';
import {getLang,setLang,t} from './i18n.js';
import {loadSettings,saveSettings,clearSettings} from './storage.js';
import {getWeather,weatherText} from './weather.js';

const root = document.getElementById('root');
const saved = loadSettings();

let state = {
  page: saved.started ? 'home' : 'welcome',
  started: Boolean(saved.started),
  farmerName: saved.farmerName || 'Warren',
  state: 'Tamil Nadu',
  district: saved.district || 'Dharmapuri',
  soil: saved.soil || 'red',
  water: saved.water || 'limited',
  budget: saved.budget || 25000,
  area: saved.area || 1,
  crop: saved.crop || '',
  selectedCrop: saved.selectedCrop || 'paddy',
  activeCategory: 'all',
  waterLevel: saved.waterLevel || 28.8,
  workers: 48,
  totalAcres: saved.area ? Math.round(Number(saved.area) * 100) : 848,
  weather: null,
  weatherLoading: false,
  showWaterModal: false,
  showNotificationModal: false,
  toastMessage: '',
  expenses: {seeds: 0, fertilizerCost: 0, labor: 0, irrigation: 0, pest: 0, machinery: 0, other: 0},
  ...saved
};

state.state = 'Tamil Nadu';
state.district = state.district || 'Dharmapuri';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const val = id => document.getElementById(id)?.value ?? '';
const money = n => '₹' + Math.max(0, Number(n) || 0).toLocaleString('en-IN');
const cropName = c => (getLang() === 'ta' ? c.ta : c.en);
const label = (arr, key) => {
  const x = arr.find(a => a[0] === key);
  return x ? (getLang() === 'ta' ? x[1] : x[2]) : key;
};
const currentCrop = () =>
  CROPS.find(c => c.id === (state.crop || state.selectedCrop)) ||
  CROPS.find(c => c.id === 'paddy') ||
  CROPS[0];

function save() {
  saveSettings({
    ...state,
    page: undefined,
    weather: undefined,
    showWaterModal: false,
    showNotificationModal: false,
    toastMessage: '',
    started: true
  });
}

function go(page) {
  state.page = page;
  save();
  render();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function showToast(msg) {
  state.toastMessage = msg;
  render();
  setTimeout(() => {
    state.toastMessage = '';
    render();
  }, 3000);
}

// Mobile Mockup Status Bar
function statusBar() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  return `
    <div class="mobile-status-bar">
      <span>${timeStr}</span>
      <div class="status-icons">
        <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z"/></svg>
        <svg viewBox="0 0 24 24"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z"/></svg>
        <svg viewBox="0 0 24 24"><path d="M17 4h-3V2h-4v2H7v18h10V4z"/></svg>
      </div>
    </div>
  `;
}

// SCREEN 1: Welcome Screen
function welcome() {
  return `
    <section class="welcome-screen">
      <div class="welcome-bg">
        <img src="./assets/farmer_hero_3d.jpg" alt="Farmer in Field" onerror="this.src='https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1000&q=85'">
      </div>
      <div class="welcome-gradient-overlay"></div>
      ${statusBar()}
      <div class="welcome-content">
        <div class="welcome-eyebrow">🌱 SMART AGRICULTURE</div>
        <h1 class="welcome-title">Control Every<br>Field with Ease</h1>
        <p class="welcome-subtitle">
          Smart farming brings modern technology into agriculture, helping farmers manage their fields with greater efficiency and precision.
        </p>
        <button class="btn-lime" id="getStarted">
          Get Started
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <div class="welcome-lang-bar">
          <button data-wlang="en" class="${getLang() === 'en' ? 'active' : ''}">English</button>
          <span>•</span>
          <button data-wlang="ta" class="${getLang() === 'ta' ? 'active' : ''}">தமிழ்</button>
        </div>
      </div>
    </section>
  `;
}

// Weather Hero Card (Screen 2)
function weatherHero() {
  const d = state.weather;
  const temp = d ? Math.round(d.temperature_2m) : 34;
  const condition = d ? weatherText(d.weather_code) : 'Scattered Showers';
  const humidity = d ? d.relative_humidity_2m : 88;
  const wind = d ? Math.round(d.wind_speed_10m) : 3;

  return `
    <div class="weather-hero-card">
      <div class="weather-hero-top">
        <div class="weather-temp-wrap">
          <div class="weather-temp">${temp}°</div>
          <div class="weather-location-sub">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
            ${esc(state.district)} Region · ${condition}
          </div>
        </div>
        <div class="weather-icon-illustration" id="weatherRefresh" title="Refresh Weather" style="cursor:pointer">
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M22 40h24a12 12 0 0 0 2-23.8A16 16 0 0 0 18 20a10 10 0 0 0 4 20z" stroke="#d9f345" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="rgba(217, 243, 69, 0.15)"/>
            <path d="M24 46l-2 8M32 46l-2 8M40 46l-2 8" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round"/>
          </svg>
        </div>
      </div>

      <div class="weather-metrics-bar">
        <div class="metric-col" title="Wind Speed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
          <span>${wind} km/h</span>
        </div>
        <div class="metric-col" title="Humidity">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          <span>${humidity}%</span>
        </div>
        <div class="metric-col" title="Precipitation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 19v2m8-2v2m-4-2v2M4 14a4 4 0 0 1 .8-7.92A7 7 0 0 1 18.5 7.1 5 5 0 0 1 20 14"/></svg>
          <span>5 mm</span>
        </div>
        <div class="metric-col" title="Apparent Temperature">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
          <span>+24°c</span>
        </div>
      </div>
    </div>
  `;
}

// Category Filter Chips
function categoryChips() {
  const categories = [
    {id: 'all', label: 'All'},
    {id: 'fruit', label: 'Fruit'},
    {id: 'orchards', label: 'Orchards'},
    {id: 'grain', label: 'Grain'},
    {id: 'vegetables', label: 'Vegetables'}
  ];

  return `
    <div class="category-filter-bar">
      ${categories.map(c => `
        <button class="filter-chip ${state.activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
          ${c.label}
        </button>
      `).join('')}
    </div>
  `;
}

// SCREEN 2: Home Screen
function home() {
  const c = currentCrop();
  return `
    <div class="home-page">
      <header class="home-header">
        <div class="home-user-info">
          <h2>Hello, ${esc(state.farmerName)}</h2>
          <div class="home-location-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
            ${esc(state.district)}, Tamil Nadu
          </div>
        </div>
        <div class="header-actions">
          <button class="glass-icon-btn" id="openNotifications" title="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="badge-dot"></span>
          </button>
          <button class="glass-icon-btn" data-page="settings" title="Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </header>

      ${weatherHero()}
      ${categoryChips()}

      <div class="section-title-row">
        <h3>My Fields</h3>
        <button data-page="calendar">View Details ›</button>
      </div>

      <div class="fields-container">
        <!-- Field Card 1 -->
        <div class="field-preview-card" data-page="calendar" data-crop="${c.id}">
          <div class="field-thumb-circle">
            <img src="./assets/aerial_farm_field.jpg" alt="Aerial Field" onerror="this.src='https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80'">
          </div>
          <div class="field-info">
            <h4>My Fields</h4>
            <p>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
              ${esc(state.district)}, TN · ${esc(cropName(c))}
            </p>
          </div>
          <div class="yield-badge-pill">7200kg/ha</div>
        </div>

        <!-- Field Card 2 -->
        <div class="field-preview-card" data-page="calendar" data-crop="tomato">
          <div class="field-thumb-circle">
            <img src="./assets/farm_barn_scenery.jpg" alt="Farm Barn" onerror="this.src='https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=600&q=80'">
          </div>
          <div class="field-info">
            <h4>My Farm</h4>
            <p>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
              ${esc(state.district)}, TN · ${state.area || 1} Acres
            </p>
          </div>
          <div class="yield-badge-pill">7800kg/ha</div>
        </div>
      </div>

      <div class="section-title-row">
        <h3>Smart Tools</h3>
      </div>

      <div class="quick-tools-grid">
        <button class="tool-chip-btn" data-page="land">
          <div class="tool-icon-wrap">🌿</div>
          <span>Farm Setup</span>
        </button>
        <button class="tool-chip-btn" data-page="calendar">
          <div class="tool-icon-wrap">▣</div>
          <span>Analytics</span>
        </button>
        <button class="tool-chip-btn" data-page="fertilizer">
          <div class="tool-icon-wrap">🧪</div>
          <span>Fertilizer</span>
        </button>
        <button class="tool-chip-btn" data-page="disease">
          <div class="tool-icon-wrap">🐞</div>
          <span>Disease AI</span>
        </button>
        <button class="tool-chip-btn" data-page="expense">
          <div class="tool-icon-wrap">▦</div>
          <span>Expenses</span>
        </button>
        <button class="tool-chip-btn" data-page="market">
          <div class="tool-icon-wrap">₹</div>
          <span>Mandi Price</span>
        </button>
        <button class="tool-chip-btn" data-page="crops">
          <div class="tool-icon-wrap">🌾</div>
          <span>All Crops</span>
        </button>
        <button class="tool-chip-btn" data-page="settings">
          <div class="tool-icon-wrap">⚙️</div>
          <span>Profile</span>
        </button>
      </div>

      <div class="farmer-tip-card">
        <div class="tip-bulb-icon">💡</div>
        <div class="tip-content">
          <b>Today's Smart Farming Tip</b>
          <p>${t('tip1')}</p>
        </div>
      </div>
    </div>
  `;
}

// SCREEN 3: Field Details & Analytics
function calendar() {
  const c = currentCrop();
  const days = Math.max(1, Number(c.days) || 100);
  const currentDay = Math.round(days * 0.38);
  const isLowWater = state.waterLevel < 35;

  return `
    <div class="field-detail-screen">
      <div class="field-cover-hero">
        <img src="./assets/aerial_farm_field.jpg" alt="Aerial Farm Fields" onerror="this.src='https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1000&q=85'">
        <div class="cover-overlay-gradient"></div>
        <div class="cover-top-bar">
          <button class="back-btn" data-page="home">‹</button>
          <div class="weather-chip-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9f345" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
            34° · ${esc(state.district)}
          </div>
        </div>
      </div>

      <!-- Two Stats Cards (Workers & Acres) -->
      <div class="analytics-two-grid">
        <!-- My Farm (Workers Card) -->
        <div class="stat-glass-card">
          <div class="stat-card-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span>My Farm</span>
          </div>
          <div class="stat-gauge-wrap">
            <svg class="stat-gauge-svg" viewBox="0 0 36 36">
              <path class="stat-gauge-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="stat-gauge-circle-val" stroke-dasharray="68, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
          </div>
          <div>
            <div class="stat-label-sub">Workers</div>
            <div class="stat-num-val">${state.workers}</div>
          </div>
        </div>

        <!-- Farm Acres Card -->
        <div class="stat-glass-card">
          <div class="stat-card-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span>Farm Acres</span>
          </div>
          <div class="acres-thumb-wrap">
            <img src="./assets/farm_barn_scenery.jpg" alt="Farm Cottage" onerror="this.src='https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=600&q=80'">
          </div>
          <div>
            <div class="stat-label-sub">Acres</div>
            <div class="stat-num-val">${state.totalAcres}</div>
          </div>
        </div>
      </div>

      <!-- Water Management Card (Prominent Radial Arc Gauge) -->
      <div class="water-management-card">
        <div class="water-card-head">
          <div class="water-title-wrap">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            <span>Water</span>
          </div>
          <span class="water-status-pill" style="${isLowWater ? 'color:#ff9800;border-color:rgba(255,152,0,0.4);background:rgba(255,152,0,0.15);' : 'color:#4ade80;border-color:rgba(74,222,128,0.4);background:rgba(74,222,128,0.15);'}">
            ${isLowWater ? 'Dangerous low' : 'Optimal Level'}
          </span>
        </div>

        <div class="water-body-row">
          <div class="water-gauge-container">
            <svg class="water-arc-svg" viewBox="0 0 100 100">
              <circle class="water-arc-track" cx="50" cy="50" r="38"/>
              <circle class="water-arc-fill" cx="50" cy="50" r="38" style="stroke-dashoffset: ${Math.round(210 - (state.waterLevel / 100) * 170)}; stroke: ${isLowWater ? '#d9f345' : '#38bdf8'}"/>
            </svg>
            <div class="water-gauge-text">
              <div class="water-gauge-val">${state.waterLevel}%</div>
              <div class="water-gauge-label">Moisture</div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            <p style="font-size:11.5px; color:var(--text-sub); text-align:right; max-width:160px; line-height:1.4;">
              ${isLowWater ? 'Soil moisture critically low. Irrigation recommended before evening.' : 'Moisture is healthy. Next cycle in 24 hours.'}
            </p>
            <button class="btn-watering-pill" id="triggerWatering">
              <span>+</span> Watering
            </button>
          </div>
        </div>
      </div>

      <!-- Growth Stages & Timeline -->
      <div class="crop-stages-card">
        <div class="section-title-row" style="margin-bottom:14px;">
          <h3>${esc(cropName(c))} · Growth Stages</h3>
          <span style="font-size:12px; color:var(--lime); font-weight:700;">Day ${currentDay} / ${days}</span>
        </div>

        <div>
          ${(c.calendar || []).map((stage, idx) => {
            const isDone = stage[0] <= currentDay;
            return `
              <div class="stage-step-row ${isDone ? 'completed' : ''}">
                <div class="stage-dot">${isDone ? '✓' : idx + 1}</div>
                <div class="stage-info">
                  <h5>Day ${stage[0]}: ${getLang() === 'ta' ? stage[1] : stage[2]}</h5>
                  <p>${isDone ? 'Phase verified & completed' : 'Upcoming scheduled agronomy phase'}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Economics & Profit Forecast -->
      <div class="profit-card">
        <span>Estimated Economics (${c.days} days cycle)</span>
        <strong>${money(Math.round(c.budget * (Number(state.area) || 1) * 1.65))}</strong>
        <div>
          <span>Estimated Operating Cost</span>
          <b>${money(c.budget * (Number(state.area) || 1))}</b>
        </div>
        <div>
          <span>Projected Net Profit</span>
          <b style="color:var(--lime)">${money(Math.round(c.budget * (Number(state.area) || 1) * 0.65))}</b>
        </div>
      </div>
    </div>
  `;
}

// Farm Setup & Recommendations Form
function form() {
  return `
    <div class="page-card">
      <div class="page-title">
        <button class="back-btn" data-page="home">‹</button>
        <div>
          <h2>Farm Setup</h2>
          <p>Configure your soil, land and water parameters.</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>${t('state')}</label>
          <select id="state">
            ${STATES.map(x => `<option ${state.state === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>${t('district')}</label>
          <select id="district">
            ${Object.keys(DISTRICTS).map(x => `<option ${state.district === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>${t('soil')}</label>
          <select id="soil">
            ${SOILS.map(x => `<option value="${x[0]}" ${state.soil === x[0] ? 'selected' : ''}>${label(SOILS, x[0])}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>${t('water')}</label>
          <select id="water">
            ${WATER.map(x => `<option value="${x[0]}" ${state.water === x[0] ? 'selected' : ''}>${label(WATER, x[0])}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>${t('budget')}</label>
          <input id="budget" type="number" min="0" step="500" value="${esc(state.budget)}">
        </div>
        <div class="field">
          <label>${t('area')}</label>
          <input id="area" type="number" min="0.1" step="0.1" value="${esc(state.area)}">
        </div>
        <div class="field full">
          <label>${t('crop')}</label>
          <select id="crop">
            <option value="">${t('all')}</option>
            ${CROPS.map(c => `<option value="${c.id}" ${state.crop === c.id ? 'selected' : ''}>${cropName(c)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="action-row">
        <button class="primary-btn" id="recommend">🌱 Generate Recommendations</button>
        <button class="secondary-btn" id="locate">📍 Auto Location</button>
      </div>
      <div id="locationMsg"></div>
    </div>
    ${recommendations()}
  `;
}

function recommendations() {
  const list = getRecommendations();
  return `
    <div class="page-card">
      <div class="section-title-row">
        <h3>Recommended Crops</h3>
      </div>
      ${list.length ? list.map((c, i) => `
        <article class="recommendation">
          <div>
            <span class="crop-number">${i + 1}</span>
            <h3>${esc(cropName(c))}</h3>
          </div>
          <div class="metric-grid">
            <div><small>Duration</small><b>${c.days} days</b></div>
            <div><small>Yield</small><b>${esc(c.yield)}</b></div>
            <div><small>Market</small><b>${esc(c.price)}</b></div>
          </div>
          <p style="font-size:12px; line-height:1.5; color:var(--text-sub); margin-bottom:12px;">
            ${esc(getLang() === 'ta' ? c.reasonTa : c.reasonEn)}
          </p>
          <button class="primary-btn calendarBtn" data-crop="${c.id}" style="height:40px; font-size:12px;">
            📅 Inspect Field Calendar & Water →
          </button>
        </article>
      `).join('') : `<p class="muted">${t('noResults')}</p>`}
    </div>
  `;
}

function getRecommendations() {
  let list = CROPS.filter(c => !state.crop || c.id === state.crop);
  list = list.filter(c => c.soils.includes(state.soil) && (c.water.includes(state.water) || state.water === 'sufficient'));
  list = list.filter(c => Number(state.budget) >= c.budget);
  if (!list.length) list = CROPS.filter(c => c.soils.includes(state.soil) && Number(state.budget) >= c.budget).slice(0, 4);
  return list.sort((a, b) => a.budget - b.budget);
}

// Explore All Crops
function crops() {
  return `
    <div class="page-card">
      <div class="page-title">
        <button class="back-btn" data-page="home">‹</button>
        <div>
          <h2>Explore Crops</h2>
          <p>Growing cycle, yield expectations and market benchmarks.</p>
        </div>
      </div>
    </div>
    <div class="crop-grid">
      ${CROPS.map(c => `
        <article class="crop-card">
          <div class="crop-photo">🌾</div>
          <h3>${cropName(c)}</h3>
          <p>${c.days} days · ${esc(c.yield)}</p>
          <strong>${esc(c.price)}</strong>
          <button class="primary-btn calendarBtn" data-crop="${c.id}" style="width:100%; height:36px; font-size:11px;">
            Field View →
          </button>
        </article>
      `).join('')}
    </div>
  `;
}

// Expense Calculator
function expense() {
  const keys = ['seeds', 'fertilizerCost', 'labor', 'irrigation', 'pest', 'machinery', 'other'];
  const total = keys.reduce((s, k) => s + (Number(state.expenses[k]) || 0), 0);
  const c = currentCrop();
  const revenue = Math.round(c.budget * (Number(state.area) || 1) * 1.65);

  return `
    <div class="page-card">
      <div class="page-title">
        <button class="back-btn" data-page="home">‹</button>
        <div>
          <h2>Expense Tracker</h2>
          <p>Monitor farm inputs and calculate net margin.</p>
        </div>
      </div>

      <div class="form-grid">
        ${keys.map(k => `
          <div class="field">
            <label>${t(k)}</label>
            <input class="expenseInput" data-expense="${k}" type="number" min="0" step="100" value="${esc(state.expenses[k] || 0)}">
          </div>
        `).join('')}
      </div>

      <div class="profit-card">
        <span>Total Input Costs</span>
        <strong>${money(total)}</strong>
        <div>
          <span>Estimated Gross Harvest Value</span>
          <b>${money(revenue)}</b>
        </div>
        <div>
          <span>Net Profit Margin</span>
          <b style="color:var(--lime); font-size:15px;">${money(revenue - total)}</b>
        </div>
      </div>
    </div>
  `;
}

// Fertilizer Guide
function fertilizer() {
  const c = currentCrop();
  return `
    <div class="page-card">
      <div class="page-title">
        <button class="back-btn" data-page="home">‹</button>
        <div>
          <h2>Fertilizer Guide</h2>
          <p>${cropName(c)} · ${label(SOILS, state.soil)}</p>
        </div>
      </div>

      <div class="guide-card">
        <b>🌱 Basal Dressing (At Sowing / Transplanting)</b>
        <p>Apply well-rotted Farmyard Manure (10-12 tonnes/acre) combined with biofertilizers (Azospirillum & Phosphobacteria) to boost early root system development.</p>
      </div>

      <div class="guide-card">
        <b>🌿 Vegetative Stage (Day 25-30)</b>
        <p>Top dress with Nitrogen (Urea 30-35 kg/acre) based on leaf color chart (LCC) readings to support tillering and vigorous leafy canopy.</p>
      </div>

      <div class="guide-card">
        <b>🌾 Panicle & Grain Filling (Day 60-70)</b>
        <p>Muriate of Potash (MOP 20-25 kg/acre) application along with 1% spray of Potassium Nitrate ensures plump, uniform grain filling and disease resistance.</p>
      </div>
    </div>
  `;
}

// Disease AI Check
function disease() {
  return `
    <div class="page-card">
      <div class="page-title">
        <button class="back-btn" data-page="home">‹</button>
        <div>
          <h2>Crop Disease AI</h2>
          <p>Scan crop leaves for early pest & blight detection.</p>
        </div>
      </div>

      <label class="upload-box">
        <span>📷</span>
        <b>Snap or Upload Plant Leaf</b>
        <small>Supports High-Res JPG & PNG</small>
        <input id="diseasePhoto" type="file" accept="image/*">
      </label>

      <div id="diseasePreview"></div>

      <button class="primary-btn" id="analyze" style="margin-top:16px; width:100%;">
        ⚡ Run AI Diagnostic Scan
      </button>

      <div id="diseaseResult"></div>
    </div>
  `;
}

// Market Mandi Prices
function market() {
  return `
    <div class="page-card">
      <div class="page-title">
        <button class="back-btn" data-page="home">‹</button>
        <div>
          <h2>Live Mandi Prices</h2>
          <p>Current market benchmarks in ${esc(state.district)} mandi.</p>
        </div>
      </div>

      ${CROPS.map(c => `
        <div class="market-row">
          <span>🌾 ${cropName(c)}</span>
          <b>${esc(c.price)}</b>
        </div>
      `).join('')}
    </div>
  `;
}

// Settings & Profile
function settings() {
  return `
    <div class="page-card">
      <div class="page-title">
        <button class="back-btn" data-page="home">‹</button>
        <div>
          <h2>Farmer Profile</h2>
          <p>Personalize your smart farming experience.</p>
        </div>
      </div>

      <div class="field" style="margin-bottom:14px;">
        <label>Farmer Name</label>
        <input id="farmerNameInput" type="text" value="${esc(state.farmerName)}">
      </div>

      <div class="field" style="margin-bottom:14px;">
        <label>Primary Language</label>
        <select id="settingsLang">
          <option value="en" ${getLang() === 'en' ? 'selected' : ''}>English</option>
          <option value="ta" ${getLang() === 'ta' ? 'selected' : ''}>தமிழ்</option>
        </select>
      </div>

      <div style="display:flex; gap:10px; margin-top:20px;">
        <button class="primary-btn" id="saveProfileBtn">Save Changes</button>
        <button class="secondary-btn" id="reset">Reset Data</button>
      </div>
    </div>
  `;
}

// Bottom Navigation Dock
function nav() {
  const items = [
    ['home', '⌂', 'Home'],
    ['calendar', '▣', 'Fields'],
    ['land', '🌿', 'Setup'],
    ['disease', '🐞', 'Health'],
    ['settings', '⚙', 'Profile']
  ];

  return `
    <nav class="bottom-nav">
      <div>
        ${items.map(x => `
          <button data-page="${x[0]}" class="${state.page === x[0] ? 'active' : ''}">
            <span>${x[1]}</span>
            <small>${x[2]}</small>
          </button>
        `).join('')}
      </div>
    </nav>
  `;
}

// Modals
function modals() {
  let content = '';

  if (state.showWaterModal) {
    content += `
      <div class="modal-overlay" id="closeWaterModal">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div style="font-size:36px; color:#38bdf8; margin-bottom:8px;">💧</div>
          <h3>Irrigation Manager</h3>
          <p>Schedule or log a watering cycle for your field.</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <button class="primary-btn" id="confirmWatering">
              Activate 2-Hour Drip Cycle (+36%)
            </button>
            <button class="secondary-btn" id="dismissWaterModal">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.showNotificationModal) {
    content += `
      <div class="modal-overlay" id="closeNotificationModal">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div style="font-size:32px; color:var(--lime); margin-bottom:8px;">🔔</div>
          <h3>Field Notifications</h3>
          <div style="text-align:left; font-size:12px; display:flex; flex-direction:column; gap:12px; margin:16px 0;">
            <div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:12px; border-left:3px solid #ff9800;">
              <b>⚠️ Soil Moisture Alert</b>
              <p style="margin-top:2px; color:var(--text-sub);">Field #1 moisture dropped to ${state.waterLevel}%. Water cycle recommended.</p>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:12px; border-left:3px solid #38bdf8;">
              <b>🌧 Rainfall Forecast</b>
              <p style="margin-top:2px; color:var(--text-sub);">Light rain (5 mm) expected in ${esc(state.district)} within 6 hours.</p>
            </div>
            <div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:12px; border-left:3px solid var(--lime);">
              <b>📈 Mandi Price Update</b>
              <p style="margin-top:2px; color:var(--text-sub);">Paddy spot price rose to ₹1,720 per quintal.</p>
            </div>
          </div>
          <button class="primary-btn" id="dismissNotificationModal" style="width:100%;">
            Dismiss
          </button>
        </div>
      </div>
    `;
  }

  if (state.toastMessage) {
    content += `<div class="toast-msg">${esc(state.toastMessage)}</div>`;
  }

  return content;
}

function page() {
  if (state.page === 'welcome') return welcome();
  if (state.page === 'home') return home();
  if (state.page === 'land') return form();
  if (state.page === 'crops') return crops();
  if (state.page === 'calendar') return calendar();
  if (state.page === 'disease') return disease();
  if (state.page === 'expense') return expense();
  if (state.page === 'fertilizer') return fertilizer();
  if (state.page === 'market') return market();
  return settings();
}

function render() {
  document.documentElement.lang = getLang() === 'ta' ? 'ta' : 'en';

  if (state.page === 'welcome') {
    root.innerHTML = `<div class="app-shell">${page()}</div>${modals()}`;
    bind();
    return;
  }

  root.innerHTML = `
    <div class="app-shell">
      ${statusBar()}
      <main class="app-main">${page()}</main>
      ${nav()}
    </div>
    ${modals()}
  `;
  bind();
}

function bind() {
  // Navigation
  document.querySelectorAll('[data-page]').forEach(b => {
    b.onclick = () => {
      if (b.dataset.crop) state.selectedCrop = b.dataset.crop;
      go(b.dataset.page);
    };
  });

  // Language buttons
  document.querySelectorAll('[data-wlang]').forEach(b => {
    b.onclick = () => {
      setLang(b.dataset.wlang);
      render();
    };
  });

  // Welcome Screen CTA
  document.getElementById('getStarted')?.addEventListener('click', () => {
    state.started = true;
    state.page = 'home';
    save();
    render();
    loadWeather();
  });

  // Category filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
      state.activeCategory = chip.dataset.cat;
      render();
    };
  });

  // Profile / Settings
  document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    const n = document.getElementById('farmerNameInput')?.value;
    if (n) state.farmerName = n.trim();
    save();
    showToast('Farmer profile updated successfully!');
    go('home');
  });

  document.getElementById('settingsLang')?.addEventListener('change', e => {
    setLang(e.target.value);
    render();
  });

  // Form Fields
  ['state', 'district', 'soil', 'water', 'budget', 'area', 'crop'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', e => {
      state[id] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      if (id === 'area') state.totalAcres = Math.round(Number(e.target.value) * 100);
      save();
    });
  });

  document.getElementById('recommend')?.addEventListener('click', () => {
    ['budget', 'area'].forEach(id => (state[id] = Number(val(id))));
    ['crop', 'soil', 'water', 'district', 'state'].forEach(id => (state[id] = val(id)));
    if (state.area) state.totalAcres = Math.round(Number(state.area) * 100);
    save();
    render();
    showToast('Recommendations updated!');
  });

  // Location & Weather
  document.getElementById('locate')?.addEventListener('click', locate);
  document.getElementById('weatherRefresh')?.addEventListener('click', () => {
    showToast('Refreshing live weather…');
    loadWeather();
  });

  // Modals & Watering
  document.getElementById('triggerWatering')?.addEventListener('click', () => {
    state.showWaterModal = true;
    render();
  });

  document.getElementById('closeWaterModal')?.addEventListener('click', () => {
    state.showWaterModal = false;
    render();
  });

  document.getElementById('dismissWaterModal')?.addEventListener('click', () => {
    state.showWaterModal = false;
    render();
  });

  document.getElementById('confirmWatering')?.addEventListener('click', () => {
    state.waterLevel = 65.4;
    state.showWaterModal = false;
    save();
    render();
    showToast('💧 Irrigation logged! Soil moisture restored to 65.4%');
  });

  // Notification modal
  document.getElementById('openNotifications')?.addEventListener('click', () => {
    state.showNotificationModal = true;
    render();
  });

  document.getElementById('closeNotificationModal')?.addEventListener('click', () => {
    state.showNotificationModal = false;
    render();
  });

  document.getElementById('dismissNotificationModal')?.addEventListener('click', () => {
    state.showNotificationModal = false;
    render();
  });

  // Disease Scanner
  document.getElementById('diseasePhoto')?.addEventListener('change', e => previewFile(e.target, 'diseasePreview'));
  document.getElementById('analyze')?.addEventListener('click', () => {
    const res = document.getElementById('diseaseResult');
    if (!res) return;
    res.innerHTML = `
      <div class="guide-card" style="margin-top:14px; border-color:var(--lime);">
        <b style="color:var(--lime)">🔍 AI Diagnostic Report:</b>
        <p style="margin-top:6px; color:var(--text-white);">No acute fungal blast or leaf blight detected. Minor nitrogen deficiency indicated by slight pale leaf margins.</p>
        <p style="margin-top:6px; color:var(--text-sub);">Recommended action: Apply foliar spray of 1% urea during morning hours. Repeat soil moisture check.</p>
      </div>
    `;
  });

  // Reset
  document.getElementById('reset')?.addEventListener('click', () => {
    clearSettings();
    location.reload();
  });

  // Expenses
  document.querySelectorAll('.expenseInput').forEach(i => {
    i.addEventListener('input', e => {
      state.expenses[e.target.dataset.expense] = Number(e.target.value) || 0;
      save();
    });
  });

  // Inspect crop buttons
  document.querySelectorAll('.calendarBtn').forEach(b => {
    b.onclick = () => {
      state.selectedCrop = b.dataset.crop;
      go('calendar');
    };
  });
}

function previewFile(input, id) {
  const f = input.files?.[0];
  const box = document.getElementById(id);
  if (!f || !box) return;
  const url = URL.createObjectURL(f);
  box.innerHTML = `<img class="preview" src="${url}" alt="Crop Leaf Preview">`;
}

function locate() {
  const msg = document.getElementById('locationMsg');
  if (!navigator.geolocation) {
    if (msg) msg.innerHTML = `<div class="status" style="color:var(--status-danger)">${t('locationDenied')}</div>`;
    return;
  }
  if (msg) msg.innerHTML = '<div class="status" style="color:var(--lime)">Acquiring GPS coordinates…</div>';
  navigator.geolocation.getCurrentPosition(
    async p => {
      const nearest = Object.entries(DISTRICTS).sort(
        (a, b) =>
          Math.hypot(a[1].lat - p.coords.latitude, a[1].lon - p.coords.longitude) -
          Math.hypot(b[1].lat - p.coords.latitude, b[1].lon - p.coords.longitude)
      )[0];
      state.district = nearest[0];
      save();
      if (msg) msg.innerHTML = `<div class="status" style="color:var(--lime)">📍 Located: ${esc(nearest[0])}</div>`;
      await loadWeather(p.coords.latitude, p.coords.longitude);
    },
    () => {
      if (msg) msg.innerHTML = `<div class="status" style="color:var(--status-danger)">${t('locationDenied')}</div>`;
    },
    {enableHighAccuracy: false, timeout: 8000}
  );
}

async function loadWeather(lat, lon) {
  if (!lat || !lon) {
    const d = DISTRICTS[state.district] || DISTRICTS.Dharmapuri;
    lat = d.lat;
    lon = d.lon;
  }
  state.weatherLoading = true;
  render();
  try {
    state.weather = await getWeather(lat, lon);
  } catch {
    state.weather = null;
  }
  state.weatherLoading = false;
  render();
}

render();
if (state.page === 'home') loadWeather();
