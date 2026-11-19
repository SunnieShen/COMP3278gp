# foodpanda — COMP3278 Final Project

A food-ordering application built with HTML/CSS/JavaScript, Flask and MySQL. It supports individual orders and group orders with separate item ownership, delivery-fee sharing, favourites and coupons.

## Run the integrated application

### 1. Requirements

- Python 3.10 or later (validated with Python 3.10.12).
- An installed, running MySQL **8.0.16+** server (validated with MySQL 8.4.7). MySQL is not bundled; install/start it before initializing the database.
- A MySQL account allowed to create the selected database and tables. Use a **new, empty database name**. Initial dependency installation requires internet access; frontend images are included locally.

Run all commands from this folder, next to `app.py`. No Node.js, npm build, Docker or GitHub hosting is required.

### 2. Install dependencies

Linux / macOS / WSL:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lock.txt
cp .env.example .env
```

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-lock.txt
Copy-Item .env.example .env
```

If PowerShell blocks activation, use `.\.venv\Scripts\python.exe` instead of `python` in the remaining commands; activation is not otherwise required. `requirements-lock.txt` pins the validated dependencies; `requirements.txt` lists the direct dependency ranges.

### 3. Configure MySQL

Edit `.env` with **your own** MySQL connection settings. For a typical local server:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=comp3278_foodpanda
PORT=5000
```

An empty MySQL password is supported if that is how your local account is configured. The database name can contain letters, numbers and underscores. These are local settings, not a hosted database or a supplied account. Keep the remaining settings from `.env.example` unless changing a documented behaviour below.

Generate a private session key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste its output into `SECRET_KEY` in `.env`, replacing the template value. No private configuration or passwords are included in this archive.

### 4. Create the database with data and start the app

```bash
python -m backend.manage init
python app.py
```

Open **http://127.0.0.1:5000**. Press Ctrl+C in the terminal to stop the server. If changing `PORT`, open that port instead. MySQL Workbench is optional; Flask serves the frontend and backend together.

`init` creates the database, imports **18 tables, 2 views and 162 related sample records**, and prepares the demo buyers' password hashes. It refuses to initialize a database that already contains tables. Run it once for a new database, not at every startup. On later runs, use `python app.py` only.

| Buyer | Email | Password |
|---|---|---|
| Alice | alice@gmail.com | 123456 |
| Bob | bob@gmail.com | 123456 |

These are local demonstration accounts, not Gmail logins. Other fixture users are database examples and are not documented login accounts. Importing `db/seed.sql` manually leaves placeholder password hashes; afterwards run `python -m backend.manage demo-accounts` to prepare the two logins. The recommended `init` command does this automatically.

## Verify CRUD through the website

1. **Read:** log in as Alice, open Harbour Cafe and inspect its menu and existing orders.
2. **Create:** start a group with a deadline 15 minutes ahead and add chicken rice.
3. Copy the invite into a private window or separate browser profile. Log in as Bob, join and add milk tea. Two ordinary tabs share one session.
4. **Update:** change Bob's milk tea quantity from 1 to 2; its stored unit price stays at HK$22.
5. **Delete:** Bob leaves. His items and membership are deleted; Alice's food remains. Removing one food item also executes DELETE.
6. Alice places the remaining order. Refresh or open Orders to verify that Confirmed and the stored records persist.

Cancellation changes an order's status; it is not physical deletion. Only the host can place a group. Members can change only their own items, while the order is Pending and before its deadline. The host may place a nonempty group before or after the deadline. Submission makes it read-only.

The same website also supports individual-order item CRUD, favourites and coupon application/removal. Address management, account registration, real payment and merchant/courier screens are outside the implemented interface.

## Database configuration and inspection

- New delivery orders use `DELIVERY_FEE_CENTS` from `.env` (default `1000`, or HK$10) and the Available seeded courier `90201`. Zero is supported; pickup has no delivery record.
- Delivery fees are divided in integer cents, with any remainder assigned to the host. Prices are saved in `order_items.unit_price_snapshot`.
- A group coupon applies to its host's share. Demo codes: Alice `ALICE10` (HK$30 minimum), Bob `BOB5`.
- New submissions store `placed_at` and a completion time 15–60 minutes later. The local background worker changes due orders to Completed and deliveries to Delivered. This does not dispatch a real courier or collect payment.
- Times use Hong Kong time (`+08:00`). Old seeded statuses remain unchanged unless an applicable operation is performed.

Inspect with the MySQL command line, replacing the connection values with those in `.env`:

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p comp3278_foodpanda
```

```sql
SHOW TABLES;
SELECT order_id, host_user_id, order_status FROM orders ORDER BY order_id DESC;
SELECT order_id, user_id, item_id, quantity, unit_price_snapshot FROM order_items;
SELECT order_id, buyer_user_id FROM group_order_participants;
```

Run the SELECT statements again after a website action to see committed changes. Type `exit` to leave MySQL. Workbench can use the same host, port, user and database.

For the optional three-panel demonstration, open **http://127.0.0.1:5000/showcase/live**. It embeds the real website and queries live MySQL every 0.5 seconds. See [the demo workflow](showcase/DEMO_SCRIPT.md). The API requires login and group membership; it does not accept arbitrary SQL.

## Tests and reproducibility

```bash
python -m unittest discover -s tests -p "test_api.py"
```

The 29 integration tests create a randomly named temporary database, seed it, run checks and drop **that test database only**. The account running tests needs CREATE and DROP DATABASE privileges. Tests cover real CRUD, permissions/CSRF, ownership, transaction rollback, concurrency, fees, coupons, deadlines, completion and showcase access control. See [validation results](docs/VALIDATION.md).

To reproduce from scratch, choose another empty `MYSQL_DATABASE` and run `init`. Do not reseed a database whose current orders you want to preserve. Existing-installation helpers and migrations are supplied under `db/`; new installations need only `init`.

## Source and design files

| Path | Contents |
|---|---|
| `app.py`, `backend/` | Flask entry point, API, MySQL operations, initialization and completion worker |
| `frontend/` | Application HTML/CSS/JS and all image assets; [asset attribution](frontend/assets/SOURCES.md) |
| `db/schema.sql`, `db/seed.sql` | Relational schema, keys/constraints, views and initial data |
| `ER/ER03.png`, `ER/ER03.drawio` | Current ER diagram and editable source |
| `docs/DATABASE_DESIGN.md` | English database design specification |
| `docs/API.md` | API contract and field mapping |
| `tests/` | Integration test suite |
| `showcase/` | Live database demonstration interface and workflow |

Team: Cheng Hengqi (ER), Shen Hongshan (relational schema), Gong Jianxiang (database), Yang Ruizhen (backend), Zhen Qi (frontend, review and README).

This archive contains the source, database scripts and run instructions required for Moodle submission. Presentation slides and the demonstration video are separate presentation materials. Local environments, credentials, database dumps, Git history, recording assets and draft documents are excluded.
