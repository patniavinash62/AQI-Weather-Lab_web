'use strict';
/* ============ section renderers ============ */
function renderHero() {
    const ds = DS(), names = ds.cities, means = names.map(c => { const d = describe(vals(ds, 'aqi', { city: c })); return d.mean });
    const allA = describe(vals(ds, 'aqi')), rawDS = DS(false, 0); let recs = 0, miss = 0, tot = 0;
    names.forEach(c => { const cc = rawDS.c[c]; recs += cc.n; tot += cc.n; cc.v.aqi.forEach(v => { if (!fin(v)) miss++ }) });
    const worst = names[means.indexOf(Math.max(...means.filter(fin)))];
    $('#srcBadge').textContent = srcName;
    $('#kpis').innerHTML = [['Daily records', 'k0', ''], ['Cities', 'k1', ''], ['Mean AQI', 'k2', bucket(allA.mean).n], ['AQI missing', 'k3', 'before any filling'], ['Most polluted', null, worst + ' · mean ' + f(Math.max(...means.filter(fin)), 0)]].map(([l, id, s], i) => `<div class="card kpi reveal" style="transition-delay:${i * 70}ms"><div class="v" ${id ? `id="${id}"` : ''}>${id ? '0' : worst}</div><div class="l">${l}</div><div class="muted" style="font-size:12px">${s}</div></div>`).join('');
    observeReveal(); countUp($('#k0'), recs); countUp($('#k1'), names.length); countUp($('#k2'), allA.mean, 0); countUp($('#k3'), miss / tot * 100, 1, '%');
    clearInterval(renderHero.t); let i = 0; const arc = $('#gArc'), C = 615.75;
    const show = () => { const c = names[i % names.length], v = means[i % names.length], b = bucket(v); arc.style.strokeDashoffset = C * (1 - Math.min(1, v / 500)); arc.style.stroke = b.c; $('#gCity').textContent = c; countUp($('#gNum'), v, 0); const g = $('#gBadge'); g.textContent = b.n; g.style.background = b.c; g.style.color = txtOn(b.c); i++ };
    show(); renderHero.t = setInterval(show, 3400);
    $('#wxBanner').style.display = WX.some(hasVar) ? 'none' : 'block';
}

function runs(a) { const r = []; let i = 0; while (i < a.length) { if (!fin(a[i])) { let j = i; while (j < a.length && !fin(a[j])) j++; r.push([i, j - i]); i = j } else i++ } return r }
function renderData() {
    const ds = DS(), raw = DS(false, 0); let html = '', recovered = 0;
    ds.cities.forEach(nm => {
        const c = ds.c[nm], a = c.v.aqi, rr = runs(a), m = a.filter(v => !fin(v)).length, m0 = raw.c[nm].v.aqi.filter(v => !fin(v)).length; recovered += m0 - m;
        const longest = rr.reduce((s, r) => Math.max(s, r[1]), 0);
        html += `<div class="strip"><b>${nm}</b><svg viewBox="0 0 1000 20" preserveAspectRatio="none"><rect width="1000" height="20" fill="var(--accent)" fill-opacity=".45"/>${rr.map(r => `<rect x="${r[0] / c.n * 1000}" width="${Math.max(1.5, r[1] / c.n * 1000)}" height="20" fill="var(--bad)"/>`).join('')}</svg><span class="muted">${(m / c.n * 100).toFixed(1)}% missing · longest gap ${longest}d</span></div>`
    });
    $('#strips').innerHTML = html;
    $('#gapNote').textContent = gapMode ? `${recovered.toLocaleString()} AQI values were interpolated across short gaps; longer outages stay missing.` : 'Statistics use only days where the needed values exist (pairwise deletion).';
}

function renderSummary() {
    const ds = DS(), k = $('#sumVar').value, by = $('#sumBy').value;
    const groups = by === 'city' ? ds.cities.map(c => ({ label: c, values: vals(ds, k, { city: c }) })) : SEASONS.map((s, i) => ({ label: s, values: vals(ds, k, { season: i }) }));
    groups.forEach(g => g.s = describe(g.values));
    $('#sumTbl').innerHTML = `<thead><tr><th>${by === 'city' ? 'City' : 'Season'}</th><th>n</th><th>Missing</th><th>Mean</th><th>Median</th><th>Mode</th><th>SD</th><th>IQR</th><th>Skew</th><th>Shape</th><th>Outliers</th></tr></thead><tbody>` +
        groups.map((g, i) => { const s = g.s; return `<tr style="animation-delay:${i * 50}ms"><td><b>${g.label}</b></td><td>${s.n}</td><td>${f(s.miss * 100, 1)}%</td><td>${f(s.mean)}</td><td>${f(s.median)}</td><td>${f(s.mode)}</td><td>${f(s.sd)}</td><td>${f(s.iqr)}</td><td>${f(s.skew, 2)}</td><td>${skewTag(s.skew)}</td><td>${s.out} <span class="muted">(${f(s.out / s.n * 100, 1)}%)</span></td></tr>` }).join('') + '</tbody>';
    barChart($('#sumBar'), { labels: groups.map(g => g.label), series: [{ name: 'Mean', values: groups.map(g => g.s.mean) }, { name: 'Median', values: groups.map(g => g.s.median) }], fmt: v => v.toFixed(1), rot: by === 'city' });
    boxPlot($('#sumBox'), groups);
    const rows = ds.cities.map(c => ({ c, v: SEASONS.map((_, i) => describe(vals(ds, k, { city: c, season: i })).mean) })).sort((a, b) => (b.v.reduce((s, x) => s + (fin(x) ? x : 0), 0)) - (a.v.reduce((s, x) => s + (fin(x) ? x : 0), 0)));
    const all = rows.flatMap(r => r.v).filter(fin), mn = Math.min(...all), mx = Math.max(...all);
    let h = `<div class="hm" style="grid-template-columns:90px repeat(4,1fr)"><div></div>${SEASONS.map(s => `<div class="h">${s}</div>`).join('')}`;
    rows.forEach((r, ri) => { h += `<div class="rl">${r.c}</div>` + r.v.map((v, ci) => { let st; if (k === 'aqi' && fin(v)) { const b = bucket(v); st = `background:${b.c};color:${txtOn(b.c)}` } else st = `background:color-mix(in srgb,var(--accent) ${fin(v) ? Math.round(12 + 75 * (v - mn) / (mx - mn || 1)) : 0}%,transparent)`; return `<div class="c" style="${st};animation-delay:${(ri * 4 + ci) * 35}ms" data-tip="${r.c} · ${SEASONS[ci]}<br>mean ${lab(k)} = ${f(v)}">${f(v, 0)}${k === 'aqi' && fin(v) ? `<small>${bucket(v).n}</small>` : ''}</div>` }).join('') });
    $('#sumHeat').innerHTML = h + '</div>'; renderHist();
}

function renderHist() {
    const ds = DS(), k = $('#sumVar').value, c = $('#histCity').value, d = histogram($('#sumHist'), vals(ds, k, c === 'all' ? {} : { city: c }));
    if (d) $('#histNote').innerHTML = `Skewness = <b>${f(d.skew, 2)}</b> (${d.skew > .5 ? 'right-skewed' : d.skew < -.5 ? 'left-skewed' : 'near-symmetric'}). Mean ${f(d.mean)} vs median ${f(d.median)}: ${d.mean > d.median * 1.02 ? 'the long tail of severe-pollution days pulls the mean up, so the <b>median</b> describes a typical day better.' : 'both centres agree.'}`;
}

function bounds(method, a, d) {
    if (method === 'iqr15') return [d.q1 - 1.5 * d.iqr, d.q3 + 1.5 * d.iqr]; if (method === 'iqr3') return [d.q1 - 3 * d.iqr, d.q3 + 3 * d.iqr];
    if (method === 'z3') return [d.mean - 3 * d.sd, d.mean + 3 * d.sd];
    const dev = clean(a).map(v => Math.abs(v - d.median)).sort((x, y) => x - y), mad = quantile(dev, .5) || 1e-9; return [d.median - 3.5 * mad / .6745, d.median + 3.5 * mad / .6745];
}

function renderOutliers() {
    const ds = DS(), city = $('#outCity').value, k = $('#outVar').value, method = $('#outMethod').value, c = ds.c[city], a = c.v[k], d = describe(a);
    const [lo, hi] = bounds(method, a, d), flag = Array.from(a).map(v => fin(v) && (v < lo || v > hi)), nf = flag.filter(Boolean).length;
    timeSeries($('#outTS'), { c, k, flag, lo, hi });
    const kept = Array.from(a).filter((v, i) => fin(v) && !flag[i]), dk = describe(kept);
    $('#outStats').innerHTML = statCard('Flagged days', nf, `${f(nf / d.n * 100, 1)}% of ${d.n} valid days`) + statCard('Mean change', f((dk.mean - d.mean) / d.mean * 100, 1) + '%', `${f(d.mean)} → ${f(dk.mean)} without outliers`) + statCard('Median change', f((dk.median - d.median) / d.median * 100, 1) + '%', `${f(d.median)} → ${f(dk.median)} (robust)`);
    $('#outCmp').innerHTML = '<thead><tr><th>Method</th><th>Lower</th><th>Upper</th><th>Flagged</th></tr></thead><tbody>' + [['iqr15', 'Tukey 1.5×IQR'], ['iqr3', 'Tukey 3×IQR'], ['z3', 'Z-score |z|>3'], ['mad', 'Modified Z (MAD)']].map(([m, n]) => { const [l, u] = bounds(m, a, d); const cnt = Array.from(a).filter(v => fin(v) && (v < l || v > u)).length; return `<tr><td>${n}</td><td>${f(l, 0)}</td><td>${f(u, 0)}</td><td><b>${cnt}</b></td></tr>` }).join('') + '</tbody>';
    const top = []; a.forEach((v, i) => { if (flag[i]) top.push([i, v]) }); top.sort((x, y) => Math.abs(y[1] - d.median) - Math.abs(x[1] - d.median));
    $('#outTop').innerHTML = '<thead><tr><th>Date</th><th>Value</th><th>Season</th><th>z</th></tr></thead><tbody>' + (top.slice(0, 8).map(([i, v]) => `<tr><td>${new Date(c.date[i]).toISOString().slice(0, 10)}</td><td><b>${f(v)}</b></td><td>${SEASONS[c.season[i]]}</td><td>${f((v - d.mean) / d.sd, 1)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None flagged</td></tr>') + '</tbody>';
}

/* correlation matrix */
let cmSel = ['aqi', 'wind'];
function corrMat(ds, keys, city) {
    const n = keys.length, M = Array.from({ length: n }, () => Array(n).fill(null));
    for (let i = 0; i < n; i++)for (let j = i; j < n; j++) { if (i === j) { M[i][j] = { p: 1, s: 1, n: 1 }; continue } const [x, y] = pairs(ds, keys[i], keys[j], city), p = pearson(x, y), s = x.length > 2 ? spearman(x, y) : NaN; M[i][j] = M[j][i] = { p, s, n: x.length } } return M
}

function renderCorr() {
    const des = $('#cmDes').checked, city = $('#cmCity').value, mode = document.querySelector('#cmMode .on').dataset.m, ds = DS(des);
    const keys = availKeys(), M = corrMat(ds, keys, city), n = keys.length, cs = 52, L = 76, T = 62, w = L + n * cs + 10, h = T + n * cs + 10;
    if (!keys.includes(cmSel[0]) || !keys.includes(cmSel[1])) cmSel = [keys[0], keys[1] || keys[0]];
    let s = svgOpen(w, h); keys.forEach((k, i) => { s += `<text class="tick" x="${L + i * cs + cs / 2}" y="${T - 10}" text-anchor="middle" style="font-weight:${POLL.includes(k) || k === 'aqi' ? 700 : 500}">${lab(k)}</text><text class="tick" x="${L - 8}" y="${T + i * cs + cs / 2 + 4}" text-anchor="end">${lab(k)}</text>` });
    for (let i = 0; i < n; i++)for (let j = 0; j < n; j++) {
        const m = M[i][j], val = mode === 'p' ? m.p : mode === 's' ? m.s : Math.abs(m.p - m.s), fill = !fin(val) ? 'transparent' : mode === 'd' ? `rgba(245,176,40,${Math.min(1, .06 + Math.abs(val) * 2.8)})` : val >= 0 ? `rgba(244,114,82,${.1 + .8 * Math.abs(val)})` : `rgba(56,140,248,${.1 + .8 * Math.abs(val)})`;
        const sel = (keys[i] === cmSel[0] && keys[j] === cmSel[1]) || (keys[j] === cmSel[0] && keys[i] === cmSel[1]);
        s += `<g data-i="${i}" data-j="${j}"><rect class="cell" x="${L + j * cs + 1}" y="${T + i * cs + 1}" width="${cs - 2}" height="${cs - 2}" rx="7" fill="${fill}" stroke="${sel ? 'var(--text)' : 'var(--border)'}" stroke-width="${sel ? 2.5 : 1}" style="animation-delay:${(i + j) * 28}ms" data-tip="<b>${lab(keys[i])} vs ${lab(keys[j])}</b><br>Pearson ${f(m.p, 3)}<br>Spearman ${f(m.s, 3)}<br>n = ${m.n}"/><text x="${L + j * cs + cs / 2}" y="${T + i * cs + cs / 2 + 4}" text-anchor="middle" style="fill:var(--text);font-size:11.5px;font-weight:600;pointer-events:none">${i === j ? '' : f(val, 2)}</text></g>`
    }
    $('#cmHeat').innerHTML = s + '</svg>';
    $('#cmTitle').textContent = (mode === 'p' ? 'Pearson' : mode === 's' ? 'Spearman' : '|Pearson − Spearman|') + ' matrix' + (des ? ' · seasonality removed' : '');
    $('#cmSub').textContent = (city === 'all' ? 'All cities pooled' : city) + ' · pairwise-complete days · ' + (mode === 'd' ? 'brighter amber = bigger disagreement' : 'red = positive, blue = negative');
    $$('#cmHeat g').forEach(g => g.onclick = () => { const i = +g.dataset.i, j = +g.dataset.j; if (i === j) return; cmSel = [keys[i], keys[j]]; renderCorr() });
    const [x, y] = pairs(ds, cmSel[0], cmSel[1], city), p = pearson(x, y), sp = spearman(x, y);
    $('#pairTitle').textContent = `${lab(cmSel[0])} vs ${lab(cmSel[1])}`; $('#pairSub').textContent = 'Dashed line = least-squares fit';
    scatter($('#pairSc'), { x, y, xl: `${lab(cmSel[0])} ${VARS[cmSel[0]].u}`, yl: `${lab(cmSel[1])} ${VARS[cmSel[1]].u}` });
    $('#pairStats').innerHTML = statCard('Pearson r', f(p, 3), 'p = ' + fmtP(corrP(p, x.length))) + statCard('Spearman ρ', f(sp, 3), 'p = ' + fmtP(corrP(sp, x.length))) + statCard('n pairs', x.length.toLocaleString(), 'complete days') + statCard('Gap |r−ρ|', f(Math.abs(p - sp), 3), Math.abs(p - sp) > .1 ? 'large: check outliers / curvature' : 'small: linear & rank agree');
}

/* lab */
const labC = mulberry32(99);
function labData(mode, K, M) {
    const r = mulberry32(4242), g = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()) }, n = 60, x = [], y = [], hl = [];
    if (mode === 'inflate') { for (let i = 0; i < n; i++) { const a = g(); x.push(5 + a); y.push(5 + .12 * a + g()) } for (let j = 0; j < K; j++) { x.push(5 + M * (.8 + .25 * j / 3)); y.push(5 + M * (.8 + .3 * ((j * 7) % 5) / 5)); hl.push(x.length - 1) } }
    else if (mode === 'destroy') { for (let i = 0; i < n; i++) { const a = g(); x.push(5 + a); y.push(5 + .9 * a + .45 * g()) } for (let j = 0; j < K; j++) { x.push(5 + g() * .8); y.push(5 - M * (.8 + .2 * ((j * 3) % 4) / 4)); hl.push(x.length - 1) } }
    else if (mode === 'monotone') { for (let i = 0; i < n; i++) { const a = r() * 6; x.push(a); y.push(Math.exp(a) + 8 * g()) } }
    else { for (let i = 0; i < n; i++) { const a = r() * 6 - 3; x.push(a); y.push(a * a + .5 * g()) } }
    const idx = [...hl]; return { x, y, hl: i => idx.includes(i) };
}

const LABWHY = {
    inflate: 'The 60 bulk points are almost uncorrelated. A handful of extreme points in the top-right corner have huge leverage on the <i>raw</i> values: Pearson squares deviations, so one point 8σ away contributes 64× a typical point. Ranks cap each point’s influence at its position (60th place at most), so Spearman barely moves. <b>Real-world analogue:</b> a Diwali night or dust storm where PM2.5, CO and temperature spike together.',
    destroy: 'A strong linear trend in the bulk is wrecked by a few points that sit far from the line. Squared deviations let them drag r downwards. In rank space they are only “lowest few” and the overall monotone trend survives, so ρ stays high. <b>Real-world analogue:</b> sensor glitches, or a lockdown week with abnormal pollution at normal traffic.',
    monotone: 'y = eˣ always increases with x, so the ranks match perfectly (ρ≈1), but the relationship is a curve, not a straight line, so Pearson is clearly lower. <b>Real-world analogue:</b> wind speed vs PM2.5. Pollutants dilute multiplicatively (concentration ∝ 1/ventilation), which is monotone but strongly convex.',
    ushape: 'y = x² is perfectly <i>dependent</i> on x, yet both coefficients are ≈0: Pearson looks for a straight line, Spearman for a consistently rising/falling trend, and a U-shape is neither. <b>Lesson:</b> a near-zero correlation does not mean “no relationship”. Always plot.'
};

function renderLab() {
    const mode = $('#labMode').value, K = +$('#labK').value, M = +$('#labM').value; $('#labKv').textContent = K; $('#labMv').textContent = M;
    $('#labK').disabled = $('#labM').disabled = !(mode === 'inflate' || mode === 'destroy');
    const d = labData(mode, K, M), p = pearson(d.x, d.y), s = spearman(d.x, d.y);
    scatter($('#labSc'), { x: d.x, y: d.y, xl: 'x', yl: 'y', hl: d.hl });
    $('#labStats').innerHTML = statCard('Pearson r', f(p, 3), 'sensitive to outliers') + statCard('Spearman ρ', f(s, 3), 'rank-based, robust') + statCard('|r − ρ|', f(Math.abs(p - s), 3), Math.abs(p - s) > .2 ? 'strong disagreement' : 'agreement');
    $('#labWhy').innerHTML = '<b>Why they differ:</b> ' + LABWHY[mode];
}

function renderReal() {
    const ds = DS(false), a = ['aqi', ...POLL].filter(hasVar), b = WX.filter(hasVar); let best = null;
    a.forEach(ka => b.forEach(kb => { const [x, y] = pairs(ds, ka, kb, 'all'); if (x.length < 50) return; const p = pearson(x, y), s = spearman(x, y), d = Math.abs(p - s); if (!best || d > best.d) best = { ka, kb, x, y, p, s, d } }));
    if (!best) { $('#realSub').textContent = 'Needs weather columns.'; $('#realSc').innerHTML = ''; $('#realStats').innerHTML = ''; $('#realWhy').innerHTML = ''; return }
    const { ka, kb, x, y, p, s } = best; $('#realSub').textContent = `${lab(ka)} vs ${lab(kb)} · all cities, ${x.length.toLocaleString()} days (auto-selected: largest |r − ρ|)`;
    scatter($('#realSc'), { x, y, xl: lab(kb) + ' ' + VARS[kb].u, yl: lab(ka) + ' ' + VARS[ka].u, h: 360 });
    $('#realStats').innerHTML = statCard('Pearson r', f(p, 3), 'p = ' + fmtP(corrP(p, x.length))) + statCard('Spearman ρ', f(s, 3), 'p = ' + fmtP(corrP(s, x.length)));
    const dx = describe(x), dy = describe(y), zeros = x.filter(v => v === 0).length / x.length, why = [];
    if (zeros > .2) why.push(`<b>${f(zeros * 100, 0)}%</b> of ${lab(kb)} values are exactly 0 (dry days). Pearson treats this as a huge spike at zero plus a skewed tail; Spearman gives all ties one shared average rank.`);
    if (Math.abs(dy.skew) > 1) why.push(`${lab(ka)} is strongly skewed (skew ${f(dy.skew, 1)}), so a few extreme days dominate Pearson.`);
    if (Math.abs(dx.skew) > 1) why.push(`${lab(kb)} is skewed (${f(dx.skew, 1)}), so extreme values get high leverage.`);
    why.push(Math.abs(p) < Math.abs(s) ? `|ρ| &gt; |r|: the relationship is monotone but <b>non-linear</b> (a bent, not straight, trend), so the linear coefficient understates it.` : `|r| &gt; |ρ|: the linear fit is propped up by a few <b>extreme points</b> rather than a consistent trend.`);
    $('#realWhy').innerHTML = why.join(' ');
}

/* tests */
function acf1(ds, k) { const [x, y] = lagPairs(ds, k, k, 1, 'all'); return pearson(x, y) }
function renderTests() {
    const ds = DS(), k = $('#tVar').value, by = $('#tBy').value, res = $('#tRes').value; let groups;
    if (by === 'city') groups = ds.cities.map(c => ({ label: c, values: vals(ds, k, { city: c, season: res === 'all' ? null : +res }) })); else groups = SEASONS.map((s, i) => ({ label: s, values: vals(ds, k, { season: i, city: res === 'all' ? null : res }) }));
    const A = anova(groups.map(g => g.values)), K = kruskal(groups.map(g => g.values)), st = groups.map(g => describe(g.values));
    const eff = (v, t) => v < t[0] ? 'negligible' : v < t[1] ? 'small' : v < t[2] ? 'medium' : 'large';
    if (!A || !K) { $('#anova').innerHTML = $('#kw').innerHTML = '<p class="muted">Not enough groups.</p>'; return }
    const sig = p => p < .05 ? `<span class="tag s">p &lt; 0.05 → reject H₀</span>` : `<span class="tag r">p ≥ 0.05 → cannot reject H₀</span>`;
    $('#anova').innerHTML = `<div class="grid2" style="gap:10px">${statCard('F (' + A.d1 + ', ' + A.d2 + ')', f(A.F, 2), sig(A.p)) + statCard('p-value', fmtP(A.p), '') + statCard('η² effect size', f(A.eta, 3), eff(A.eta, [.01, .06, .14]) + ' · ' + f(A.eta * 100, 1) + '% of variance') + statCard('Groups / N', A.k + ' / ' + A.N.toLocaleString(), '')}</div>`;
    $('#kw').innerHTML = `<div class="grid2" style="gap:10px">${statCard('H (' + K.df + ' df)', f(K.H, 1), sig(K.p)) + statCard('p-value', fmtP(K.p), 'χ² approximation, tie-corrected') + statCard('ε² effect size', f(K.eps, 3), eff(K.eps, [.01, .08, .26])) + statCard('Groups / N', K.k + ' / ' + K.N.toLocaleString(), '')}</div>`;
    barChart($('#tCI'), { labels: groups.map(g => g.label), series: [{ name: 'Mean', values: st.map(s => s.mean), err: st.map(s => 1.96 * s.sd / Math.sqrt(s.n)), color: 'var(--accent2)' }], fmt: v => v.toFixed(1), rot: by === 'city' });
    const sds = st.map(s => s.sd).filter(fin), ratio = Math.max(...sds) / Math.min(...sds), r1 = acf1(ds, k), neff = A.N * (1 - r1) / (1 + r1), avgSk = st.reduce((s, x) => s + (fin(x.skew) ? x.skew : 0), 0) / st.length;
    $('#tNote').innerHTML = `<div class="tbl-wrap"><table><tbody><tr><td>Largest / smallest group SD</td><td><b>${f(ratio, 2)}</b></td><td>${ratio > 2 ? '<span class="tag r">unequal variance</span>' : '<span class="tag s">OK</span>'}</td></tr><tr><td>Average skewness</td><td><b>${f(avgSk, 2)}</b></td><td>${Math.abs(avgSk) > .5 ? '<span class="tag r">non-normal</span>' : '<span class="tag s">OK</span>'}</td></tr><tr><td>Lag-1 autocorrelation</td><td><b>${f(r1, 2)}</b></td><td><span class="tag r">days not independent</span></td></tr><tr><td>Effective sample size</td><td><b>${f(neff, 0)}</b></td><td class="muted">vs N = ${A.N.toLocaleString()}</td></tr></tbody></table></div>
<div class="callout"><b>Reading it:</b> ${K.p < .05 ? 'AQI <b>does</b> differ between ' + (by === 'city' ? 'cities' : 'seasons') + ' (Kruskal–Wallis).' : 'No reliable difference detected.'} Effect size says <b>how much</b>: ε² = ${f(K.eps, 2)} (${eff(K.eps, [.01, .08, .26])}). Because daily AQI is skewed with unequal spreads, trust Kruskal–Wallis over ANOVA. And because each day resembles yesterday (autocorrelation), the real sample is closer to ~${f(neff, 0)} independent days, so p-values are <i>over-optimistic</i>. A block bootstrap or mixed model would be the rigorous follow-up.</div>`;
}
function setTestRestrict() { const by = $('#tBy').value; fill('#tRes', by === 'city' ? [['all', 'All seasons']].concat(SEASONS.map((s, i) => [i, s])) : [['all', 'All cities']].concat(Object.keys(RAW).map(c => [c, c])), 'all'); $('#tRes').value = 'all' }

/* lag */
function renderLag() {
    const kx = $('#lagVar').value, city = $('#lagCity').value, des = $('#lagDes').checked, ds = DS(des), P = [], S = [], labels = [];
    for (let L = 0; L <= 7; L++) { const [x, y] = lagPairs(ds, kx, 'aqi', kx === 'aqi' && L === 0 ? 0 : L, city); labels.push('k=' + L); P.push(pearson(x, y)); S.push(spearman(x, y)) }
    $('#lagTitle').textContent = `${lab(kx)}(t−k) → AQI(t)` + (des ? ' · seasonality removed' : '');
    barChart($('#lagBar'), { labels, series: [{ name: 'Pearson', values: P }, { name: 'Spearman', values: S }], fmt: v => v.toFixed(3) });
    const start = kx === 'aqi' ? 1 : 0; let bi = start; for (let i = start; i < 8; i++)if (Math.abs(P[i]) > Math.abs(P[bi])) bi = i;
    let part = NaN; if (kx !== 'aqi') {
        const xs = [], ys = [], zs = []; for (const nm of ds.cities) { if (city !== 'all' && nm !== city) continue; const c = ds.c[nm], a = c.v[kx], q = c.v.aqi; for (let i = 1; i < c.n; i++)if (fin(a[i - 1]) && fin(q[i - 1]) && fin(q[i])) { xs.push(a[i - 1]); zs.push(q[i - 1]); ys.push(q[i]) } }
        const rxy = pearson(xs, ys), rxz = pearson(xs, zs), ryz = pearson(zs, ys); part = (rxy - rxz * ryz) / Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz))
    }
    $('#lagStats').innerHTML = statCard('Strongest lag', 'k = ' + bi, 'r = ' + f(P[bi], 3)) + statCard('Same-day r', f(P[0], 3), kx === 'aqi' ? '(trivially 1)' : 'k = 0') + statCard('Yesterday r', f(P[1], 3), 'k = 1') + statCard('Partial r (k=1)', kx === 'aqi' ? '—' : f(part, 3), kx === 'aqi' ? '' : 'controlling for yesterday’s AQI');
    $('#lagNote').innerHTML = kx === 'aqi' ? '<b>Persistence baseline:</b> AQI is strongly autocorrelated, so “tomorrow ≈ today” is hard to beat. Any weather predictor should be judged on what it adds beyond this.' : `<b>Does yesterday’s ${lab(kx)} help?</b> The <i>partial</i> correlation removes what yesterday’s AQI already explains: ${Math.abs(part) < .05 ? 'almost nothing extra remains, so most of the apparent lagged effect is just AQI persistence.' : `a residual association of ${f(part, 2)} remains, so there is predictive information beyond persistence.`} This is <b>predictive</b> association, not proof of cause. ${(kx === 'wind' || kx === 'rain') ? 'Physically plausible: ventilation and wet-deposition act with a delay.' : ''} ${!des && ['temp', 'hum', 'pres'].includes(kx) ? 'Without removing seasonality this mostly reflects the winter/summer cycle.' : ''}`;
}

/* findings */
function renderFindings() {
    const ds = DS(), out = [];
    try {
        const cm = ds.cities.map(c => [c, describe(vals(ds, 'aqi', { city: c })).mean]).filter(x => fin(x[1])).sort((a, b) => b[1] - a[1]), ss = SEASONS.map((s, i) => [s, describe(vals(ds, 'aqi', { season: i })).mean]).sort((a, b) => b[1] - a[1]);
        out.push(['1', `<b>${cm[0][0]}</b> has the highest mean AQI (${f(cm[0][1], 0)}, ${bucket(cm[0][1]).n}); <b>${cm[cm.length - 1][0]}</b> the lowest (${f(cm[cm.length - 1][1], 0)}). By season, <b>${ss[0][0]}</b> is worst (${f(ss[0][1], 0)}) and <b>${ss[3][0]}</b> best (${f(ss[3][1], 0)}).`]);
        const Kc = kruskal(ds.cities.map(c => vals(ds, 'aqi', { city: c }))), Ks = kruskal(SEASONS.map((_, i) => vals(ds, 'aqi', { season: i })));
        out.push(['2', `Kruskal–Wallis rejects equal AQI across cities (H=${f(Kc.H, 0)}, p ${fmtP(Kc.p)}, ε²=${f(Kc.eps, 2)}) and across seasons (H=${f(Ks.H, 0)}, p ${fmtP(Ks.p)}, ε²=${f(Ks.eps, 2)}). Compare the <b>effect sizes</b>: ${Kc.eps > Ks.eps ? 'city explains more of the rank variation than season' : 'season explains more than city'}. With thousands of autocorrelated days, tiny p-values are easy; effect size is the real message.`]);
        const dA = describe(vals(ds, 'aqi')); out.push(['3', `Daily AQI is ${dA.skew > .5 ? 'right-skewed' : 'roughly symmetric'} (skew ${f(dA.skew, 2)}; mean ${f(dA.mean, 0)} vs median ${f(dA.median, 0)}), with ${f(dA.out / dA.n * 100, 1)}% of days beyond Tukey fences. Summaries should lead with the median.`]);
        const wk = WX.filter(hasVar);
        if (wk.length) {
            const rw = wk.map(k => { const [x, y] = pairs(ds, k, 'aqi', 'all'), [x2, y2] = pairs(DS(true), k, 'aqi', 'all'); return [k, pearson(x, y), pearson(x2, y2)] }).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
            out.push(['4', `The weather variable most correlated with AQI is <b>${lab(rw[0][0])}</b> (r = ${f(rw[0][1], 2)}). After removing monthly seasonality it becomes r = ${f(rw[0][2], 2)}${Math.abs(rw[0][2]) < Math.abs(rw[0][1]) * .7 ? ', so a large share of the raw association was <b>seasonal confounding</b>, not a direct effect' : ''}. Correlation ≠ causation.`]);
            const al = ['aqi', ...POLL].filter(hasVar); let best = null; al.forEach(a => wk.forEach(b => { const [x, y] = pairs(ds, a, b, 'all'); if (x.length < 50) return; const p = pearson(x, y), s = spearman(x, y); if (!best || Math.abs(p - s) > best.d) best = { a, b, p, s, d: Math.abs(p - s) } }));
            if (best) out.push(['5', `Pearson and Spearman disagree most for <b>${lab(best.a)} vs ${lab(best.b)}</b> (r=${f(best.p, 2)}, ρ=${f(best.s, 2)}). The cause is skew, ties and non-linearity, so use both and look at the scatter plot.`]);
            const [lx, ly] = lagPairs(ds, 'wind', 'aqi', 1, 'all'), [l0x, l0y] = lagPairs(ds, 'wind', 'aqi', 0, 'all');
            if (hasVar('wind')) out.push(['6', `Wind speed correlates with AQI at r = ${f(pearson(l0x, l0y), 2)} same-day and ${f(pearson(lx, ly), 2)} with a one-day lag. Wind clears pollutants, and yesterday’s wind still carries information (see the partial correlation in the lag section).`])
        }
        const m = ds.cities.reduce((s, c) => s + ds.c[c].v.aqi.filter(v => !fin(v)).length, 0), t = ds.cities.reduce((s, c) => s + ds.c[c].n, 0);
        out.push(['7', `${f(m / t * 100, 1)}% of city-days lack an AQI value under the current gap policy. Outages are clustered in multi-day blocks, so dropping rows is safe for correlations but interpolating beyond a few days would fabricate data.`]);
    } catch (e) { out.push(['!', 'Some findings need weather columns or more data: ' + e.message]) }
    $('#findList').innerHTML = out.map(([i, t], k) => `<div class="card find" style="animation-delay:${k * 80}ms"><div class="ic">${i}</div><div>${t}</div></div>`).join('');
}
