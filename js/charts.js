'use strict';
/* ============ SVG charts ============ */
const svgOpen = (w, h) => `<svg viewBox="0 0 ${w} ${h}" class="chart">`;
function ticks(min, max, n = 5) { const span = max - min || 1, s0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(s0))), nm = s0 / mag, step = (nm < 1.5 ? 1 : nm < 3 ? 2 : nm < 7 ? 5 : 10) * mag, t = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step)t.push(+v.toFixed(10)); return t }
const tf = v => Math.abs(v) >= 1000 ? (v / 1000) + 'k' : Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : (+v.toFixed(1)) + '';
const COLORS = ['var(--accent)', 'var(--accent2)', 'var(--warn)', 'var(--bad)'];

function barChart(el, { labels, series, fmt = v => v.toFixed(0), h = 340, rot = false }) {
    const w = 720, m = { l: 54, r: 14, t: 16, b: rot ? 60 : 44 }; let lo = 0, hi = 0;
    series.forEach(s => s.values.forEach((v, i) => { if (!fin(v)) return; const e = s.err ? s.err[i] || 0 : 0; hi = Math.max(hi, v + e); lo = Math.min(lo, v - e) }));
    if (hi === lo) hi = lo + 1; const pad = (hi - lo) * .08; hi += pad; if (lo < 0) lo -= pad;
    const X0 = m.l, X1 = w - m.r, Y0 = h - m.b, Y1 = m.t, y = v => Y0 - (v - lo) / (hi - lo) * (Y0 - Y1), gw = (X1 - X0) / labels.length, bw = Math.min(40, gw * .78 / series.length);
    let s = `<div class="legend">${series.length > 1 ? series.map((q, i) => `<span><i style="background:${q.color || COLORS[i]}"></i>${q.name}</span>`).join('') : ''}</div>` + svgOpen(w, h);
    ticks(lo, hi, 5).forEach(t => s += `<line class="grid" x1="${X0}" x2="${X1}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${X0 - 8}" y="${y(t) + 4}" text-anchor="end">${tf(t)}</text>`);
    s += `<line x1="${X0}" x2="${X1}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-width="1"/>`;
    labels.forEach((l, i) => { const cx = X0 + gw * (i + .5); s += rot ? `<text class="tick" transform="translate(${cx},${Y0 + 14}) rotate(-35)" text-anchor="end">${l}</text>` : `<text class="tick" x="${cx}" y="${Y0 + 18}" text-anchor="middle">${l}</text>` });
    series.forEach((q, si) => q.values.forEach((v, i) => {
        if (!fin(v)) return; const gx = X0 + gw * i + (gw - bw * series.length) / 2 + si * bw, y0 = y(0), y1 = y(v), col = q.color || COLORS[si];
        s += `<rect class="bar" x="${gx.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="3" fill="${col}" style="transform-origin:${gx}px ${y0}px;animation-delay:${i * 45 + si * 25}ms" data-tip="<b>${labels[i]}</b><br>${q.name}: ${fmt(v)}${q.err ? ' ± ' + fmt(q.err[i]) : ''}"/>`;
        if (q.err && fin(q.err[i])) { const cx = gx + bw / 2 - 1; s += `<line x1="${cx}" x2="${cx}" y1="${y(v - q.err[i])}" y2="${y(v + q.err[i])}" stroke="var(--text)" stroke-width="1.6"/><line x1="${cx - 4}" x2="${cx + 4}" y1="${y(v + q.err[i])}" y2="${y(v + q.err[i])}" stroke="var(--text)"/><line x1="${cx - 4}" x2="${cx + 4}" y1="${y(v - q.err[i])}" y2="${y(v - q.err[i])}" stroke="var(--text)"/>` }
    }));
    el.innerHTML = s + '</svg>';
}

function boxPlot(el, groups, { fmt = v => v.toFixed(0) } = {}) {
    const w = 720, h = 340, m = { l: 54, r: 14, t: 14, b: 44 }, st = groups.map(g => { const a = clean(g.values).sort((x, y) => x - y); if (a.length < 4) return null; const q1 = quantile(a, .25), q2 = quantile(a, .5), q3 = quantile(a, .75), i = q3 - q1, lf = q1 - 1.5 * i, uf = q3 + 1.5 * i, ins = a.filter(v => v >= lf && v <= uf); return { q1, q2, q3, lo: ins[0], hi: ins[ins.length - 1], out: a.filter(v => v < lf || v > uf), mn: a[0], mx: a[a.length - 1] } });
    let lo = Infinity, hi = -Infinity; st.forEach(s => { if (s) { lo = Math.min(lo, s.mn); hi = Math.max(hi, s.mx) } }); if (!fin(lo)) { el.innerHTML = '<p class="muted">No data</p>'; return }
    if (lo >= 0) lo = 0; hi += (hi - lo) * .05; const X0 = m.l, X1 = w - m.r, Y0 = h - m.b, Y1 = m.t, y = v => Y0 - (v - lo) / (hi - lo) * (Y0 - Y1), gw = (X1 - X0) / groups.length;
    let s = svgOpen(w, h); ticks(lo, hi, 5).forEach(t => s += `<line class="grid" x1="${X0}" x2="${X1}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${X0 - 8}" y="${y(t) + 4}" text-anchor="end">${tf(t)}</text>`);
    groups.forEach((g, i) => {
        const cx = X0 + gw * (i + .5), q = st[i], bw = Math.min(46, gw * .55); s += `<text class="tick" x="${cx}" y="${Y0 + 18}" text-anchor="middle">${g.label}</text>`; if (!q) return; const col = COLORS[i % 2 ? 1 : 0];
        s += `<g class="box" style="transform-origin:${cx}px ${y(q.q2)}px;animation-delay:${i * 60}ms" data-tip="<b>${g.label}</b><br>median ${fmt(q.q2)} · IQR ${fmt(q.q1)}–${fmt(q.q3)}<br>whiskers ${fmt(q.lo)}–${fmt(q.hi)}<br>${q.out.length} outliers"><line x1="${cx}" x2="${cx}" y1="${y(q.lo)}" y2="${y(q.hi)}" stroke="var(--muted)" stroke-width="1.5"/><rect x="${cx - bw / 2}" y="${y(q.q3)}" width="${bw}" height="${Math.max(1, y(q.q1) - y(q.q3))}" rx="4" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="1.8"/><line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y(q.q2)}" y2="${y(q.q2)}" stroke="var(--text)" stroke-width="2.4"/></g>`;
        const step = Math.max(1, Math.ceil(q.out.length / 40)); q.out.forEach((v, j) => { if (j % step === 0) s += `<circle class="pt" cx="${cx + ((j * 37 % 11) - 5) * .8}" cy="${y(v)}" r="2.3" fill="${col}" fill-opacity=".6" style="animation-delay:${600 + i * 60}ms"/>` })
    });
    el.innerHTML = s + '</svg>';
}

function histogram(el, arr, bins = 32) {
    const a = clean(arr); if (a.length < 5) { el.innerHTML = '<p class="muted">No data</p>'; return null }
    const w = 720, h = 300, m = { l: 54, r: 14, t: 18, b: 40 }, lo = Math.min(...a), hi = Math.max(...a), bw = (hi - lo) / bins || 1, cnt = new Array(bins).fill(0); a.forEach(v => cnt[Math.min(bins - 1, Math.floor((v - lo) / bw))]++);
    const mx = Math.max(...cnt) * 1.1, X0 = m.l, X1 = w - m.r, Y0 = h - m.b, Y1 = m.t, x = v => X0 + (v - lo) / (hi - lo || 1) * (X1 - X0), y = c => Y0 - c / mx * (Y0 - Y1), d = describe(a);
    let s = svgOpen(w, h); ticks(0, mx, 4).forEach(t => s += `<line class="grid" x1="${X0}" x2="${X1}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${X0 - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`);
    ticks(lo, hi, 6).forEach(t => s += `<text class="tick" x="${x(t)}" y="${Y0 + 18}" text-anchor="middle">${tf(t)}</text>`);
    cnt.forEach((c, i) => s += `<rect class="bar" x="${X0 + i * (X1 - X0) / bins + 1}" y="${y(c)}" width="${(X1 - X0) / bins - 2}" height="${Y0 - y(c)}" rx="2" fill="var(--accent2)" fill-opacity=".75" style="transform-origin:0 ${Y0}px;animation-delay:${i * 18}ms" data-tip="${f(lo + i * bw, 0)}–${f(lo + (i + 1) * bw, 0)}: ${c} days"/>`);
    s += `<line x1="${x(d.mean)}" x2="${x(d.mean)}" y1="${Y1}" y2="${Y0}" stroke="var(--bad)" stroke-width="2" stroke-dasharray="5 3"/><text class="tick" x="${x(d.mean) + 5}" y="${Y1 + 10}" style="fill:var(--bad)">mean ${f(d.mean, 0)}</text>`;
    s += `<line x1="${x(d.median)}" x2="${x(d.median)}" y1="${Y1}" y2="${Y0}" stroke="var(--good)" stroke-width="2"/><text class="tick" x="${x(d.median) - 5}" y="${Y1 + 24}" text-anchor="end" style="fill:var(--good)">median ${f(d.median, 0)}</text>`;
    el.innerHTML = s + '</svg>'; return d;
}

function scatter(el, { x, y, xl, yl, hl, line = true, w = 560, h = 380, maxPts = 1400 }) {
    const n = x.length; if (n < 3) { el.innerHTML = '<p class="muted">Not enough paired data.</p>'; return }
    const m = { l: 56, r: 16, t: 14, b: 46 }; let x0 = Math.min(...x), x1 = Math.max(...x), y0 = Math.min(...y), y1 = Math.max(...y); const px = (x1 - x0) * .05 || 1, py = (y1 - y0) * .05 || 1; x0 -= px; x1 += px; y0 -= py; y1 += py;
    const X0 = m.l, X1 = w - m.r, Y0 = h - m.b, Y1 = m.t, sx = v => X0 + (v - x0) / (x1 - x0) * (X1 - X0), sy = v => Y0 - (v - y0) / (y1 - y0) * (Y0 - Y1);
    let s = svgOpen(w, h); ticks(y0, y1, 5).forEach(t => s += `<line class="grid" x1="${X0}" x2="${X1}" y1="${sy(t)}" y2="${sy(t)}"/><text class="tick" x="${X0 - 8}" y="${sy(t) + 4}" text-anchor="end">${tf(t)}</text>`);
    ticks(x0, x1, 6).forEach(t => s += `<text class="tick" x="${sx(t)}" y="${Y0 + 18}" text-anchor="middle">${tf(t)}</text>`);
    s += `<text class="lbl" x="${(X0 + X1) / 2}" y="${h - 6}" text-anchor="middle">${xl}</text><text class="lbl" transform="translate(13,${(Y0 + Y1) / 2}) rotate(-90)" text-anchor="middle">${yl}</text>`;
    const step = Math.max(1, Math.ceil(n / maxPts)); for (let i = 0; i < n; i += step) { const hi = hl && hl(i); s += `<circle class="pt" cx="${sx(x[i]).toFixed(1)}" cy="${sy(y[i]).toFixed(1)}" r="${hi ? 5 : 2.7}" fill="${hi ? 'var(--bad)' : 'var(--accent)'}" fill-opacity="${hi ? .95 : .45}" style="animation-delay:${Math.min(900, i / n * 900)}ms"/>` }
    if (line) {
        let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i]; my += y[i] } mx /= n; my /= n; let a = 0, b = 0; for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2 } const sl = b ? a / b : 0, ic = my - sl * mx;
        s += `<line x1="${sx(x0)}" y1="${sy(ic + sl * x0)}" x2="${sx(x1)}" y2="${sy(ic + sl * x1)}" stroke="var(--warn)" stroke-width="2.2" stroke-dasharray="6 4" clip-path="inset(0)"/>`
    }
    el.innerHTML = s + '</svg>';
}

function timeSeries(el, { c, k, flag, lo, hi }) {
    const w = 980, h = 300, m = { l: 54, r: 14, t: 14, b: 36 }, a = c.v[k], n = c.n; let vmin = Infinity, vmax = -Infinity; for (let i = 0; i < n; i++)if (fin(a[i])) { vmin = Math.min(vmin, a[i]); vmax = Math.max(vmax, a[i]) }
    if (!fin(vmin)) { el.innerHTML = '<p class="muted">No data</p>'; return } vmin = Math.min(0, vmin); vmax += (vmax - vmin) * .05;
    const X0 = m.l, X1 = w - m.r, Y0 = h - m.b, Y1 = m.t, x = i => X0 + i / (n - 1) * (X1 - X0), y = v => Y0 - (v - vmin) / (vmax - vmin) * (Y0 - Y1);
    let s = svgOpen(w, h); ticks(vmin, vmax, 5).forEach(t => s += `<line class="grid" x1="${X0}" x2="${X1}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${X0 - 8}" y="${y(t) + 4}" text-anchor="end">${tf(t)}</text>`);
    let i = 0; while (i < n) { if (!fin(a[i])) { let j = i; while (j < n && !fin(a[j])) j++; s += `<rect x="${x(i)}" y="${Y1}" width="${Math.max(1, x(j) - x(i))}" height="${Y0 - Y1}" fill="var(--bad)" fill-opacity=".14"/>`; i = j } else i++ }
    for (let q = 0; q < n; q++) { const d = new Date(c.date[q]); if (d.getUTCDate() === 1 && d.getUTCMonth() % (n > 1500 ? 6 : 3) === 0) s += `<text class="tick" x="${x(q)}" y="${Y0 + 18}" text-anchor="middle">${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}</text>` }
    let p = '', pen = false; for (let q = 0; q < n; q++) { if (fin(a[q])) { p += (pen ? 'L' : 'M') + x(q).toFixed(1) + ' ' + y(a[q]).toFixed(1); pen = true } else pen = false }
    s += `<path class="draw" pathLength="1" d="${p}" stroke="var(--accent2)" stroke-width="1.3"/>`;
    if (fin(hi)) s += `<line x1="${X0}" x2="${X1}" y1="${y(hi)}" y2="${y(hi)}" stroke="var(--warn)" stroke-dasharray="6 4"/><text class="tick" x="${X1}" y="${y(hi) - 5}" text-anchor="end" style="fill:var(--warn)">upper fence ${f(hi, 0)}</text>`;
    if (fin(lo) && lo > vmin) s += `<line x1="${X0}" x2="${X1}" y1="${y(lo)}" y2="${y(lo)}" stroke="var(--warn)" stroke-dasharray="6 4"/>`;
    for (let q = 0; q < n; q++)if (flag[q]) s += `<circle class="pt" cx="${x(q)}" cy="${y(a[q])}" r="3.4" fill="var(--bad)" style="animation-delay:1.4s" data-tip="${new Date(c.date[q]).toISOString().slice(0, 10)}<br><b>${f(a[q], 1)}</b>"/>`;
    el.innerHTML = s + '</svg>';
}