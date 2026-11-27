'use strict';
/* ============ data generation, CSV parsing & dataset views ============ */
const CITIES = [
    { n: 'Delhi', pm: 105, t: 25, ta: 10, h: 55, rain: 1, w: 7, burn: 1, no2: 55, miss: .05 }, { n: 'Lucknow', pm: 95, t: 25.5, ta: 9.5, h: 60, rain: 1.1, w: 6, burn: .8, no2: 40, miss: .08 },
    { n: 'Kolkata', pm: 70, t: 27, ta: 5.5, h: 75, rain: 1.5, w: 6, burn: .2, no2: 35, miss: .07 }, { n: 'Ahmedabad', pm: 75, t: 28, ta: 6, h: 50, rain: .8, w: 9, burn: .1, no2: 30, miss: .10 },
    { n: 'Mumbai', pm: 50, t: 27.5, ta: 3.5, h: 72, rain: 2, w: 10, burn: 0, no2: 30, miss: .06 }, { n: 'Hyderabad', pm: 55, t: 26.5, ta: 4.5, h: 58, rain: 1, w: 9, burn: 0, no2: 28, miss: .09 },
    { n: 'Chennai', pm: 42, t: 29, ta: 3, h: 73, rain: 1.2, w: 11, burn: 0, no2: 25, miss: .07 }, { n: 'Bengaluru', pm: 38, t: 24, ta: 2.5, h: 65, rain: 1, w: 10, burn: 0, no2: 30, miss: .05 }];
const BP = { pm25: [0, 30, 60, 90, 120, 250, 380], pm10: [0, 50, 100, 250, 350, 430, 600], no2: [0, 40, 80, 180, 280, 400, 500], so2: [0, 40, 80, 380, 800, 1600, 2000], co: [0, 1, 2, 10, 17, 34, 50], o3: [0, 50, 100, 168, 208, 748, 1000] };
function subIdx(v, b) { const I = [0, 50, 100, 200, 300, 400, 500]; if (v <= b[0]) return 0; for (let i = 1; i < b.length; i++)if (v <= b[i]) return I[i - 1] + (v - b[i - 1]) / (b[i] - b[i - 1]) * (I[i] - I[i - 1]); return 500 }
function aqiFrom(o) { let m = NaN; for (const k in BP) if (fin(o[k])) { const s = subIdx(o[k], BP[k]); m = fin(m) ? Math.max(m, s) : s } return (fin(o.pm25) || fin(o.pm10)) ? m : NaN }
function genDemo() {
    const rand = mulberry32(20240612), randn = () => { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()) };
    const START = Date.UTC(2018, 0, 1), N = 1096, dIdx = t => Math.round((t - START) / DAY);
    const diw = [Date.UTC(2018, 10, 7), Date.UTC(2019, 9, 27), Date.UTC(2020, 10, 14)].map(dIdx), L0 = dIdx(Date.UTC(2020, 2, 25)), L1 = dIdx(Date.UTC(2020, 4, 31));
    const raw = {};
    CITIES.forEach(C => {
        const v = {}; KEYS.forEach(k => v[k] = new Float64Array(N).fill(NaN)); const month = [], date = [];
        const out = new Uint8Array(N); for (let d = 0; d < N;) { if (rand() < C.miss / 6) { const L = 1 + Math.floor(rand() ** 2 * 14); for (let j = 0; j < L && d + j < N; j++)out[d + j] = 1; d += L } else d++ }
        let tn = 0, wn = 0, hn = 0, pn = 0, ln = 0; const W = new Float64Array(N), R = new Float64Array(N);
        for (let d = 0; d < N; d++) {
            const ms = START + d * DAY, dt = new Date(ms), yr = dt.getUTCFullYear(); month.push(dt.getUTCMonth() + 1); date.push(ms);
            const doy = Math.floor((ms - Date.UTC(yr, 0, 0)) / DAY), mon = Math.exp(-(((doy - 215) / 38) ** 2)), win = Math.exp(-((Math.min(doy, 366 - doy) / 45) ** 2));
            tn = .7 * tn + .7 * randn(); const temp = C.t + C.ta * Math.cos(2 * Math.PI * (doy - 140) / 365) - 1.5 * mon * (C.rain > 1 ? 1 : .5) + tn * 1.2;
            const pr = Math.min(.85, .04 + .55 * mon * C.rain / 1.2), rn = rand() < pr ? -Math.log(1 - rand()) * (6 + 12 * mon * C.rain) : 0;
            hn = .7 * hn + .7 * randn(); const hum = Math.min(99, Math.max(15, C.h - 8 + 22 * mon * (C.rain > 1 ? 1 : .7) + hn * 6 + (rn > 0 ? 8 : 0)));
            wn = .6 * wn + .8 * randn(); const wd = Math.max(1, C.w * (.85 + .35 * mon - .25 * win) + wn * 2 + (rn > 5 ? 2 : 0));
            pn = .85 * pn + .5 * randn(); const pres = 1009 + 7 * Math.cos(2 * Math.PI * (doy - 15) / 365) + pn * 1.8 - (rn > 0 ? 1.5 : 0);
            W[d] = wd; R[d] = rn; const wp = d ? W[d - 1] : wd, rp = d ? R[d - 1] : 0; ln = .72 * ln + .28 * randn();
            let lp = Math.log(C.pm) + .75 * win + C.burn * .7 * Math.exp(-(((doy - 308) / 18) ** 2)) - .65 * mon - .045 * (wd - C.w) - .035 * (wp - C.w) - (rn > 2 ? .35 : 0) - (rp > 2 ? .15 : 0) + .007 * (hum - 60) * win - .006 * (temp - C.t) + ln * .9;
            let pm = Math.exp(lp); if (diw.some(x => d === x || d === x + 1)) pm *= C.burn > 0 ? 2.2 : 1.5; if (rand() < .004) pm *= 2.5 + rand() * 1.5;
            const lk = d >= L0 && d <= L1; if (lk) pm *= .62;
            const pm10 = Math.max(pm * 1.05, pm * (1.5 + .15 * randn()) + 10 * Math.exp(.5 * randn()) * (1 + .5 * (1 - mon)));
            const no2 = C.no2 * (1 + .45 * win) * Math.exp(-.03 * (wd - C.w) + .22 * randn() + .3 * ln) * (lk ? .5 : 1);
            const so2 = 12 * Math.exp(.35 * randn() + .15 * ln) * (.8 + .3 * win), co = .9 * (1 + .6 * win) * Math.exp(.25 * randn() + .4 * ln) * (lk ? .8 : 1);
            const o3 = Math.max(6, 34 + 1.4 * (temp - 25) - (rn > 0 ? 6 : 0) + 8 * randn() - .08 * (no2 - C.no2));
            const row = { pm25: pm, pm10, no2, so2, co, o3 };
            if (out[d]) { KEYS.forEach(k => { if (POLL.includes(k)) row[k] = NaN }) } else { [['pm25', .02], ['pm10', .05], ['no2', .04], ['so2', .06], ['co', .04], ['o3', .05]].forEach(([k, p]) => { if (rand() < p) row[k] = NaN }) }
            row.aqi = aqiFrom(row);
            const wx = { temp, hum, wind: wd, rain: rn, pres }; for (const k in wx) if (rand() < .012) wx[k] = NaN;
            KEYS.forEach(k => { v[k][d] = k in row ? row[k] : wx[k] });
        }
        raw[C.n] = { n: N, date, month, v };
    });
    return raw;
}
const ALIAS = { pm25: ['pm25'], pm10: ['pm10'], no2: ['no2'], so2: ['so2'], co: ['co'], o3: ['o3'], aqi: ['aqi'], temp: ['temp', 'temperature', 'tavg', 'temperature2m'], hum: ['humidity', 'hum', 'rh'], wind: ['wind', 'windspeed', 'wspd'], rain: ['rain', 'rainfall', 'precip', 'precipitation', 'prcp'], pres: ['pressure', 'pres'] };
function loadCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean), cl = s => s.trim().replace(/^"|"$/g, '');
    const head = lines.shift().split(',').map(cl), norm = head.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const ci = norm.findIndex(h => h === 'city' || h === 'cityname'), di = norm.findIndex(h => ['date', 'datetime', 'obsdate'].includes(h));
    if (ci < 0 || di < 0) throw new Error('CSV needs "City" and "Date" columns (Kaggle city_day.csv format).');
    const col = {}; KEYS.forEach(k => { const i = norm.findIndex(h => ALIAS[k].includes(h)); if (i >= 0) col[k] = i });
    const by = {}; lines.forEach(l => { const r = l.split(',').map(cl), t = Date.parse((r[di] || '').slice(0, 10) + 'T00:00:00Z'); if (!fin(t)) return; (by[r[ci]] = by[r[ci]] || []).push([t, r]) });
    const names = Object.keys(by).sort((a, b) => by[b].length - by[a].length).slice(0, 12).sort(), raw = {};
    names.forEach(nm => {
        const arr = by[nm]; let t0 = Infinity, t1 = -Infinity; arr.forEach(([t]) => { t0 = Math.min(t0, t); t1 = Math.max(t1, t) });
        const n = Math.round((t1 - t0) / DAY) + 1, v = {}; KEYS.forEach(k => v[k] = new Float64Array(n).fill(NaN));
        arr.forEach(([t, r]) => { const i = Math.round((t - t0) / DAY); for (const k in col) { const x = parseFloat(r[col[k]]); if (fin(x)) v[k][i] = x } });
        if (col.aqi === undefined) for (let i = 0; i < n; i++) { const o = {}; POLL.forEach(k => o[k] = v[k][i]); v.aqi[i] = aqiFrom(o) }
        const date = [], month = []; for (let i = 0; i < n; i++) { const ms = t0 + i * DAY; date.push(ms); month.push(new Date(ms).getUTCMonth() + 1) }
        raw[nm] = { n, date, month, v }
    });
    if (!names.length) throw new Error('No valid rows found.'); return raw;
}

/* ============ dataset views ============ */
let RAW = null, gapMode = 0, srcName = '', dsCache = {};
function interp(a, maxGap) { const n = a.length; let i = 0; while (i < n) { if (!fin(a[i])) { let j = i; while (j < n && !fin(a[j])) j++; const L = j - i; if (i > 0 && j < n && L <= maxGap) for (let k = i; k < j; k++)a[k] = a[i - 1] + (a[j] - a[i - 1]) * (k - i + 1) / (L + 1); i = j } else i++ } }
function makeDS(raw, gap, des) {
    const ds = { cities: Object.keys(raw), c: {} };
    ds.cities.forEach(nm => {
        const r = raw[nm], v = {};
        KEYS.forEach(k => { const a = Float64Array.from(r.v[k]); if (gap > 0 && k !== 'rain') interp(a, gap); v[k] = a });
        if (des) KEYS.forEach(k => { const a = v[k], s = new Float64Array(13), c = new Float64Array(13); for (let i = 0; i < r.n; i++)if (fin(a[i])) { s[r.month[i]] += a[i]; c[r.month[i]]++ } for (let i = 0; i < r.n; i++)if (fin(a[i])) a[i] -= s[r.month[i]] / c[r.month[i]] });
        ds.c[nm] = { n: r.n, date: r.date, month: r.month, season: r.month.map(seasonOf), v }
    });
    return ds;
}
const DS = (des = false, gap = gapMode) => { const k = gap + '|' + des; return dsCache[k] || (dsCache[k] = makeDS(RAW, gap, des)) };
function vals(ds, k, o = {}) { const out = []; for (const nm of ds.cities) { if (o.city && nm !== o.city) continue; const c = ds.c[nm], a = c.v[k]; for (let i = 0; i < c.n; i++) { if (o.season != null && c.season[i] !== o.season) continue; out.push(a[i]) } } return out }
function pairs(ds, kx, ky, city) { const xs = [], ys = []; for (const nm of ds.cities) { if (city && city !== 'all' && nm !== city) continue; const c = ds.c[nm], a = c.v[kx], b = c.v[ky]; for (let i = 0; i < c.n; i++)if (fin(a[i]) && fin(b[i])) { xs.push(a[i]); ys.push(b[i]) } } return [xs, ys] }
function lagPairs(ds, kx, ky, lag, city) { const xs = [], ys = []; for (const nm of ds.cities) { if (city && city !== 'all' && nm !== city) continue; const c = ds.c[nm], a = c.v[kx], b = c.v[ky]; for (let i = lag; i < c.n; i++)if (fin(a[i - lag]) && fin(b[i])) { xs.push(a[i - lag]); ys.push(b[i]) } } return [xs, ys] }
const hasVar = k => RAW && Object.values(RAW).some(r => r.v[k].some(fin));
const availKeys = () => KEYS.filter(hasVar);