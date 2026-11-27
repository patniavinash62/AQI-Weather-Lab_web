import csv
import io
import os
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

# Optional PostgreSQL driver (install psycopg2-binary if connecting to PostgreSQL)
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25 MB CSV limit


# ---------------------------------------------------------------------------
# Database helper (PostgreSQL)
# ---------------------------------------------------------------------------
def get_db_connection():
    """Connect to PostgreSQL using DATABASE_URL env var."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url or psycopg2 is None:
        return None
    return psycopg2.connect(db_url, cursor_factory=RealDictCursor)


def run_query(sql, params=None):
    """Execute a read-only SQL query and return list of dicts."""
    conn = get_db_connection()
    if conn is None:
        return None, (
            "PostgreSQL is not configured. Set DATABASE_URL and install "
            "psycopg2-binary to enable database endpoints."
        )
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                return cur.fetchall(), None
    except Exception as exc:
        return None, str(exc)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Frontend routes (serves your exact dashboard files)
# ---------------------------------------------------------------------------
@app.route("/")
def serve_index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/css/<path:filename>")
def serve_css(filename):
    return send_from_directory(BASE_DIR / "css", filename)


@app.route("/js/<path:filename>")
def serve_js(filename):
    return send_from_directory(BASE_DIR / "js", filename)


@app.route("/database/<path:filename>")
def serve_sql_files(filename):
    return send_from_directory(BASE_DIR / "database", filename)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
@app.route("/api/health")
def api_health():
    conn = get_db_connection()
    db_connected = conn is not None
    if conn:
        conn.close()
    return jsonify({
        "status": "ok",
        "database_connected": db_connected,
        "schema_file": str((BASE_DIR / "database" / "schema.sql").exists()),
    })


@app.route("/api/upload-csv", methods=["POST"])
def api_upload_csv():
    """Save and validate an uploaded CPCB / Kaggle city_day.csv file."""
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Please upload a valid .csv file"}), 400

    raw_bytes = file.read()
    text = raw_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = [h.strip() for h in (reader.fieldnames or [])]
    norm = {h.lower().replace(" ", "").replace("_", ""): h for h in headers}

    if not ("city" in norm or "cityname" in norm) or not (
        "date" in norm or "datetime" in norm or "obsdate" in norm
    ):
        return jsonify({
            "error": 'CSV must contain "City" and "Date" columns.'
        }), 400

    city_col = norm.get("city") or norm.get("cityname")
    cities = set()
    row_count = 0
    for row in reader:
        row_count += 1
        if row.get(city_col):
            cities.add(row[city_col].strip())

    save_path = UPLOAD_DIR / Path(file.filename).name
    save_path.write_bytes(raw_bytes)

    return jsonify({
        "status": "uploaded",
        "filename": save_path.name,
        "rows": row_count,
        "cities_count": len(cities),
        "cities": sorted(cities)[:20],
        "columns": headers,
    })


@app.route("/api/db/summary")
def api_db_summary():
    """Grouped descriptive stats by city and season from PostgreSQL."""
    sql = """
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
      ROUND(AVG(aqi)::numeric, 1)                         AS mean,
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY aqi)   AS median,
      STDDEV_SAMP(aqi)                                    AS sd,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY aqi)
       - PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY aqi) AS iqr
    FROM d
    GROUP BY city, season
    ORDER BY city, season;
    """
    rows, err = run_query(sql)
    if err:
        return jsonify({"error": err}), 503
    return jsonify(rows)


@app.route("/api/db/outliers")
def api_db_outliers():
    """Tukey 1.5xIQR outliers per city from PostgreSQL."""
    sql = """
    WITH q AS (
      SELECT city_id,
             PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY aqi) AS q1,
             PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY aqi) AS q3
      FROM city_daily WHERE aqi IS NOT NULL GROUP BY city_id
    )
    SELECT c.name AS city, cd.obs_date, cd.aqi,
           q.q3 + 1.5 * (q.q3 - q.q1) AS upper_fence
    FROM city_daily cd
    JOIN q USING (city_id)
    JOIN cities c USING (city_id)
    WHERE cd.aqi > q.q3 + 1.5 * (q.q3 - q.q1)
       OR cd.aqi < q.q1 - 1.5 * (q.q3 - q.q1)
    ORDER BY cd.aqi DESC
    LIMIT 100;
    """
    rows, err = run_query(sql)
    if err:
        return jsonify({"error": err}), 503
    return jsonify(rows)


@app.route("/api/db/correlation")
def api_db_correlation():
    """Pearson & Spearman correlation (PM2.5 vs Wind) from PostgreSQL."""
    sql = """
    WITH pairs AS (
      SELECT pm25 AS x, wind_kmh AS y FROM city_daily
      WHERE pm25 IS NOT NULL AND wind_kmh IS NOT NULL
    ), rk AS (
      SELECT x, y,
        RANK() OVER (ORDER BY x) + (COUNT(*) OVER (PARTITION BY x) - 1) / 2.0 AS rx,
        RANK() OVER (ORDER BY y) + (COUNT(*) OVER (PARTITION BY y) - 1) / 2.0 AS ry
      FROM pairs
    )
    SELECT COUNT(*)                  AS n,
           CORR(x, y)                AS pearson_r,
           CORR(rx, ry)              AS spearman_rho,
           CORR(x, y) - CORR(rx, ry) AS gap
    FROM rk;
    """
    rows, err = run_query(sql)
    if err:
        return jsonify({"error": err}), 503
    return jsonify(rows[0] if rows else {})


@app.route("/api/db/lag")
def api_db_lag():
    """1-day lagged correlation (yesterday's wind vs today's AQI)."""
    sql = """
    SELECT c.name AS city,
           CORR(today.aqi, yday.wind_kmh) AS r_lag1,
           COUNT(*)                       AS n_pairs
    FROM city_daily today
    JOIN city_daily yday
      ON  yday.city_id  = today.city_id
      AND yday.obs_date = today.obs_date - INTERVAL '1 day'
    JOIN cities c ON c.city_id = today.city_id
    WHERE today.aqi IS NOT NULL AND yday.wind_kmh IS NOT NULL
    GROUP BY c.name
    ORDER BY c.name;
    """
    rows, err = run_query(sql)
    if err:
        return jsonify({"error": err}), 503
    return jsonify(rows)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=True)