-- =====================================================================
-- COMP3278 Group Eats — relational schema reduced from ER/ER03.drawio
-- MySQL 8.0.16+ (CHECK is enforced from 8.0.16 onwards)
--
-- Naming rule
--   * Tables: lower-case plural names (same convention as README.md).
--   * Columns: the attribute names given in ER03 (user_id, address_id,
--     item_id, order_id, coupon_id, delivery_id, unit_price_snapshot, ...).
--   * A foreign key to USER / BUYER / SELLER / COURIER is prefixed with its
--     role, e.g. buyer_user_id, seller_user_id, courier_user_id, because
--     ORDERS needs two different user roles in one table.
--   * PK = primary key, UK = UNIQUE, FK = foreign key.
--
-- Relational schemas (18 tables)
--   users(user_id PK, username, email UK, phone_number, password_hash)
--   buyers(user_id PK/FK->users)                         -- ISA subtype, role marker
--   sellers(user_id PK/FK->users)                       -- ISA subtype, role marker
--   couriers(user_id PK/FK->users, vehicle_type, license_plate_number, availability_status)
--   restaurants(user_id PK/FK->sellers, cuisine_type, active_status)
--   grocery_stores(user_id PK/FK->sellers, store_category)
--   addresses(address_id PK, buyer_user_id FK->buyers, address_line, label)   -- SAVES 1:N
--   menu_items(item_id PK, seller_user_id FK->sellers, item_name, price, availability_status) -- OFFERS 1:N
--   coupons(coupon_id PK, buyer_user_id FK->buyers, coupon_code, discount_value, minimum_spend_threshold, expiry_date) -- OWNS 1:N
--   orders(order_id PK, host_user_id FK->buyers, seller_user_id FK->sellers,
--          coupon_id UK/FK->coupons, order_timestamp, order_status, fulfillment_type)  -- PLACES / FULFILLS / APPLIES
--   solo_orders(order_id PK/FK->orders)                 -- ISA subtype
--   group_orders(order_id PK/FK->orders, deadline)     -- ISA subtype
--   group_order_participants(order_id PK/FK->group_orders, buyer_user_id PK/FK->buyers) -- PARTICIPATES M:N
--   order_items(order_id PK/FK->orders, user_id PK/FK->buyers, item_id PK/FK->menu_items,
--               quantity, unit_price_snapshot)         -- weak entity + ADDS/CONTAINS/SELECTS
--   favorite_sellers(buyer_user_id PK/FK->buyers, seller_user_id PK/FK->sellers, saved_time) -- FAVORITES_SELLER M:N
--   favorite_items(buyer_user_id PK/FK->buyers, item_id PK/FK->menu_items, saved_time)      -- FAVORITES_ITEM M:N
--   seller_ratings(buyer_user_id PK/FK->buyers, seller_user_id PK/FK->sellers, score)        -- RATE M:N
--   deliveries(delivery_id PK, order_id UK/FK->orders, courier_user_id FK->couriers,
--              delivery_status, delivery_timestamp, shipping_fee)  -- HAS_DELIVERY 1:1 + ASSIGNED_TO 1:N
--
-- Derived attributes are NOT stored as columns (see the two views at the end):
--   SELLER.rating        = AVG(RATE.score)
--   GROUP_ORDERS.group_status = 'open' / 'locked', derived from deadline
--   amount due per member = SUM(unit_price_snapshot * quantity) + shipping_fee / member count
--
-- Rules that DDL cannot enforce (application / trigger territory):
--   1. ISA is total + disjoint: every user is exactly one of buyer/seller/courier,
--      every seller exactly one of restaurant/grocery_store, every order exactly
--      one of solo/group. Enforce with a role column or triggers at insertion time.
--   2. A group order's host (= orders.host_user_id) is also a row in
--      group_order_participants; every group order has at least one participant.
--   3. order_items.user_id must be the host or a participant of that order.
--   4. Only orders with fulfillment_type = 'Delivery' may have a deliveries row.
--   5. Coupon checks: not expired, order amount >= minimum_spend_threshold,
--      coupons.buyer_user_id = orders.host_user_id (a voucher is single-use
--      and owned by exactly one buyer).
--   6. After deadline (status 'locked'), no insert/update/delete of order items
--      or participants.
--   7. A solo order has no participants other than its placing buyer.
--   8. One (buyer, seller) pair rates at most once (guaranteed by the composite
--      PK). If repeated ratings per order are wanted, add order_id or rate_time.
--   9. To cascade deletes, add ON DELETE CASCADE to the relevant FKs.
--
-- Run with:  mysql -u root -p group_eats < db/schema.sql
-- (create the database first if needed):
--   CREATE DATABASE group_eats CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
--   USE group_eats;
-- =====================================================================


-- ---------------------------------------------------------------------
-- USER and its ISA hierarchy (total, disjoint)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

-- BUYER / SELLER carry no own attributes; they are kept as role tables so
-- that foreign keys can only point to accounts with the right role.
CREATE TABLE buyers (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE sellers (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE couriers (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    vehicle_type VARCHAR(50) NOT NULL,
    license_plate_number VARCHAR(20) NOT NULL,
    availability_status VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE restaurants (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    cuisine_type VARCHAR(100) NOT NULL,
    active_status VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES sellers(user_id)
);

CREATE TABLE grocery_stores (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    store_category VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES sellers(user_id)
);


-- ---------------------------------------------------------------------
-- SAVES (BUYER 1:N ADDRESS, every address belongs to exactly one buyer)
-- ---------------------------------------------------------------------
CREATE TABLE addresses (
    address_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    label VARCHAR(50),
    FOREIGN KEY (buyer_user_id) REFERENCES buyers(user_id)
);


-- ---------------------------------------------------------------------
-- OFFERS (SELLER 1:N MENU_ITEM, every item is offered by exactly one seller)
-- ---------------------------------------------------------------------
CREATE TABLE menu_items (
    item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    seller_user_id BIGINT UNSIGNED NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    availability_status VARCHAR(20) NOT NULL,
    CHECK (price >= 0),
    FOREIGN KEY (seller_user_id) REFERENCES sellers(user_id)
);


-- ---------------------------------------------------------------------
-- OWNS (BUYER 1:N COUPON, every coupon belongs to exactly one buyer)
-- Option B: coupon is a per-buyer, single-use voucher instance.
-- ---------------------------------------------------------------------
CREATE TABLE coupons (
    coupon_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    coupon_code VARCHAR(50) NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    minimum_spend_threshold DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    expiry_date DATETIME NOT NULL,
    CHECK (discount_value > 0),
    CHECK (minimum_spend_threshold >= 0),
    FOREIGN KEY (buyer_user_id) REFERENCES buyers(user_id)
);


-- ---------------------------------------------------------------------
-- ORDERS: PLACES (BUYER 1:N), FULFILLS (SELLER 1:N),
--         APPLIES (COUPON 1:1, both sides partial -> UNIQUE + nullable FK)
-- ---------------------------------------------------------------------
CREATE TABLE orders (
    order_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    host_user_id BIGINT UNSIGNED NOT NULL,
    seller_user_id BIGINT UNSIGNED NOT NULL,
    coupon_id BIGINT UNSIGNED UNIQUE,
    order_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_status VARCHAR(20) NOT NULL,
    fulfillment_type ENUM('Delivery', 'Self-Pickup') NOT NULL,
    FOREIGN KEY (host_user_id) REFERENCES buyers(user_id),
    FOREIGN KEY (seller_user_id) REFERENCES sellers(user_id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id)
);

CREATE TABLE solo_orders (
    order_id BIGINT UNSIGNED PRIMARY KEY,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE group_orders (
    order_id BIGINT UNSIGNED PRIMARY KEY,
    deadline DATETIME NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- PARTICIPATES (BUYER M:N GROUP_ORDERS)
CREATE TABLE group_order_participants (
    order_id BIGINT UNSIGNED NOT NULL,
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (order_id, buyer_user_id),
    FOREIGN KEY (order_id) REFERENCES group_orders(order_id),
    FOREIGN KEY (buyer_user_id) REFERENCES buyers(user_id)
);

-- ORDER_ITEM: ID-dependent weak entity, identified by the three owners
-- (CONTAINS order + ADDS buyer + SELECTS menu item). No surrogate id.
CREATE TABLE order_items (
    order_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    unit_price_snapshot DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (order_id, user_id, item_id),
    CHECK (quantity > 0),
    CHECK (unit_price_snapshot >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (user_id) REFERENCES buyers(user_id),
    FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
);


-- ---------------------------------------------------------------------
-- FAVORITES_SELLER / FAVORITES_ITEM (M:N, composite PK also enforces
-- "at most once per buyer", so no extra UNIQUE is needed)
-- ---------------------------------------------------------------------
CREATE TABLE favorite_sellers (
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    seller_user_id BIGINT UNSIGNED NOT NULL,
    saved_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (buyer_user_id, seller_user_id),
    FOREIGN KEY (buyer_user_id) REFERENCES buyers(user_id),
    FOREIGN KEY (seller_user_id) REFERENCES sellers(user_id)
);

CREATE TABLE favorite_items (
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    saved_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (buyer_user_id, item_id),
    FOREIGN KEY (buyer_user_id) REFERENCES buyers(user_id),
    FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
);

-- RATE (BUYER M:N SELLER, partial participation on both sides).
-- SELLER.rating is derived from score, so it is not stored here.
CREATE TABLE seller_ratings (
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    seller_user_id BIGINT UNSIGNED NOT NULL,
    score DECIMAL(2, 1) NOT NULL,
    PRIMARY KEY (buyer_user_id, seller_user_id),
    CHECK (score BETWEEN 1 AND 5),
    FOREIGN KEY (buyer_user_id) REFERENCES buyers(user_id),
    FOREIGN KEY (seller_user_id) REFERENCES sellers(user_id)
);


-- ---------------------------------------------------------------------
-- DELIVERY: HAS_DELIVERY (ORDERS 1:1, delivery participates totally)
--           ASSIGNED_TO (COURIER 1:N, delivery participates totally)
-- shipping_fee belongs to the DELIVERY entity, not to the relationship.
-- ---------------------------------------------------------------------
CREATE TABLE deliveries (
    delivery_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL UNIQUE,
    courier_user_id BIGINT UNSIGNED NOT NULL,
    delivery_status ENUM('Assigned', 'Picked Up', 'Delivered') NOT NULL,
    delivery_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shipping_fee DECIMAL(10, 2) NOT NULL,
    CHECK (shipping_fee >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (courier_user_id) REFERENCES couriers(user_id)
);


-- ---------------------------------------------------------------------
-- Derived attributes as views (no stored columns)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW seller_rating_view AS
SELECT S.user_id, AVG(R.score) AS rating
FROM sellers S
LEFT JOIN seller_ratings R ON R.seller_user_id = S.user_id
GROUP BY S.user_id;

CREATE OR REPLACE VIEW group_order_status_view AS
SELECT order_id, deadline,
       CASE WHEN deadline > NOW() THEN 'open' ELSE 'locked' END AS group_status
FROM group_orders;
