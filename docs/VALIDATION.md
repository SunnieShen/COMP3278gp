# Submission validation

Validated: 2026-11-19.

The source was extracted from a candidate ZIP into a separate directory. A new virtual environment was created, dependencies were installed from `requirements-lock.txt`, and `python -m backend.manage init` was run against a new temporary database. The existing application database was not reset.

Environment: Linux/WSL, Python 3.10.12, MySQL 8.4.7. Windows and macOS setup commands are documented; this validation run used Linux/WSL.

## Results

- Fresh dependency installation: passed.
- Database initialization: 18 tables, 2 views and 162 initial records.
- Repeating init on a populated database: correctly refused without resetting its data.
- Integration suite: **29 tests passed** (112.683 seconds).

- App entry point, frontend assets and live-showcase assets served over HTTP.
- Both documented demo logins work in separate sessions.
- Catalog read returns real seeded menu fields/prices.
- Create group, add items, join and quantity update persist in MySQL snapshots.
- Deleting food and leaving physically remove the correct rows.
- Anonymous and nonmember access is rejected.
- Placement, stored timestamps and order history persist after fresh HTTP reads.
- Real Chromium login and live MySQL menu display.
- Exact catalog SELECT and result-column alignment.
- 0.5-second refresh and hidden recording toolbar.
- Recovery after an empty non-JSON response.
- No JavaScript page errors.

English-only documentation, local Markdown links, JavaScript syntax, runtime file completeness and archive integrity were also checked. All frontend images are supplied locally.

The validation used isolated databases. The archive contains the project seed data, not a dump of personal demonstration orders, local configuration or database credentials. The helper environments used for validation are not included.
