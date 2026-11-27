Air Quality & Weather Correlation Dashboard

A zero-dependency, offline-capable browser dashboard for analyzing how Air Quality Index (AQI) correlates with weather variables (temperature, humidity, wind speed, rainfall, and pressure) across Indian cities and seasons.

Overview & Data Quality: Interactive AQI KPIs, missing-value detection, and controlled gap-filling (up to 3 consecutive days). Statistical Analysis: Descriptive stats, outlier detection (IQR, Z-score, MAD), Pearson/Spearman correlation matrices, seasonality removal, and 0–7 day lagged correlations. 
Hypothesis Testing & Labs: One-way ANOVA, Kruskal-Wallis tests (with effect sizes), and an interactive Pearson vs. Spearman comparison lab.Educational & Reporting Tools: Automated textual findings, plus reference ER diagrams and SQL scripts (non-executed).

Tech Stack & Usage

Tech Stack & Usage Stack: Vanilla HTML (index.html), client-side JavaScript, hand-built SVG charts, and CSV upload support. No external libraries or backend servers.

Run: Simply open index.html in any modern web browser.

Limitations & Future Scope Note: Built-in data is simulated (winter peaks, monsoon dips) for demonstration only; upload real CPCB + Open-Meteo/NASA POWER CSVs for empirical research.

Roadmap: Real dataset & PostgreSQL integration, SciPy/R validation, ML/time-series forecasting (ARIMA, Random Forest), and live API feeds.

Team (Dept. of Computer Science & Engineering) Patni Avinash Amarbhai Prajapati Het Rameshbhai Porwal Dhruvansh Chetankumar Prajapati Devang Jagdishbhai Prajapati Jayesh Prakashbhai


live link= https://patniavinash62.github.io/AQI-Weather-Lab_web/
