# COMP3278gp

**English** | [简体中文](README.zh-CN.md)

**foodpanda** — COMP3278 final project.

Buyers can place solo orders or create and join group orders, with each member adding their own items. The database design also covers sellers, couriers, addresses, favourites, ratings, coupons and deliveries.

## Run the integrated application

Requirements: Python 3.10+ and a running MySQL 8.0.16+ server (verified with MySQL 8.4.7). The app serves its frontend and API together; no npm or separate static server is needed.

**Linux / macOS / WSL (first setup):**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

**Windows PowerShell (first setup):**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Only copy the template on first setup; keep an existing `.env`. Both platforms use the same configuration and tests.

**Configuration on all platforms:** Edit `.env`: set your MySQL host, port, account/password and a **new empty** database name. Generate a private `SECRET_KEY` with `python -c "import secrets; print(secrets.token_hex(32))"`. The MySQL account needs permission to create the selected database/tables (or use an already-created empty database).

```bash
python -m backend.manage init
python app.py
```

Open http://127.0.0.1:5000. `init` creates the schema, imports the existing 160 seed records, and assigns usable password hashes to the two demo buyers. It refuses a database containing tables; it never resets an existing application database. Login credentials, for local course demos only:

| Buyer | Email | Password |
|---|---|---|
| Alice | alice@example.com | DemoPass3278! |
| Bob | bob@example.com | DemoPass3278! |

For an existing ER03 database, first run `python -m backend.manage migrate` to rename the creation timestamp to `created_at` and add completion timestamps/index without resetting data. For a database already using the current schema, run `python -m backend.manage seed` to upsert fixtures and prepare these accounts, or `python -m backend.manage demo-accounts` to change only the two demo password hashes. Reseeding restores fixture values, so do not do it during a demo. If the database uses the old orders.buyer_user_id column, first apply the documented migration below. The original shell import scripts remain available; importing raw seed.sql restores placeholder passwords until demo-accounts is run.

Create a group from a seller's menu. Open its copied invite link in another browser profile/private window, log in as the other buyer, join, and add/change/remove your own items. Two ordinary tabs share a session. Group details refresh every 15 seconds and have a manual Refresh button.

Delivery groups use the server's `DELIVERY_FEE_CENTS` (default 1000); configure `DEMO_COURIER_USER_ID` to an Available seeded courier (90201 by default). A delivery record is created atomically with the group. This is demo assignment, not real dispatch. Zero is a valid fee; pickup has no delivery record. Existing orders use their saved delivery fees. Remainder cents go to the host. All summaries are **before coupons**, not final payment demands.

The real UI reads the 4 seeded sellers and their 9 items. Images are local presentation assets, not database columns. Online payment, favourites, addresses, coupons, merchant/courier screens are not implemented in this phase. There is no early-lock action: Pending groups become read-only at the deadline, using Hong Kong time. Cancellation preserves records.

[Frontend details](frontend/README.md) · [API contract](docs/API.md) · [中文接口约定](docs/API.zh-CN.md)

## Task Allocation

| Task | Description | Assigned To |
|---|---|---|
| ER Diagram | Identify entities, attributes, and relationships. | Cheng Hengqi |
| Relational Schema | Define tables, keys, and constraints. | Shen Hongshan |
| Database Implementation | Set up MySQL, tables, and sample data. | Gong Jianxiang |
| Frontend, Code Review & README | Build the frontend, review code, and document setup. | Zhen Qi |
| Backend & Integration | Implement SQL and connect the frontend to MySQL. | Yang Ruizhen |

## Current Design & Progress

The ER03 source and exported image include `placed_at`, `completion_due_at` and `completed_at` on orders, distinguishing deadline-derived group status from order lifecycle. See the [latest design notes](ER_Diagram_Details04.md).

This README follows the [ER03 diagram](ER/ER03.png), its [editable source](ER/ER03.drawio) and the [relational schema and creation script](db/schema.sql), replacing the previous six-table design.

![Current ER diagram](ER/ER03.png)

- The ER diagram, business descriptions, `db/schema.sql` and reproducible import script `db/setup.sh` are available.
- The database design contains **18 tables and 2 views**. Phase-one integration uses a subset; a table being present does not mean its entire feature is implemented.
- The frontend uses Flask/MySQL for login, catalog browsing, individual/group ordering, membership, item CRUD, submission/cancellation, history and simulated completion.
- `ER_Diagram_Details*.md` contains several design revisions. Resolve discrepancies against ER03 and the schema script.

## Database Design

### Tables

PK = primary key; FK = foreign key; UK = unique key.

| Table | Main fields / keys | Purpose |
|---|---|---|
| `users` | `user_id` PK, `username`, `email` UK, `phone_number`, `password_hash` | Base account information |
| `buyers` | `user_id` PK/FK → users | Buyer subtype |
| `sellers` | `user_id` PK/FK → users | Seller subtype |
| `couriers` | `user_id` PK/FK → users, `vehicle_type`, `license_plate_number`, `availability_status` | Courier subtype |
| `restaurants` | `user_id` PK/FK → sellers, `cuisine_type`, `active_status` | Restaurant subtype |
| `grocery_stores` | `user_id` PK/FK → sellers, `store_category` | Grocery-store subtype |
| `addresses` | `address_id` PK, `buyer_user_id` FK, `address_line`, `label` | Saved buyer addresses |
| `menu_items` | `item_id` PK, `seller_user_id` FK, `item_name`, `price`, `availability_status` | Items offered by a seller |
| `coupons` | `coupon_id` PK, `buyer_user_id` FK, `coupon_code`, `discount_value`, `minimum_spend_threshold`, `expiry_date` | Buyer-owned coupons |
| `orders` | `order_id` PK, `host_user_id` FK → buyers, `seller_user_id` FK → sellers, `coupon_id` UK/FK, `created_at`, `order_status`, `fulfillment_type`, `placed_at`, `completion_due_at`, `completed_at` | Shared order information; host is the placing buyer |
| `solo_orders` | `order_id` PK/FK → orders | Solo-order subtype |
| `group_orders` | `order_id` PK/FK → orders, `deadline` | Group-order subtype |
| `group_order_participants` | (`order_id`, `buyer_user_id`) composite PK/FKs | Many-to-many group membership |
| `order_items` | (`order_id`, `user_id`, `item_id`) composite PK/FKs, `quantity`, `unit_price_snapshot` | Items added by each buyer, with price snapshots |
| `favorite_sellers` | (`buyer_user_id`, `seller_user_id`) composite PK/FKs, `saved_time` | Unique buyer/seller favourites |
| `favorite_items` | (`buyer_user_id`, `item_id`) composite PK/FKs, `saved_time` | Unique buyer/item favourites |
| `seller_ratings` | (`buyer_user_id`, `seller_user_id`) composite PK/FKs, `score` | One rating per buyer/seller pair |
| `deliveries` | `delivery_id` PK, `order_id` UK/FK, `courier_user_id` FK, `delivery_status`, `delivery_timestamp`, `shipping_fee` | Delivery records and shipping fees |

### ER Rules & Implementation Notes

- **Total, disjoint ISA:** Each user is exactly one of buyer, seller or courier; each seller is exactly one of restaurant or grocery store; each order is exactly one of solo or group. Separate subtype tables are used. Foreign keys alone do not enforce completeness or exclusivity; application logic or triggers are still needed.
- **Order ownership:** `orders.host_user_id` identifies the one placing buyer (the host) and `seller_user_id` identifies the seller. Group orders connect multiple buyers through the participation table, which must also include the host. `group_order_participants.buyer_user_id` identifies all participants; it is not a second order owner column.
- **Order items:** The order, buyer and item IDs form a composite identity. `unit_price_snapshot` preserves historical prices. The backend validates membership and ensures each item belongs to the order's seller.
- **Group status:** `group_order_status_view` derives `open` / `locked` from the deadline. Completion and cancellation use `orders.order_status`. The backend prevents membership and item changes after the deadline. There is no separate manual-lock action; an early submission uses Confirmed to stop edits before the deadline.
- **Coupons:** Each coupon belongs to one buyer. An order accepts at most one coupon, and the unique constraint on `orders.coupon_id` limits a coupon to one order. Ownership, expiry and minimum spend require backend validation.
- **Deliveries:** Each delivery references one order and one courier; an order has at most one delivery. Delivery orders require a delivery record, while self-pickup orders have none. The creation endpoint enforces this condition for new groups.
- **Ratings:** `seller_rating_view` calculates the average score rather than storing it on the seller. Scores range from 1 to 5.
- **Deletion:** Current foreign keys do not cascade deletes. Define transactional deletion of dependent records, or agree on changes to the foreign-key rules.
- **Deferred features:** Addresses are not directly linked to orders; address selection and coupon allocation are excluded from phase one. Summaries for seeded coupon orders are labelled before coupons.

### Design decisions and fixture evidence

The revisions came from three annotated review rounds kept outside this repository (`ER01问题.pdf`, `ER01问题 回应.pdf`, `Foodpanda_ER_02 问题.pdf`, `关于Foodpanda_ER_03的想法.pdf`). `db/seed.sql` is deliberately small: for each decision there is at least one row that the earlier design could not represent without loss, duplication or redundancy. Case coverage, not row count, is the criterion.

| Design decision | Raised in review | Fixture evidence | Schema object |
|---|---|---|---|
| One account = exactly one role (total, disjoint ISA) | ER01 red note "必须为 buyer/seller/courier 中的一种"; ER03 想法 §1 | 15 users split into 90001–90008 buyers, 90101–90104 sellers, 90201–90203 couriers, no overlap | `users` + three role tables |
| Surrogate `address_id`; a buyer may have 0..N addresses | ER02 问题 (same `address_line` for different buyers); ER03 想法 §2 | 90001 → 91001 + 91008; 90008 → none | `addresses` PK / FK |
| No duplicate favourites; M:N works in both directions | ER01 "一个买家不能多次收藏同一个商家"; ER03 想法 §3 | 90001 favourites 90101 and 90102; 92001 is favourited by 90001 and 90002 | composite PKs on both favourites tables |
| `rating` is derived, backed by a RATE M:N relationship | ER01 回应 ① blue `buyer — rate — seller` sketch, two old `rating` ellipses crossed out | 7 scores → 4.1667 / 4.25 / 3.75; 90104 → NULL via LEFT JOIN | `seller_ratings`, `seller_rating_view` |
| ORDER_ITEM is an ID-dependent weak entity with a three-part key | ER01 回应 green double outlines on ADDS / CONTAINS / SELECTS | 94002 and 94005: item 92001 added by two different buyers | `order_items` PK |
| `group_status` derived from deadline; `completed` belongs to `order_status` | ER01 回应 "group_status 作为 derived attribute from deadline" | 2099 / 2000 deadlines; 94009 is `locked` but still `Pending` | `group_order_status_view` |
| `shipping_fee` on DELIVERY; HAS_DELIVERY is 1:1 and partial | ER01 回应 green "shipping_fee?" circle near DELIVERY | 10 Delivery orders have exactly one delivery; 3 Self-Pickup orders have none; one delivery has a `$0.00` fee | `deliveries.order_id UNIQUE` |
| Coupon is a per-buyer, single-use voucher (1:1 APPLIES) | ER01 回应 "really?" on coupon reuse; ER03 想法 §5 Option B | 4 coupons used once each, 93004 expired and unused, 5 orders with NULL coupon | `orders.coupon_id UNIQUE`, `coupons.buyer_user_id` |
| ORDERS supertype over solo / group orders | ER02 问题 "shared features" + hand-drawn ISA sketch; ER03 想法 §4 | 13 orders = 4 solo + 9 group sharing host, seller and status | `orders` + two subtype tables |
| Group cost allocation handles participant-count boundaries | ER03 special-case sample data recommendation §2 | 94101 / 94102 / 94103 have 1 / 3 / 4 participants and delivery fees of `$10.00` / `$10.00` / `$10.02` | `group_order_participants`, `deliveries.shipping_fee` |
| Price snapshot must survive catalogue changes | ER02 问题 `unit price snapshot` | 94001 / 92003 stores 16.50 while the current price is 18.50 | `order_items.unit_price_snapshot` |
| The 0 side of participation is real | ER01 "一个骑手可接 0 或 ≥1 单"; "新卖家尚未列出菜单项" | 90203 has no deliveries; 90104 has no items and no ratings | role tables, `LEFT JOIN` in the views |

## Implemented Features & CRUD Mapping

| Feature | CRUD | Main tables |
|---|---|---|
| Buyer login and store/menu browsing | Read | users, buyers, sellers, menu_items |
| Create individual / group drafts | Create | orders, solo_orders / group_orders, deliveries |
| Join / leave a group | Create / Delete | group_order_participants, order_items |
| Add food / change quantity / remove food | Create / Read / Update / Delete | order_items |
| Member subtotals, delivery shares and order history | Read | orders, order_items, group_order_participants, deliveries |
| Place / cancel a draft; simulated completion | Update | orders, deliveries |

Cancellation retains history; removing items and leaving groups perform actual DELETE operations. Item totals use `SUM(quantity * unit_price_snapshot)`. Shipping is split in integer cents with remainder assigned to the host; pickup has no delivery fee. Registration, favourites, address/coupon management, merchant tools and online payment are outside the implemented scope.

### Representative SQL

```sql
-- Item subtotals per member, including members with no items; excludes shipping and coupons.
SELECT p.order_id, u.user_id, u.username,
       COALESCE(SUM(i.quantity * i.unit_price_snapshot), 0) AS item_subtotal
FROM group_order_participants p
JOIN users u ON u.user_id = p.buyer_user_id
LEFT JOIN order_items i
  ON i.order_id = p.order_id AND i.user_id = p.buyer_user_id
WHERE p.order_id = 94002
GROUP BY p.order_id, u.user_id, u.username;

-- Read group status derived from the deadline.
SELECT order_id, deadline, group_status
FROM group_order_status_view;
```

With `db/seed.sql` imported, the first query returns `90001 = 68.00` and `90002 = 112.00` (total `180.00`); the second returns six `open` and three `locked` group orders. These results were verified against the imported seed on MySQL 8.4.7.

## Environment & Setup

### Database

Use MySQL **8.0.16+** so that CHECK constraints are enforced. From the repository root, run the following command. The script creates the database if needed, imports `db/schema.sql`, and prompts for the MySQL password:

```bash
bash db/setup.sh
```

Connection settings and the target database can be overridden with environment variables:

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_DATABASE=group_eats bash db/setup.sh
```

The target database must be new and empty; `schema.sql` is not a reset script and rerunning it against existing tables will fail. Use a new `MYSQL_DATABASE` when reproducing the import. The documented import command was run successfully against the local MySQL database.

For an existing database created from the previous schema, apply the one-time column rename before importing the updated test data:

```bash
mysql -u root -p group_eats < db/migrations/001_rename_order_buyer_to_host.sql
```

The migration renames `orders.buyer_user_id` to `orders.host_user_id`; it preserves existing values and the foreign key.

#### Test Data

After creating the schema, import the test fixtures with:

```bash
bash db/seed.sh
```

The script imports 160 related test records from `db/seed.sql` into the selected database and prompts for the MySQL password. Fixtures cover multiple buyers and sellers, available and unavailable items, used and expired coupons, solo and group orders with open and locked deadlines, different order statuses, delivery and pickup, ratings, favourites, and deliveries in different stages. In group orders `94002` and `94005`, two different buyers each add the same menu item, demonstrating that an item can be selected by multiple participants in one order. Additional group-order fixtures `94101`–`94103` cover 1, 3 and 4 participants and delivery-fee remainder allocation; solo order `94104` covers a zero-fee delivery. Other boundary cases include a buyer with two addresses and one with none, a seller with no items and no ratings, a courier with no deliveries, both directions of the favourites M:N relationships, and a historical price snapshot. See [Design decisions and fixture evidence](#design-decisions-and-fixture-evidence) for the decision each case supports; the fixture set is a coverage checklist, not a volume exercise. It uses reserved fixture IDs and upserts, so rerunning it updates the same fixture records. To select a different connection or database, use the same `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER` and `MYSQL_DATABASE` environment variables as `db/setup.sh`. The accounts use placeholder password hashes and are for database testing only.

### Inspect the database with the MySQL CLI

Keep MySQL running, then open another terminal. Use the host, port, user and database from your own `.env`. For a typical password-protected installation:

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p group_eats
```

The temporary local instance prepared on Kelly's current WSL machine instead uses port **33307**, database **group_eats_local** and an empty root password:

```bash
mysql -h 127.0.0.1 -P 33307 -u root group_eats_local
```

That second command is specific to this machine, not a required setting for teammates. The server must be running; the prepared local startup script starts it together with the website. If `mysql` is unavailable on another machine, install the MySQL command-line client or use MySQL Workbench.

At the `mysql>` prompt:

```sql
SELECT DATABASE();
SHOW TABLES;
SELECT order_id, host_user_id, order_status, fulfillment_type
FROM orders ORDER BY order_id DESC LIMIT 10;
SELECT order_id, user_id, item_id, quantity, unit_price_snapshot
FROM order_items ORDER BY order_id DESC, user_id, item_id LIMIT 20;
```

Repeat a SELECT after adding, editing or removing food on the website. Results are a snapshot and do not refresh automatically. For one order, replace the example ID with the ID shown on its page:

```sql
SELECT * FROM order_items WHERE order_id = 94102;
```

Exit with `exit;`, `quit;` or Ctrl+D. This closes the client without stopping MySQL or deleting any data.

### Verification

On Linux, macOS, WSL or Windows, activate the virtual environment using the appropriate command above. With MySQL running and `.env` configured:

```bash
python -m unittest discover -s tests -v
```

Manual acceptance: use Alice in a normal browser and Bob in a private window; create and join a group, add/change/remove items, refresh both windows, leave, and cancel. Open a seeded expired group to confirm it is read-only. Check delivery remainder examples 94102/94103 and zero-fee configuration. Then ask another member to repeat the first setup on a fresh database.

The integration suite creates a randomly named `group_eats_test_*` database, imports the actual schema/seed, and drops that test database afterwards. It never clears the configured application database. The test account needs CREATE/DROP DATABASE privileges. All 19 integration tests passed on MySQL 8.4.7. Two independent Chromium sessions also passed the create/join/add/update/remove/leave/cancel workflow, persistence and mobile layout checks. Tests cover CRUD persistence, sessions/CSRF, member isolation, price snapshots, concurrent joins, cancellation, deadlines/timezones, zero/pickup fees, remainder allocation transaction rollback and creation-timestamp migration.

Frontend changes should also be exercised with Alice/Bob in separate browser contexts. Confirm database changes after adding, editing and removing items, then verify that a nonmember cannot edit and an expired/cancelled group is read-only. These checks are preparation for group acceptance, not a claim that the course presentation or video is complete.

## Repository Structure

```text
ER/                         ER diagrams and editable draw.io files
ER_Diagram_Details*.md       Business design revisions
Instruction/                Course requirements and references
db/schema.sql               Creation script: 18 tables and 2 views
db/setup.sh                 Reproducible database creation and schema import
db/seed.sql                 Repeatable test data for the database tables
db/seed.sh                  One-command test data import
backend/                    Flask API, parameterized SQL and database management
app.py                      Same-origin application entry point
requirements.txt            Python dependencies
.env.example                Local connection/configuration template
tests/test_api.py           Real MySQL integration tests
docs/                       Shared API contract in English and Chinese
frontend/                   Database-backed frontend and local assets
README.md                   English project guide (default)
README.zh-CN.md             Simplified Chinese project guide
```

The frontend uses the real API; no live operation silently falls back to mock data. Complete the independent group acceptance run and presentation/video preparation before submission.

Order submission: the host can select Place group order at any time once items have been added to transition Pending to Confirmed. Repeated submission is idempotent; confirmed orders are read-only. No online payment or real dispatch occurs. A 1-minute deadline is available. For an existing database, `python -m backend.manage refresh-labels` updates reserved fixture names/emails without changing orders, prices or passwords; do not reseed just to rename fixtures.

The account menu opens Orders, with All orders, Group orders and Individual orders tabs. Individual orders support creation, own-item CRUD, immediate placement and cancellation before placement; confirmed orders have private, read-only receipts. Buyers without solo orders see an empty state. Login email starts blank with a generic Email address placeholder.

Individual ordering: open a store → Order for myself → choose delivery/pickup → add or edit food → Place order. Individual orders can be placed immediately; group hosts can also place early when everyone is ready. Orders tabs show counts and only the signed-in buyer’s records.

Deadline limits joining and item changes, not when submission may begin. A host may place a nonempty Pending group before or after it. Submission sets the existing order_status to Confirmed, which immediately blocks all membership/item changes. Early placement itself needs no separate lock field; simulated completion adds the three timestamps documented below. The deadline-only group_status view can still read open for an early-Confirmed order, so permission checks must always include order_status.

## Order lifecycle and simulated completion

- Pending: a draft. Individuals can edit; group membership/items can change only before the deadline. The owner/host can place a nonempty order; groups do not have to wait for the deadline.
- Confirmed: submitted and read-only. Placement atomically records placed_at and a random completion_due_at 15–60 minutes later. Retries preserve the original schedule.
- Completed: the background worker records completed_at when due; associated deliveries become Delivered. Pickup has no delivery record.
- Cancelled: cancelled before submission, retained in history and excluded from completion. Seeded In Progress orders are historical and are not advanced by this simulation.

For existing databases, run `python -m backend.manage migrate` once before starting the updated app; it is repeatable, renames the creation timestamp to `created_at`, and adds three completion timestamps/index without resetting orders or passwords. New init already includes them. Historical Confirmed orders without a due timestamp are not automatically backfilled; new submissions (or a re-confirmation that creates a missing schedule) are scheduled.

`python app.py` starts a background check every 5 seconds, independent of page visits. Downtime pauses processing; startup catches up overdue jobs without choosing a new ETA. UI polling is every 15 seconds, so visible status may lag slightly. With another WSGI runner, run `python -m backend.completion` separately. This is simulated completion, not real dispatch or payment.

Local development now reloads Python changes by default (APP_RELOAD=1), with the interactive debugger disabled. An already-running old process still requires one restart. Add food before placing appears only when there are actually no items; otherwise verify identity, lifecycle and backend version.
