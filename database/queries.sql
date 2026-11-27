-- ============================================================
-- 1. GROUPED DESCRIPTIVE STATS (city x season)
-- ============================================================
WITH d AS (
  SELECT c.name AS city,
         CASE WHEN EXTRACT(MONTH FROM obs_date) IN (12,1,2) THEN 'Winter'
              WHEN EXTRACT(MONTH FROM obs_date) IN (3,4,5)  THEN 'Summer'
              WHEN EXTRACT(MONTH FROM obs_date) BETWEEN 6 AND 9 THEN 'Monsoon'
              ELSE 'Post-monsoon' END AS season,
         aqi
  FROM city_daily cd JOIN cities c USING (city_id)
  WHERE aqi IS NOT NULL
)
SELECT city, season,
  COUNT(*)                                            AS n,
  ROUND(AVG(aqi)::numeric,1)                          AS mean,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY aqi)   AS median,
  MODE() WITHIN GROUP (ORDER BY ROUND(aqi/10)*10)     AS mode_10bin,
  STDDEV_SAMP(aqi)                                    AS sd,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY aqi)
   - PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY aqi) AS iqr,
  AVG(POWER(aqi - (SELECT AVG(aqi) FROM d x WHERE x.city=d.city AND x.season=d.season),3))
   / NULLIF(POWER(STDDEV_POP(aqi),3),0)               AS skew
FROM d GROUP BY city, season ORDER BY city, season;


-- ============================================================
-- 2. TUKEY IQR OUTLIERS PER CITY
-- ============================================================
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
ORDER BY cd.aqi DESC;


-- ============================================================
-- 3. PEARSON & SPEARMAN CORRELATION
-- ============================================================
WITH pairs AS (
  SELECT pm25 AS x, wind_kmh AS y FROM city_daily
  WHERE pm25 IS NOT NULL AND wind_kmh IS NOT NULL
), rk AS (
  SELECT x, y,
    RANK() OVER (ORDER BY x) + (COUNT(*) OVER (PARTITION BY x) - 1)/2.0 AS rx,
    RANK() OVER (ORDER BY y) + (COUNT(*) OVER (PARTITION BY y) - 1)/2.0 AS ry
  FROM pairs
)
SELECT COUNT(*)      AS n,
       CORR(x, y)    AS pearson_r,
       CORR(rx, ry)  AS spearman_rho,
       CORR(x, y) - CORR(rx, ry) AS gap
FROM rk;


-- ============================================================
-- 4. MISSING DATA: COMPLETE CALENDAR & GAPS/ISLANDS
-- ============================================================
WITH cal AS (
  SELECT c.city_id, d::date AS obs_date
  FROM cities c
  CROSS JOIN generate_series('2018-01-01'::date,'2020-12-31','1 day') d
)
SELECT cal.city_id, cal.obs_date, cd.aqi
FROM cal LEFT JOIN city_daily cd USING (city_id, obs_date);

WITH x AS (
  SELECT city_id, obs_date,
         obs_date - (ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY obs_date))::int AS grp
  FROM city_daily WHERE aqi IS NOT NULL
)
SELECT city_id, MIN(obs_date) AS island_start, MAX(obs_date) AS island_end,
       COUNT(*) AS days_present,
       LEAD(MIN(obs_date)) OVER (PARTITION BY city_id ORDER BY MIN(obs_date))
         - MAX(obs_date) - 1 AS gap_days_after
FROM x GROUP BY city_id, grp ORDER BY city_id, island_start;


-- ============================================================
-- 5. LAGGED CORRELATION (DATE SELF-JOIN)
-- ============================================================
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


-- ============================================================
-- 6. ONE-WAY ANOVA F-STATISTIC
-- ============================================================
WITH g AS (
  SELECT city_id, COUNT(aqi) n, AVG(aqi) m, VAR_SAMP(aqi) v
  FROM city_daily WHERE aqi IS NOT NULL GROUP BY city_id
), tot AS (SELECT SUM(n) N, SUM(n*m)/SUM(n) gm, COUNT(*) k FROM g)
SELECT (SUM(g.n*POWER(g.m-tot.gm,2)) / (tot.k-1))
     / (SUM((g.n-1)*g.v)            / (tot.N-tot.k)) AS F_stat,
       tot.k-1 AS df_between, tot.N-tot.k AS df_within
FROM g, tot GROUP BY tot.k, tot.N;