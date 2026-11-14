# Frontend–Backend Contract v1

**English** | [简体中文](API.zh-CN.md)

Implemented contract: buyer login, catalog browsing, individual/group orders, membership, item CRUD, summaries, placement, cancellation and simulated completion. The ER03 entities are retained; orders adds three operational timestamps for completion.

## 1. Common rules

- Base path: `/api/v1`. Serve the frontend and API on the same origin in the integrated app. The static HTTP preview cannot serve these APIs; run Flask for the integrated app.
- JSON request bodies use `Content-Type: application/json`. Successful responses use `{"data": ...}`; creation returns 201, reads/updates return 200, and successful deletes return 204 with no body.
- Use an HttpOnly session cookie for authentication, not a browser-supplied user ID. Send cookies with requests. `GET /auth/session` also returns a `csrf_token`; send it as `X-CSRF-Token` on every POST, PUT, PATCH or DELETE, including login/logout. The server verifies it.
- Database IDs are positive JSON integers within JavaScript's safe-integer range. Database-generated IDs are authoritative. Never manufacture order IDs with `Date.now()` or send mock IDs to the real backend.
- Money uses HKD integer cents in the API, e.g. `6800` means HK$68.00. Convert MySQL DECIMAL values exactly on the server; do not calculate bills with binary floating-point division. Format cents only for display.
- Collections return arrays, including `[]` for no results. Optional fields use `null`, not invented values. Reject unknown write fields, invalid IDs, fractional/nonpositive quantities and malformed times with 400.
- The backend owns validation, permissions and totals. Frontend disabling is only a convenience. Use parameterized SQL and transactions.

Error example (never return raw SQL or password hashes):

```json
{"error":{"code":"GROUP_LOCKED","message":"The deadline has passed. Items can no longer be changed."}}
```

| HTTP | Error codes |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `INVALID_CREDENTIALS`, `AUTH_REQUIRED` |
| 403 | `BUYER_REQUIRED`, `NOT_A_MEMBER`, `HOST_ONLY`, `HOST_CANNOT_LEAVE`, `CSRF_INVALID` |
| 404 | `NOT_FOUND` |
| 409 | `GROUP_LOCKED`, `ORDER_NOT_EDITABLE`, `ITEM_UNAVAILABLE`, `WRONG_SELLER`, `SELLER_INACTIVE`, `QUANTITY_LIMIT`, `CONCURRENT_UPDATE`, `EMPTY_ORDER`, `INVALID_ORDER` |
| 503 | `DELIVERY_NOT_CONFIGURED` |
| 500 | `INTERNAL_ERROR` (generic message) |

## 2. Schema and UI field mapping

| Meaning | Database | API / frontend |
|---|---|---|
| Signed-in buyer | users.user_id + buyers.user_id | `user_id` from session |
| Seller identity | sellers.user_id | `seller_user_id` |
| Seller display name | users.username joined through sellers | `username` |
| Order host | orders.host_user_id | `host_user_id`; never orders.buyer_user_id |
| Membership | group_order_participants.buyer_user_id | members[].`buyer_user_id` |
| Item identity | menu_items.item_id | `item_id` |
| Current price | menu_items.price | `price_cents` |
| Stored line identity | order_items(order_id,user_id,item_id) | `order_id` + current session user + `item_id` |
| Historical price | order_items.unit_price_snapshot | `unit_price_snapshot_cents` |
| Shipping fee | deliveries.shipping_fee | `shipping_fee_cents` |
| Deadline-derived state | group_order_status_view.group_status | `group_status`: `open` / `locked` |
| Order lifecycle | orders.order_status | `order_status`, separate from group_status |

Seller objects additionally expose `kind` (`restaurant` / `grocery`), `cuisine_type` or `store_category`, `active_status` (null for groceries), and nullable `rating` from seller_rating_view. Item objects expose `item_name` and `availability_status` exactly as seeded: `Available` / `Unavailable` (capitalized).

Catalog photos/descriptions, review counts, promotions and minimum spend are not database columns; submitted orders have a persisted completion estimate. Keep optional local image mappings keyed by real IDs, use a placeholder when absent, and omit unsupported claims. A seller with no items returns an empty menu; a seller with no ratings returns `rating: null`.

## 3. Time and order lifecycle

- API timestamps are ISO 8601 with explicit Hong Kong offset, e.g. `2026-11-14T12:30:00+08:00`. Return `server_time` with group lists/details so clients need not trust their own clock.
- Set **every MySQL connection** to `time_zone = '+08:00'`. Treat existing DATETIME seed values as Hong Kong wall time. Normalize incoming timestamps to Hong Kong before storage; offset-free timestamps are invalid.
- At creation, deadline must be later than server time. `server_time < deadline` means open; equality or later means locked. No early-lock endpoint, button or `locked_at` column.
- New groups use `order_status = 'Pending'`. In phase one, only Pending groups before the deadline are editable. Cancellation sets `Cancelled`; it preserves records for history and disables further edits, including joining/leaving.
- Preserve existing seed statuses (`Pending`, `Confirmed`, `In Progress`, `Completed`, `Cancelled`) without rewriting them. A historical order may have group_status=open but lifecycle=Completed; that does **not** make it editable.
- Detail responses expose `can_edit`, `can_join`, `can_leave`, `can_cancel`, `can_place` for the current caller. Recheck all permissions and time inside every write transaction, locking the parent order row to serialize competing membership/item/cancellation changes.
- This phase includes deadline locking, cost summaries and host submission to Confirmed. Payment workflows, coupons, shipping addresses, merchant/courier screens and favourites are outside this contract. Existing mock-only controls must be hidden or explicitly marked until implemented.

## 4. Endpoints

Public: session, seller list/detail and menu. All group endpoints require a buyer session. Inactive restaurants remain browsable but cannot accept new groups or new item lines.

| Method | Path | Request / response |
|---|---|---|
| GET | `/auth/session` | `{data:{user:null\|{user_id,username,role:"buyer"},csrf_token}}` |
| POST | `/auth/login` | Body `{email,password}`; 200 returns same session shape, with a fresh CSRF token |
| POST | `/auth/logout` | Invalidate session; 204; retrieve a new session token before signing in again |
| GET | `/sellers?kind=restaurant&q=noodle` | Seller array; optional kind and case-insensitive name/cuisine/category search; default includes both kinds, ordered by seller ID |
| GET | `/sellers/{seller_user_id}` | One seller object |
| GET | `/sellers/{seller_user_id}/items` | Item array including unavailable items, ordered by item ID; UI disables unavailable additions |
| GET | `/group-orders?scope=joinable` | `{data:{server_time,orders:[...]}}`; default scope=joinable (Pending, before deadline, caller not yet a member); scope=mine includes caller's groups/history |
| POST | `/group-orders` | Body `{seller_user_id,deadline,fulfillment_type}`; fulfillment is `Delivery` / `Self-Pickup`; 201 returns complete detail |
| GET | `/group-orders/{order_id}` | Complete detail for members; a nonmember receives only a preview `{order_id,seller_user_id,seller_name,host_user_id,deadline,group_status,order_status,member_count,server_time,can_join}` |
| PUT | `/group-orders/{order_id}/members/me` | Empty JSON body; join; idempotent for an existing member; 200 complete detail |
| DELETE | `/group-orders/{order_id}/members/me` | Leave and delete own lines in one transaction; host must cancel instead; 204 |
| PUT | `/group-orders/{order_id}/items/{item_id}` | Body `{quantity}` sets the **absolute** integer quantity (1–99); create/update caller's own line; 200 complete detail |
| DELETE | `/group-orders/{order_id}/items/{item_id}` | Delete caller's own line; idempotent if already absent; 204 |
| POST | `/group-orders/{order_id}/place` | Empty JSON body; host only, Pending with at least one item, before or after the deadline; set Confirmed; repeated Confirmed submissions return the same detail; 200 |
| POST | `/group-orders/{order_id}/cancel` | Empty JSON body; host only, Pending and before deadline; already-Cancelled is idempotent; 200 complete detail |

Unknown order IDs return 404. For known groups, writes require membership (except joining); closed/non-Pending membership and item mutations fail, even when the desired row already exists/does not exist. Cancelling an already-Cancelled order is the one lifecycle exception. No body may choose the caller's identity, price, host, coupon, courier or shipping fee.

Creation atomically inserts orders, group_orders and the host's participation. New lines must be available and belong to the group's seller; use the current DB price for the initial snapshot. Updating the quantity of an existing line preserves its snapshot, even after a catalog price change. Existing unavailable lines may be reduced or deleted, but not increased. A deleted line added again takes the then-current price. Members see everyone's lines and subtotals but can change only their own. The host cannot transfer ownership in this phase.

The invite link is a frontend route such as `#/group/94102`. Opening it retrieves the preview; joining uses the authenticated buyer session. It is not an authentication secret. After 204 responses, refetch the relevant list/detail. On session expiry prompt for login; on 409 refresh details. Show loading/error states instead of silently falling back to mock data.

## 5. Delivery fee: source, rounding and zero

Existing orders always use their stored deliveries.shipping_fee. Never infer money from a promotional label or a frontend seller.fee field.

For **new Delivery groups**, the schema requires a delivery record with a courier and contains no seller tariff. Phase-one local-demo policy: configure `DELIVERY_FEE_CENTS` (default `1000`) and `DEMO_COURIER_USER_ID` on the server; the latter must reference a seeded Available courier. Create the Assigned delivery record in the same transaction as the group and snapshot this fee there. Missing/invalid delivery configuration returns 503 and rolls back creation. The API does not let buyers set these values. Courier assignment is a demo shortcut, not real dispatch. A zero configured fee is valid. No schema migration is required for this policy.

For Self-Pickup, create no delivery row and return fee=0. For an existing Delivery order missing its delivery record, report an error; do not disguise missing data as free delivery.

For F shipping cents and N current members (including host and members with no items):

```text
base = F // N
remainder = F % N
nonhost shipping share = base
host shipping share = base + remainder
member total = sum(quantity × snapshot cents) + shipping share
```

The backend calculates and returns totals for all members. Recalculate after joining/leaving; costs are provisional while open. Sum of member shares must equal the stored delivery fee. Coupons are not applied in this phase; seeded coupon orders expose `coupon_id` and `coupon_applied: false`, with the summary explicitly labelled **before coupons** rather than a final payable bill.

| Seed order | Members | Shipping cents | Nonhost share | Host share |
|---|---:|---:|---:|---:|
| 94101 | 1 | 1000 | — | 1000 |
| 94102 | 3 | 1000 | 333 | 334 |
| 94103 | 4 | 1002 | 250 | 252 |
| 94104 (individual) | 1 | 0 | — | 0 |

The zero-fee seed is a solo order, not a group. To exercise this through the phase-one group UI, create a Delivery group with server fee configured to 0; individual-order endpoints are documented below.

## 6. Example complete group response

`GET /group-orders/94102` as host 90002 (members only):

```json
{
  "data": {
    "order_id": 94102,
    "host_user_id": 90002,
    "seller_user_id": 90101,
    "seller_name": "Harbour Cafe",
    "created_at": "2026-11-12T12:05:00+08:00",
    "deadline": "2099-12-31T23:59:59+08:00",
    "server_time": "2026-11-14T12:00:00+08:00",
    "order_status": "Pending",
    "group_status": "open",
    "fulfillment_type": "Delivery",
    "coupon_id": null,
    "currency": "HKD",
    "coupon_applied": false,
    "summary_basis": "before_coupons",
    "shipping_fee_cents": 1000,
    "can_edit": true,
    "can_join": false,
    "can_leave": false,
    "can_cancel": true,
    "can_place": true,
    "members": [
      {"buyer_user_id":90002,"username":"Bob Chan","is_host":true,"item_subtotal_cents":6800,"shipping_share_cents":334,"total_cents":7134},
      {"buyer_user_id":90003,"username":"Carol Lee","is_host":false,"item_subtotal_cents":2200,"shipping_share_cents":333,"total_cents":2533},
      {"buyer_user_id":90004,"username":"David Lam","is_host":false,"item_subtotal_cents":6800,"shipping_share_cents":333,"total_cents":7133}
    ],
    "items": [
      {"order_id":94102,"user_id":90002,"item_id":92001,"item_name":"Soy Sauce Chicken Rice","quantity":1,"unit_price_snapshot_cents":6800,"line_total_cents":6800},
      {"order_id":94102,"user_id":90003,"item_id":92002,"item_name":"Hong Kong Milk Tea","quantity":1,"unit_price_snapshot_cents":2200,"line_total_cents":2200},
      {"order_id":94102,"user_id":90004,"item_id":92001,"item_name":"Soy Sauce Chicken Rice","quantity":1,"unit_price_snapshot_cents":6800,"line_total_cents":6800}
    ]
  }
}
```

Sort members by buyer_user_id and lines by user_id,item_id. Group-list entries use the preview fields plus `is_member` and `is_host`, ordered by order_id descending; they do not include everyone's line details.

## 7. Integration notes

Use actual API-generated order IDs, integer cents and server timestamps. See the project README for setup, demo accounts and verification. Keep both language versions synchronized.

## Submission update

`can_place` is true only for the host of a Pending, nonempty group regardless of deadline. POST /place checks the parent order under lock, membership consistency and delivery presence, then sets orders.order_status to Confirmed without creating a second order or delivery. Confirmed groups cannot be edited. This is confirmation, not payment or real dispatch.

## Unified order history

GET /orders?type=all|group|individual (default all) requires a buyer session. It returns {data:{server_time,orders:[...]}} using current membership for groups and host ownership for individuals; entries include order_type, created_at, status, seller, fulfillment type and group metadata (null deadline/group_status for individuals). GET /orders/{id} returns a group member's detail with order_type=group, or the owning buyer's individual receipt with order_type=individual, items, item_subtotal_cents, shipping_fee_cents, total_cents, coupon_applied=false, summary_basis=before_coupons and lifecycle permissions (Pending orders are editable). Other buyers cannot access individual receipts (404); group nonmembers receive 403 here and should use the group invitation endpoint instead. Individual creation and mutations are specified below.

## Individual-order actions

POST /orders accepts {seller_user_id,fulfillment_type} and atomically creates a Pending order, solo_orders subtype and optional delivery. PUT /orders/{id}/items/{item_id} accepts {quantity} (1–99); DELETE removes an owned line. POST /orders/{id}/place confirms a nonempty Pending order immediately, without a deadline; repeated Confirmed submission is idempotent. POST /orders/{id}/cancel cancels a Pending order, also idempotently. Only the owning buyer can read or mutate these orders (404 otherwise). GET detail exposes can_edit, can_cancel, can_place. Confirmed/Cancelled orders cannot change; prices are snapshotted and delivery fees use the existing server policy. No group participation is created for individual orders.

Deadline limits joining and item changes, not when submission may begin. A host may place a nonempty Pending group before or after it. Submission sets the existing order_status to Confirmed, which immediately blocks all membership/item changes. Early placement itself needs no separate lock field; simulated completion adds the three timestamps documented below. The deadline-only group_status view can still read open for an early-Confirmed order, so permission checks must always include order_status.

## Order lifecycle and simulated completion

- Pending: a draft. Individuals can edit; group membership/items can change only before the deadline. The owner/host can place a nonempty order; groups do not have to wait for the deadline.
- Confirmed: submitted and read-only. Placement atomically records placed_at and a random completion_due_at 15–60 minutes later. Retries preserve the original schedule.
- Completed: the background worker records completed_at when due; associated deliveries become Delivered. Pickup has no delivery record.
- Cancelled: cancelled before submission, retained in history and excluded from completion. Seeded In Progress orders are historical and are not advanced by this simulation.

For existing databases, run `python -m backend.manage migrate` once before starting the updated app; it is repeatable and adds three timestamps/index without resetting orders or passwords. New init already includes them. Historical Confirmed orders without a due timestamp are not automatically backfilled; new submissions (or a re-confirmation that creates a missing schedule) are scheduled.

`python app.py` starts a background check every 5 seconds, independent of page visits. Downtime pauses processing; startup catches up overdue jobs without choosing a new ETA. UI polling is every 15 seconds, so visible status may lag slightly. With another WSGI runner, run `python -m backend.completion` separately. This is simulated completion, not real dispatch or payment.

Local development now reloads Python changes by default (APP_RELOAD=1), with the interactive debugger disabled. An already-running old process still requires one restart. Add food before placing appears only when there are actually no items; otherwise verify identity, lifecycle and backend version.

Order list/detail and placement responses expose placed_at, completion_due_at and completed_at as nullable Hong Kong ISO timestamps. New orders have null timing fields until submission. These are persisted operational columns, not additional entities.
