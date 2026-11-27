'use strict';
/* ============ helpers & constants ============ */
const fin = Number.isFinite, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const f = (v, d = 1) => fin(v) ? v.toFixed(d) : '—';
const fmtP = p => !fin(p) ? '—' : p < 1e-300 ? '< 1e-300' : p < 0.001 ? p.toExponential(1) : p.toFixed(3);
const DAY = 864e5;
const VARS = {
    aqi: { l: 'AQI', u: '' }, pm25: { l: 'PM2.5', u: 'µg/m³' }, pm10: { l: 'PM10', u: 'µg/m³' }, no2: { l: 'NO₂', u: 'µg/m³' }, so2: { l: 'SO₂', u: 'µg/m³' }, co: { l: 'CO', u: 'mg/m³' }, o3: { l: 'O₃', u: 'µg/m³' },
    temp: { l: 'Temp', u: '°C' }, hum: { l: 'Humidity', u: '%' }, wind: { l: 'Wind', u: 'km/h' }, rain: { l: 'Rainfall', u: 'mm' }, pres: { l: 'Pressure', u: 'hPa' }
};
const KEYS = Object.keys(VARS), POLL = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'], WX = ['temp', 'hum', 'wind', 'rain', 'pres'];
const SEASONS = ['Winter', 'Summer', 'Monsoon', 'Post-monsoon'];
const seasonOf = m => m === 12 || m <= 2 ? 0 : m <= 5 ? 1 : m <= 9 ? 2 : 3;
const lab = k => VARS[k].l;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function bucket(v) { const b = [[50, 'Good', '#00b050'], [100, 'Satisfactory', '#92d050'], [200, 'Moderate', '#ffd500'], [300, 'Poor', '#ff9900'], [400, 'Very Poor', '#ff3b30'], [1e9, 'Severe', '#a50021']]; for (const x of b) if (v <= x[0]) return { n: x[1], c: x[2] }; }
const txtOn = c => ['#ffd500', '#92d050', '#ff9900', '#00b050'].includes(c) ? '#111' : '#fff';
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) }
const tip = $('#tip');
document.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { tip.innerHTML = t.dataset.tip; tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 10) + 'px'; tip.style.top = (e.clientY + 16) + 'px' } else tip.style.opacity = 0 });