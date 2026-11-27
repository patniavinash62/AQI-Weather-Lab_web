'use strict';
/* ============ statistics ============ */
const clean = a => Array.from(a).filter(fin);
function quantile(s, p) { if (!s.length) return NaN; const h = (s.length - 1) * p, lo = Math.floor(h), hi = Math.min(lo + 1, s.length - 1); return s[lo] + (h - lo) * (s[hi] - s[lo]) }
function describe(arr) {
    const tot = arr.length, a = clean(arr).sort((x, y) => x - y), n = a.length;
    if (n < 2) return { n, tot, miss: tot ? 1 - n / tot : NaN, mean: NaN, median: NaN, mode: NaN, sd: NaN, iqr: NaN, skew: NaN, out: 0, q1: NaN, q3: NaN, min: NaN, max: NaN };
    const mean = a.reduce((s, v) => s + v, 0) / n; let m2 = 0, m3 = 0; a.forEach(v => { const d = v - mean; m2 += d * d; m3 += d * d * d });
    const sd = Math.sqrt(m2 / (n - 1)), g1 = m2 ? (m3 / n) / Math.pow(m2 / n, 1.5) : 0, skew = n > 2 ? g1 * Math.sqrt(n * (n - 1)) / (n - 2) : g1;
    const q1 = quantile(a, .25), median = quantile(a, .5), q3 = quantile(a, .75), iqr = q3 - q1, lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
    const out = a.filter(v => v < lf || v > uf).length, min = a[0], max = a[n - 1], bw = (max - min) / 25 || 1, cnt = {}; let best = -1, mode = NaN;
    a.forEach(v => { const b = Math.floor((v - min) / bw); cnt[b] = (cnt[b] || 0) + 1 }); for (const b in cnt) if (cnt[b] > best) { best = cnt[b]; mode = min + (+b + .5) * bw }
    return { n, tot, miss: 1 - n / tot, mean, median, mode, sd, iqr, q1, q3, min, max, skew, out, lf, uf };
}
function ranks(a) { const idx = a.map((_, i) => i).sort((i, j) => a[i] - a[j]), r = new Array(a.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++)r[idx[k]] = avg; i = j + 1 } return r }
function pearson(x, y) { const n = x.length; if (n < 3) return NaN; let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i] } const mx = sx / n, my = sy / n; let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; a += dx * dy; b += dx * dx; c += dy * dy } return b && c ? a / Math.sqrt(b * c) : NaN }
const spearman = (x, y) => x.length < 3 ? NaN : pearson(ranks(x), ranks(y));
function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, .1208650973866179e-2, -.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + .5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++)s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x) }
function betacf(a, b, x) { const FP = 1e-300, qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d; for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break } return h }
function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b }
function gammq(a, x) {
    if (x <= 0) return 1; const g = Math.exp(-x + a * Math.log(x) - lgamma(a)); if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break } return Math.max(0, 1 - sum * g) }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 1000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break } return g * h
}
function corrP(r, n) { if (!fin(r) || n < 3) return NaN; if (Math.abs(r) >= 1) return 0; const df = n - 2, t = r * Math.sqrt(df / (1 - r * r)); return ibeta(df / (df + t * t), df / 2, .5) }
function anova(groups) {
    const g = groups.map(x => clean(x)).filter(x => x.length > 1), k = g.length, N = g.reduce((s, x) => s + x.length, 0); if (k < 2) return null;
    const gm = g.reduce((s, x) => s + x.reduce((a, b) => a + b, 0), 0) / N; let ssb = 0, ssw = 0;
    g.forEach(x => { const m = x.reduce((a, b) => a + b, 0) / x.length; ssb += x.length * (m - gm) ** 2; x.forEach(v => ssw += (v - m) ** 2) });
    const d1 = k - 1, d2 = N - k, F = (ssb / d1) / (ssw / d2); return { F, d1, d2, p: ibeta(d2 / (d2 + d1 * F), d2 / 2, d1 / 2), eta: ssb / (ssb + ssw), N, k };
}
function kruskal(groups) {
    const g = groups.map(x => clean(x)).filter(x => x.length > 1), k = g.length; if (k < 2) return null;
    const all = [], lab = []; g.forEach((x, i) => x.forEach(v => { all.push(v); lab.push(i) })); const N = all.length, r = ranks(all), R = new Array(k).fill(0);
    r.forEach((v, i) => R[lab[i]] += v); let H = 12 / (N * (N + 1)) * R.reduce((s, v, i) => s + v * v / g[i].length, 0) - 3 * (N + 1);
    const srt = [...all].sort((a, b) => a - b); let ties = 0, i = 0; while (i < N) { let j = i; while (j + 1 < N && srt[j + 1] === srt[i]) j++; const t = j - i + 1; ties += t ** 3 - t; i = j + 1 }
    H /= 1 - ties / (N ** 3 - N); return { H, df: k - 1, p: gammq((k - 1) / 2, H / 2), eps: H / (N - 1), N, k };
}