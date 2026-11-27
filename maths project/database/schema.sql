-- PostgreSQL schema: cities -> stations -> readings; cities -> weather_daily
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
GROUP BY s.city_id, r.obs_date, w.temp_c, w.humidity_pct, w.wind_kmh, w.rain_mm;