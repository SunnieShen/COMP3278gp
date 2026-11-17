# COMP3278gp

**Group Eats (foodpanda)** — COMP3278 final project.

Buyers place individual orders or create and join group orders. Each member adds their own items. The application is a local Flask website connected to MySQL. 

The schema contains **18 tables and 2 views**. The running application supports login, catalogue browsing, individual and group orders, item CRUD, favourites, coupons, place/cancel, order history, and simulated completion.

## Requirements

- Python 3.10 or later
- MySQL 8.0.16 or later (CHECK constraints must be enforced)
- A MySQL account that can create a database and tables

Flask serves the web pages and the API together. Node.js is not required.

## 1. Install the application

**Linux / macOS / WSL:**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

**Windows PowerShell:**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Copy `.env.example` only on first setup. Do not overwrite an existing `.env`.

## 2. Configure the database connection

Edit `.env`:

| Variable | Purpose | Example |
|---|---|---|
| `SECRET_KEY` | Flask session secret | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `MYSQL_HOST` | MySQL host | `127.0.0.1` |
| `MYSQL_PORT` | MySQL port | `3306` |
| `MYSQL_USER` | MySQL user | `root` |
| `MYSQL_PASSWORD` | MySQL password | the password set when MySQL was installed |
| `MYSQL_DATABASE` | Empty target database name | `group_eats` |
| `PORT` | Website port | `5000` |

`DELIVERY_FEE_CENTS` defaults to `1000` (HK$10.00). `DEMO_COURIER_USER_ID` defaults to seeded courier `90201`.

## 3. Create the schema and load sample data

Start MySQL, then from the repository root:

```bash
python -m backend.manage init
```

`init` uses `MYSQL_DATABASE` and:

1. Creates the database if it does not exist.
2. Runs `db/schema.sql` (18 tables and 2 views).
3. Imports `db/seed.sql` (162 related records).
4. Sets usable password hashes for the two demo buyers.

It refuses a database that already contains tables. It does not delete an existing application database. To reproduce from scratch, choose a new empty `MYSQL_DATABASE` name.

Alternative shell import (same schema and seed; then set demo passwords):

```bash
bash db/setup.sh
bash db/seed.sh
python -m backend.manage demo-accounts
```

`setup.sh` and `seed.sh` prompt for the MySQL password. Importing `seed.sql` alone leaves placeholder hashes until `demo-accounts` is run.

## 4. Run the application

```bash
python app.py
```

Open **http://127.0.0.1:5000**.

If that address is not this application (on some macOS machines port 5000 is used by AirPlay), set `PORT=5001` in `.env`, restart `python app.py`, and open **http://127.0.0.1:5001**.

Leave the terminal running while using the site. Stop the server with Ctrl+C.

### Demo accounts

Local course demonstration only. There is no registration.

| Buyer | Email | Password |
|---|---|---|
| Alice | alice@example.com | DemoPass3278! |
| Bob | bob@example.com | DemoPass3278! |

Use Alice in a normal window and Bob in a private window to operate the same group. Two ordinary tabs share one login.

Alice’s unused coupon is `ALICE10` (minimum HK$30). Bob’s is `BOB5`. Apply the code on a pending order. A group coupon is applied by the host and reduces the host’s share only. After a group deadline, the host may still remove a coupon from a pending group and then place the order. Adding or replacing a coupon, and editing items, still require an open group.

The UI reads the 4 seeded sellers and 9 items. Images are local files, not database columns.

### Live three-panel showcase

After the app is running, open **http://127.0.0.1:5000/showcase/live** (use the same port as `python app.py`).

The page embeds the website, shows the matching SQL, and polls live MySQL rows every two seconds. Sign in as Alice in the embedded site and create a group. Open the invite as Bob in a private window. Step buttons change guidance only; they do not write to the database. **Copy SQL** and **Workbench SQL** export the SELECT statements for Workbench.

Snapshots require a buyer login. Group tables require membership. The showcase does not run arbitrary SQL and does not expose password hashes.

## 5. Inspect the data in Workbench

Result grids do not refresh by themselves. Run the SELECT again after each page action.

Connect to `127.0.0.1:3306` with the same user, password, and database as `.env`.

```sql
SELECT DATABASE();
SHOW TABLES;
SELECT order_id, host_user_id, order_status, coupon_id
FROM orders
WHERE host_user_id = 90001
ORDER BY order_id DESC
LIMIT 10;
SELECT buyer_user_id, seller_user_id, saved_time
FROM favorite_sellers
WHERE buyer_user_id = 90001;
```

Alice is `user_id` `90001`. Command-line equivalent:

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p group_eats
```

## 6. Tests

```bash
python -m unittest discover -s tests -v
```

The suite creates a temporary `group_eats_test_*` database, imports the real schema and seed, then drops that test database. It does not clear `MYSQL_DATABASE`. The MySQL account needs `CREATE` and `DROP DATABASE` privileges.

## How to use the site

1. Log in as Alice.
2. Open a store.
3. **Order for myself** or **Start a group order**.
4. Add, change, or remove items. Place the order, or cancel it before placement.
5. Copy the group invite link. Log in as Bob in a private window, join, and add Bob’s items.
6. Use hearts for favourites. Apply a coupon on a pending order.

Cancellation keeps the order row and sets `coupon_id` to NULL. Confirmed orders are read-only. Joining and item edits stop at the group deadline (Hong Kong time). The host may place a non-empty pending group before or after the deadline. Placement is not online payment.

## Database design

The schema follows [ER03](ER/ER03.png) ([draw.io source](ER/ER03.drawio)) and `db/schema.sql`.

![ER diagram](ER/ER03.png)

PK = primary key. FK = foreign key. UK = unique key.

| Table | Keys / main fields | Purpose |
|---|---|---|
| `users` | `user_id` PK, `email` UK, `password_hash` | Account |
| `buyers` | `user_id` PK/FK → users | Buyer role |
| `sellers` | `user_id` PK/FK → users | Seller role |
| `couriers` | `user_id` PK/FK → users | Courier role |
| `restaurants` | `user_id` PK/FK → sellers | Restaurant subtype |
| `grocery_stores` | `user_id` PK/FK → sellers | Grocery subtype |
| `addresses` | `address_id` PK, `buyer_user_id` FK | Saved addresses (not used at checkout) |
| `menu_items` | `item_id` PK, `seller_user_id` FK | Catalogue |
| `coupons` | `coupon_id` PK, `buyer_user_id` FK | Per-buyer voucher |
| `orders` | `order_id` PK, `host_user_id` FK, `seller_user_id` FK, `coupon_id` UK/FK | Order header |
| `solo_orders` | `order_id` PK/FK → orders | Individual order |
| `group_orders` | `order_id` PK/FK → orders, `deadline` | Group order |
| `group_order_participants` | (`order_id`, `buyer_user_id`) PK | Group membership |
| `order_items` | (`order_id`, `user_id`, `item_id`) PK, `quantity`, `unit_price_snapshot` | Line items |
| `favorite_sellers` | (`buyer_user_id`, `seller_user_id`) PK | Saved stores |
| `favorite_items` | (`buyer_user_id`, `item_id`) PK | Saved dishes |
| `seller_ratings` | (`buyer_user_id`, `seller_user_id`) PK, `score` | One score per pair |
| `deliveries` | `delivery_id` PK, `order_id` UK/FK | At most one delivery per order |

Views: `seller_rating_view` (average score), `group_order_status_view` (`open` / `locked` from the deadline).

Each user has exactly one role (buyer, seller, or courier). Each seller is a restaurant or a grocery store. Each order is individual or group. Role exclusivity is enforced by the application. Totals use `SUM(quantity * unit_price_snapshot)`. Delivery fees are split in integer cents; remainder goes to the host. Pickup has no delivery row.

### Implemented operations

| Feature | SQL effect | Tables |
|---|---|---|
| Login and catalogue | Read | `users`, `buyers`, `sellers`, `menu_items` |
| Create individual / group order | Create | `orders`, `solo_orders` / `group_orders`, `deliveries` |
| Join / leave a group | Create / Delete | `group_order_participants`, `order_items` |
| Add / change / remove items | Create / Update / Delete | `order_items` |
| Place / cancel | Update | `orders` (`coupon_id` cleared on cancel) |
| Favourites | Create / Read / Delete | `favorite_sellers`, `favorite_items` |
| Apply / remove a coupon | Update | `orders`, `coupons` |

Not implemented: registration, checkout address selection, online payment, merchant screens, courier screens.

### Sample queries after `init`

```sql
SELECT p.order_id, u.user_id, u.username,
       COALESCE(SUM(i.quantity * i.unit_price_snapshot), 0) AS item_subtotal
FROM group_order_participants p
JOIN users u ON u.user_id = p.buyer_user_id
LEFT JOIN order_items i
  ON i.order_id = p.order_id AND i.user_id = p.buyer_user_id
WHERE p.order_id = 94002
GROUP BY p.order_id, u.user_id, u.username;

SELECT order_id, deadline, group_status
FROM group_order_status_view;
```

The first query returns `90001 = 68.00` and `90002 = 112.00`. The second returns six `open` and three `locked` group orders.

## Task allocation

| Task | Description | Assigned to |
|---|---|---|
| ER Diagram | Identify entities, attributes, and relationships. | Cheng Hengqi |
| Relational Schema | Define tables, keys, and constraints. | Shen Hongshan |
| Database Implementation | Set up MySQL, tables, and sample data. | Gong Jianxiang |
| Frontend, Code Review & README | Build the frontend, review code, and document setup. | Zhen Qi |
| Backend & Integration | Implement SQL and connect the frontend to MySQL. | Yang Ruizhen |

## Repository structure

```text
ER/                 ER03 diagram and draw.io source
db/schema.sql       18 tables and 2 views
db/seed.sql         162 seed records
db/setup.sh         Optional schema import
db/seed.sh          Optional seed import
backend/            Flask API and SQL
app.py              Application entry point
requirements.txt    Python dependencies
.env.example        Connection template (copy to .env; do not commit .env)
tests/              MySQL integration tests
frontend/           Web UI and local images
showcase/           Live three-panel SQL showcase
docs/               API contract
```

## Existing databases

If the database already has the current tables, do not run `init`.

```bash
python -m backend.manage seed
```

refreshes seed rows and demo passwords. `python -m backend.manage demo-accounts` updates only Alice and Bob. Do not reseed during a demonstration.

If the database was created from an earlier schema, run once:

```bash
python -m backend.manage migrate
```

This renames the creation timestamp to `created_at`, adds completion columns, and inserts missing demo coupons `ALICE10` and `BOB5`. Existing coupons, orders, and passwords are kept. Repeating `migrate` does not create duplicate vouchers.

If the old column `orders.buyer_user_id` is still present:

```bash
mysql -u root -p group_eats < db/migrations/001_rename_order_buyer_to_host.sql
```
