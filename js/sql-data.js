'use strict';
/* ============ SQL viewer, ER diagram & DSA cards ============ */
const SQL = {
    Schema: [`-- PostgreSQL schema: cities → stations → readings;  cities → weather_daily
CREATE TABLE cities (
  city_id      SERIAL PRIMARY KEY,
  name         VARCHAR(60) UNIQUE NOT NULL,
  state        VARCHAR(60),
  climate_zone VARCHAR(30)
);
CREATE TABLE stations (
  station_id   VARCHAR(12) PRIMARY KEY,
  city_id      INT NOT NULL REFERENCES cities(city_id),
  station_name VARCHAR(120),
  latitude     NUMERIC(8,5),
  longitude    NUMERIC(8,5)
);
CREATE TABLE readings (
  station_id VARCHAR(12) REFERENCES stations(station_id),
  obs_date   DATE NOT NULL,
  pm25 REAL, pm10 REAL, no2 REAL, so2 REAL, co REAL, o3 REAL, aqi REAL,
  PRIMARY KEY (station_id, obs_date),            -- no duplicate days
  CHECK (pm25 IS NULL OR pm25 >= 0)              -- NULL = missing, never 0
);
CREATE TABLE weather_daily (
  city_id INT REFERENCES cities(city_id),
  obs_date DATE NOT NULL,
  temp_c REAL, humidity_pct REAL, wind_kmh REAL, rain_mm REAL, pressure_hpa REAL,
  PRIMARY KEY (city_id, obs_date)
);
CREATE INDEX idx_readings_date ON readings(obs_date);

-- One row per city-day: average across stations, then join weather
CREATE VIEW city_daily AS
SELECT s.city_id, r.obs_date,
       AVG(r.aqi) AS aqi, AVG(r.pm25) AS pm25, AVG(r.pm10) AS pm10,
       w.temp_c, w.humidity_pct, w.wind_kmh, w.rain_mm
FROM readings r
JOIN stations s USING (station_id)
LEFT JOIN weather_daily w ON w.city_id = s.city_id AND w.obs_date = r.obs_date
GROUP BY s.city_id, r.obs_date, w.temp_c, w.humidity_pct, w.wind_kmh, w.rain_mm;`, 'Normalised design: city attributes are stored once (no repetition), station metadata can change independently, and the composite key on (station, date) guarantees one reading per day and gives an index for range scans. Weather is keyed by city because it is observed per city, not per sensor.'],
    'Grouped stats': [`-- Mean, median, mode, spread, skew by city and season
WITH d AS (
  SELECT c.name AS city,
         CASE WHEN EXTRACT(MONTH FROM obs_date) IN (12,1,2) THEN 'Winter'
              WHEN EXTRACT(MONTH FROM obs_date) IN (3,4,5)  THEN 'Summer'
              WHEN EXTRACT(MONTH FROM obs_date) BETWEEN 6 AND 9 THEN 'Monsoon'
              ELSE 'Post-monsoon' END AS season,
         aqi
  FROM city_daily cd JOIN cities c USING (city_id)
  WHERE aqi IS NOT NULL                       -- exclude missing, never treat as 0
)
SELECT city, season,
  COUNT(*)                                            AS n,
  ROUND(AVG(aqi)::numeric,1)                          AS mean,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY aqi)   AS median,
  MODE() WITHIN GROUP (ORDER BY ROUND(aqi/10)*10)     AS mode_10bin,
  STDDEV_SAMP(aqi)                                    AS sd,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY aqi)
   - PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY aqi) AS iqr,
  -- population skewness  m3 / sd^3
  AVG(POWER(aqi - (SELECT AVG(aqi) FROM d x WHERE x.city=d.city AND x.season=d.season),3))
   / NULLIF(POWER(STDDEV_POP(aqi),3),0)               AS skew
FROM d GROUP BY city, season ORDER BY city, season;`, 'GROUP BY is a hash aggregation (O(n)); PERCENTILE_CONT needs a sort inside each group (O(n log n)). MODE on raw floats is meaningless for continuous data, so we bin first.'],
    Outliers: [`-- Tukey IQR outliers per city
WITH q AS (
  SELECT city_id,
         PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY aqi) AS q1,
         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY aqi) AS q3
  FROM city_daily WHERE aqi IS NOT NULL GROUP BY city_id
)
SELECT c.name, cd.obs_date, cd.aqi,
       q.q3 + 1.5*(q.q3-q.q1) AS upper_fence
FROM city_daily cd
JOIN q USING (city_id) JOIN cities c USING (city_id)
WHERE cd.aqi > q.q3 + 1.5*(q.q3-q.q1)
   OR cd.aqi < q.q1 - 1.5*(q.q3-q.q1)
ORDER BY cd.aqi DESC;`, 'Outliers are flagged in a view or query, never deleted from the base table. Raw data stays auditable.'],
    Correlation: [`-- Pearson: built in.  Spearman: Pearson of (tie-averaged) ranks.
WITH pairs AS (
  SELECT pm25 AS x, wind_kmh AS y FROM city_daily
  WHERE pm25 IS NOT NULL AND wind_kmh IS NOT NULL      -- pairwise-complete
), rk AS (
  SELECT x, y,
    RANK() OVER (ORDER BY x) + (COUNT(*) OVER (PARTITION BY x) - 1)/2.0 AS rx,
    RANK() OVER (ORDER BY y) + (COUNT(*) OVER (PARTITION BY y) - 1)/2.0 AS ry
  FROM pairs
)
SELECT COUNT(*)      AS n,
       CORR(x, y)    AS pearson_r,
       CORR(rx, ry)  AS spearman_rho,
       CORR(x, y) - CORR(rx, ry) AS gap          -- big gap ⇒ outliers / curvature
FROM rk;`, 'The tie correction (+(ties−1)/2) gives tied values their average rank. Without it, zero-rain days would get arbitrary distinct ranks and bias ρ.'],
    'Missing data': [`-- 1) Build a complete calendar and expose the gaps
WITH cal AS (
  SELECT c.city_id, d::date AS obs_date
  FROM cities c
  CROSS JOIN generate_series('2018-01-01'::date,'2020-12-31','1 day') d
)
SELECT cal.city_id, cal.obs_date, cd.aqi        -- aqi IS NULL ⇒ missing day
FROM cal LEFT JOIN city_daily cd USING (city_id, obs_date);

-- 2) "Gaps and islands": length of each outage
WITH x AS (
  SELECT city_id, obs_date,
         obs_date - (ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY obs_date))::int AS grp
  FROM city_daily WHERE aqi IS NOT NULL
)
SELECT city_id, MIN(obs_date) AS island_start, MAX(obs_date) AS island_end,
       COUNT(*) AS days_present,
       LEAD(MIN(obs_date)) OVER (PARTITION BY city_id ORDER BY MIN(obs_date))
         - MAX(obs_date) - 1 AS gap_days_after
FROM x GROUP BY city_id, grp ORDER BY city_id, island_start;`, 'A LEFT JOIN against a generated calendar makes absent rows visible. Without it, a missing day simply has no row and LAG() would pair Monday with Thursday.'],
    'Lag join': [`-- Does yesterday's wind predict today's AQI?  Join by DATE, not by row.
SELECT c.name,
       CORR(today.aqi, yday.wind_kmh)                  AS r_lag1,
       COUNT(*)                                        AS n_pairs
FROM city_daily today
JOIN city_daily yday
  ON  yday.city_id  = today.city_id
  AND yday.obs_date = today.obs_date - INTERVAL '1 day'
JOIN cities c ON c.city_id = today.city_id
WHERE today.aqi IS NOT NULL AND yday.wind_kmh IS NOT NULL
GROUP BY c.name;

-- LAG() is fine only on a gap-free calendar:
-- LAG(wind_kmh,1) OVER (PARTITION BY city_id ORDER BY obs_date)`, 'A self-join on date − 1 is robust to outages: if yesterday is missing, the pair is dropped rather than mis-aligned.'],
    ANOVA: [`-- One-way ANOVA in plain SQL: F = (SSB/(k-1)) / (SSW/(N-k))
WITH g AS (
  SELECT city_id, COUNT(aqi) n, AVG(aqi) m, VAR_SAMP(aqi) v
  FROM city_daily WHERE aqi IS NOT NULL GROUP BY city_id
), tot AS (SELECT SUM(n) N, SUM(n*m)/SUM(n) gm, COUNT(*) k FROM g)
SELECT (SUM(g.n*POWER(g.m-tot.gm,2)) / (tot.k-1))
     / (SUM((g.n-1)*g.v)            / (tot.N-tot.k)) AS F_stat,
       tot.k-1 AS df_between, tot.N-tot.k AS df_within
FROM g, tot GROUP BY tot.k, tot.N;
-- p-value: use the F distribution in R/Python (scipy.stats.f.sf), not SQL.`, 'SQL is good at sums of squares. The p-value comes from the F-distribution, which is computed in application code.']
};

const SQLKEYS = /\b(CREATE|TABLE|PRIMARY|KEY|REFERENCES|CHECK|INDEX|ON|VIEW|AS|SELECT|FROM|WHERE|AND|OR|NOT|NULL|IS|JOIN|LEFT|CROSS|USING|GROUP|BY|ORDER|WITH|CASE|WHEN|THEN|ELSE|END|IN|BETWEEN|OVER|PARTITION|DESC|WITHIN|INTERVAL|VARCHAR|SERIAL|INT|REAL|DATE|NUMERIC|UNIQUE|COUNT|AVG|SUM|MIN|MAX|CORR|STDDEV_SAMP|STDDEV_POP|VAR_SAMP|PERCENTILE_CONT|MODE|ROUND|POWER|EXTRACT|NULLIF|RANK|ROW_NUMBER|LEAD|LAG|COALESCE|generate_series)\b/gi;
function hl(code) { return esc(code).replace(/(--.*$)|('(?:[^']|'')*')|(\b\d+\.?\d*\b)|(&lt;|&gt;)|([A-Za-z_]+)/gm, (m, c, s, n, _, w) => c ? `<span class="c">${c}</span>` : s ? `<span class="s">${s}</span>` : n ? `<span class="n">${n}</span>` : w && SQLKEYS.test(w) ? (SQLKEYS.lastIndex = 0, `<span class="k">${w}</span>`) : (SQLKEYS.lastIndex = 0, m)) }
let sqlTab = 'Schema';

function renderSQL() {
    $('#sqlTabs').innerHTML = Object.keys(SQL).map(k => `<button class="${k === sqlTab ? 'on' : ''}" data-k="${k}">${k}</button>`).join('');
    $$('#sqlTabs button').forEach(b => b.onclick = () => { sqlTab = b.dataset.k; renderSQL() });
    $('#sqlCode').innerHTML = hl(SQL[sqlTab][0]); $('#sqlNote').innerHTML = '<b>Design note:</b> ' + SQL[sqlTab][1];
}
$('#copyBtn').onclick = e => { navigator.clipboard && navigator.clipboard.writeText(SQL[sqlTab][0]); e.target.textContent = 'Copied ✓'; setTimeout(() => e.target.textContent = 'Copy', 1300) };

function renderER() {
    const box = (x, y, t, rows, w = 200) => { const h = 30 + rows.length * 20; return `<g><rect class="b" x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><rect class="h" x="${x}" y="${y}" width="${w}" height="26" rx="9"/><text class="t" x="${x + 12}" y="${y + 18}">${t}</text>` + rows.map((r, i) => `<text class="${/^(PK|FK)/.test(r) ? '' : 'm'}" x="${x + 12}" y="${y + 46 + i * 20}">${r}</text>`).join('') + '</g>' };
    $('#er').innerHTML = box(20, 30, 'cities', ['PK city_id', 'name', 'state', 'climate_zone']) + box(270, 30, 'stations', ['PK station_id', 'FK city_id', 'station_name', 'latitude', 'longitude']) +
        box(520, 30, 'readings', ['PK,FK station_id', 'PK obs_date', 'pm25 · pm10', 'no2 · so2', 'co · o3', 'aqi']) + box(145, 215, 'weather_daily', ['PK,FK city_id', 'PK obs_date', 'temp_c', 'humidity_pct', 'wind_kmh · rain_mm', 'pressure_hpa'], 230) +
        `<line x1="220" y1="84" x2="270" y2="84"/><line x1="470" y1="84" x2="520" y2="84"/><path d="M120 138 C120 190 200 170 220 215"/>
<text x="224" y="78" class="m">1</text><text x="252" y="78" class="m">N</text><text x="474" y="78" class="m">1</text><text x="502" y="78" class="m">N</text><text x="124" y="160" class="m">1</text><text x="206" y="208" class="m">N</text>`;
}

function renderDSA() {
    const it = [['#️⃣', 'Hash maps for GROUP BY', 'City → values buckets give O(n) aggregation, the same idea as a SQL hash aggregate.'], ['↕', 'Sorting for quantiles & ranks', 'Median, IQR fences, Spearman ranks and Kruskal–Wallis all need a sort: O(n log n). Ties get average ranks.'],
    ['📅', 'Date-indexed arrays', 'Each city is an array indexed by day. Lag-k lookup is O(1) and survives gaps, unlike shifting row positions.'], ['🔍', 'Run-length scan for gaps', 'One linear pass finds NaN runs, which feeds both the outage chart and the ≤3-day interpolation.'],
    ['🧮', 'Streaming statistics', 'Welford’s online algorithm updates mean and variance in one pass, which matters when millions of readings arrive.'], ['🎯', 'Incomplete beta / gamma', 'p-values for r, F and H come from series / continued-fraction approximations, so there are no stats libraries.']];
    $('#dsa').innerHTML = it.map(([i, t, d]) => `<div class="card reveal dsa"><div class="ic">${i}</div><div><h3>${t}</h3><div class="muted" style="font-size:13.5px">${d}</div></div></div>`).join(''); observeReveal();
}