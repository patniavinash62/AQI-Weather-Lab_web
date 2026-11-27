'use strict';
/* ============ theme + background + reveal + UI helpers ============ */
const themeBtn = $('#themeBtn');
const setIcon = () => themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'; setIcon();
themeBtn.onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); setIcon() };

(function () {
    const cv = $('#bg'), ctx = cv.getContext('2d'); let W, H, P = [], rgb = '45,212,191', tick = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function size() { const r = devicePixelRatio || 1; W = cv.width = innerWidth * r; H = cv.height = innerHeight * r; P = Array.from({ length: Math.min(80, Math.floor(innerWidth / 16)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35 * r, vy: (Math.random() - .5) * .35 * r, r: (1 + Math.random() * 2) * r })) }
    size(); addEventListener('resize', size);
    function frame() {
        if (tick++ % 20 === 0) rgb = getComputedStyle(document.documentElement).getPropertyValue('--particle').trim(); ctx.clearRect(0, 0, W, H);
        P.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; ctx.fillStyle = `rgba(${rgb},.55)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
            for (let j = i + 1; j < P.length; j++) { const q = P[j], d = Math.hypot(p.x - q.x, p.y - q.y), lim = 140 * (devicePixelRatio || 1); if (d < lim) { ctx.strokeStyle = `rgba(${rgb},${.16 * (1 - d / lim)})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke() } }
        });
        if (!reduce) requestAnimationFrame(frame)
    }
    frame();
})();

const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: .08 });
const observeReveal = () => $$('.reveal:not(.in)').forEach(e => io.observe(e));
const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) $$('#links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)) }), { rootMargin: '-40% 0px -55% 0px' });
$$('section[id]').forEach(s => spy.observe(s));
function countUp(el, to, dec = 0, suffix = '') { const t0 = performance.now(); (function step(t) { const p = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toLocaleString(undefined, { maximumFractionDigits: dec, minimumFractionDigits: dec }) + suffix; if (p < 1) requestAnimationFrame(step) })(t0) }

/* ============ UI helpers ============ */
function fill(sel, opts, val) { const e = typeof sel === 'string' ? $(sel) : sel; const keep = val ?? e.value; e.innerHTML = opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join(''); if (opts.some(o => String(o[0]) === String(keep))) e.value = keep }
const varOpts = () => availKeys().map(k => [k, lab(k) + (VARS[k].u ? ` (${VARS[k].u})` : '')]);
const cityOpts = (all = true) => (all ? [['all', 'All cities']] : []).concat(Object.keys(RAW).map(c => [c, c]));
function segBind(id, cb, attr) { $$('#' + id + ' button').forEach(b => b.onclick = () => { $$('#' + id + ' button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cb(b.dataset[attr]) }) }
function statCard(k, v, s = '') { return `<div class="card stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>` }
function skewTag(s) { return !fin(s) ? '—' : Math.abs(s) < .5 ? '<span class="tag s">≈ symmetric</span>' : s > 0 ? '<span class="tag r">right-skewed</span>' : '<span class="tag l">left-skewed</span>' }