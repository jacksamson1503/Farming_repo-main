const KEY='ai-farm-settings-v3';
const DEFAULT_FARM={state:'Tamil Nadu',district:'Dharmapuri'};
export function loadSettings(){try{const saved=JSON.parse(localStorage.getItem(KEY));return saved&&typeof saved==='object'?saved:DEFAULT_FARM}catch{return DEFAULT_FARM}}
export function saveSettings(data){localStorage.setItem(KEY,JSON.stringify(data))}
export function clearSettings(){localStorage.removeItem(KEY)}
