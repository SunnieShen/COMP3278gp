-- COMP3278 Group Eats test fixtures
-- Import after schema.sql. All IDs are reserved for these fixtures.
-- Re-running this file updates the same fixture rows instead of duplicating them.
-- Fixtures are chosen for CASE COVERAGE, not volume: every row exists to exercise
-- one design decision (ISA total/disjoint, participation 0 / 1 / N, M:N, 1:1,
-- weak entity, derived attributes, price snapshots). See README.md
-- "Design decisions and fixture evidence" for the decision each case supports.

START TRANSACTION;

INSERT INTO users (user_id, username, email, phone_number, password_hash) VALUES
    (90001, 'Alice Wong', 'alice@example.com', '+85200009001', 'test-only-hash-90001'),
    (90002, 'Bob Chan', 'bob@example.com', '+85200009002', 'test-only-hash-90002'),
    (90003, 'Carol Lee', 'carol@example.com', '+85200009003', 'test-only-hash-90003'),
    (90004, 'David Lam', 'david@example.com', '+85200009004', 'test-only-hash-90004'),
    (90005, 'Emma Cheung', 'emma@example.com', '+85200009005', 'test-only-hash-90005'),
    (90006, 'Frank Ho', 'frank@example.com', '+85200009006', 'test-only-hash-90006'),
    (90007, 'Grace Lau', 'grace@example.com', '+85200009007', 'test-only-hash-90007'),
    (90008, 'Helen Ng', 'helen@example.com', '+85200009008', 'test-only-hash-90008'),
    (90101, 'Harbour Cafe', 'restaurant@example.com', '+85200009101', 'test-only-hash-90101'),
    (90102, 'Fresh Market', 'grocery@example.com', '+85200009102', 'test-only-hash-90102'),
    (90103, 'Noodle Lane', 'noodles@example.com', '+85200009103', 'test-only-hash-90103'),
    (90104, 'Green Table', 'newseller@example.com', '+85200009104', 'test-only-hash-90104'),
    (90201, 'Jason Yip', 'courier@example.com', '+85200009201', 'test-only-hash-90201'),
    (90202, 'Ryan Tang', 'courier2@example.com', '+85200009202', 'test-only-hash-90202'),
    (90203, 'Chris Lo', 'courier3@example.com', '+85200009203', 'test-only-hash-90203')
ON DUPLICATE KEY UPDATE
    username = VALUES(username),
    email = VALUES(email),
    phone_number = VALUES(phone_number),
    password_hash = VALUES(password_hash);

INSERT INTO buyers (user_id) VALUES
    (90001), (90002), (90003), (90004), (90005), (90006), (90007), (90008)
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO sellers (user_id) VALUES
    (90101), (90102), (90103), (90104)
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO couriers (user_id, vehicle_type, license_plate_number, availability_status) VALUES
    (90201, 'Bicycle', 'BIKE-JY', 'Available'),
    (90202, 'Motorcycle', 'HK 6382', 'On Delivery'),
    (90203, 'Bicycle', 'BIKE-CL', 'Available')
ON DUPLICATE KEY UPDATE
    vehicle_type = VALUES(vehicle_type),
    license_plate_number = VALUES(license_plate_number),
    availability_status = VALUES(availability_status);

INSERT INTO restaurants (user_id, cuisine_type, active_status) VALUES
    (90101, 'Hong Kong Cafe', 'Active'),
    (90103, 'Noodles', 'Active'),
    (90104, 'Vegetarian', 'Inactive')
ON DUPLICATE KEY UPDATE
    cuisine_type = VALUES(cuisine_type),
    active_status = VALUES(active_status);

INSERT INTO grocery_stores (user_id, store_category) VALUES
    (90102, 'Fresh produce & pantry')
ON DUPLICATE KEY UPDATE store_category = VALUES(store_category);

-- 90001 has two addresses, 90008 has none: both sides of SAVES 1:N / partial participation.
INSERT INTO addresses (address_id, buyer_user_id, address_line, label) VALUES
    (91001, 90001, '18 Queen''s Road Central, Central', 'Home'),
    (91002, 90002, '60 Bonham Strand, Sheung Wan', 'Home'),
    (91003, 90003, '15 Hennessy Road, Wan Chai', 'Work'),
    (91004, 90004, '22 Nga Tsin Wai Road, Kowloon City', 'Home'),
    (91005, 90005, '80 Argyle Street, Mong Kok', 'Home'),
    (91006, 90006, '30 Yee Wo Street, Causeway Bay', 'Work'),
    (91007, 90007, '12 Chik Fai Street, Tai Wai', 'Home'),
    (91008, 90001, '100 Des Voeux Road Central, Central', 'Work')
ON DUPLICATE KEY UPDATE
    buyer_user_id = VALUES(buyer_user_id),
    address_line = VALUES(address_line),
    label = VALUES(label);

-- 90104 is a seller with no menu items and no ratings (partial participation on
-- OFFERS and RATE); seller_rating_view must still return a row with a NULL rating.
INSERT INTO menu_items (item_id, seller_user_id, item_name, price, availability_status) VALUES
    (92001, 90101, 'Soy Sauce Chicken Rice', 68.00, 'Available'),
    (92002, 90101, 'Hong Kong Milk Tea', 22.00, 'Available'),
    (92003, 90102, 'Fuji Apples', 18.50, 'Available'),
    (92004, 90102, 'Wholemeal Bread', 25.00, 'Unavailable'),
    (92005, 90103, 'Braised Beef Noodle Soup', 72.00, 'Available'),
    (92006, 90103, 'Pork and Chive Dumplings', 46.00, 'Available'),
    (92007, 90102, 'Fresh Orange Juice', 16.00, 'Available'),
    (92008, 90101, 'Classic Egg Tart', 12.00, 'Available'),
    (92009, 90103, 'House Chilli Oil', 9.50, 'Unavailable')
ON DUPLICATE KEY UPDATE
    seller_user_id = VALUES(seller_user_id),
    item_name = VALUES(item_name),
    price = VALUES(price),
    availability_status = VALUES(availability_status);

INSERT INTO coupons
    (coupon_id, buyer_user_id, coupon_code, discount_value, minimum_spend_threshold, expiry_date)
VALUES
    (93001, 90001, 'WELCOME10', 10.00, 50.00, '2099-12-31 23:59:59'),
    (93002, 90003, 'COFFEE5', 5.00, 20.00, '2099-12-31 23:59:59'),
    (93003, 90004, 'DINNER15', 15.00, 70.00, '2099-12-31 23:59:59'),
    (93004, 90005, 'SUMMER8', 8.00, 30.00, '2020-01-01 00:00:00'),
    (93005, 90006, 'FRESH5', 5.00, 0.00, '2099-12-31 23:59:59')
ON DUPLICATE KEY UPDATE
    buyer_user_id = VALUES(buyer_user_id),
    coupon_code = VALUES(coupon_code),
    discount_value = VALUES(discount_value),
    minimum_spend_threshold = VALUES(minimum_spend_threshold),
    expiry_date = VALUES(expiry_date);

INSERT INTO orders
    (order_id, host_user_id, seller_user_id, coupon_id, created_at, order_status, fulfillment_type)
VALUES
    (94001, 90003, 90102, 93002, '2026-01-15 12:00:00', 'Completed', 'Self-Pickup'),
    (94002, 90001, 90101, 93001, '2026-01-16 18:30:00', 'In Progress', 'Delivery'),
    (94003, 90002, 90101, NULL,  '2026-01-17 19:00:00', 'Pending', 'Delivery'),
    (94004, 90004, 90103, 93003, '2026-02-01 12:15:00', 'Completed', 'Delivery'),
    (94005, 90005, 90101, NULL,  '2026-02-02 18:00:00', 'Pending', 'Delivery'),
    (94006, 90006, 90102, 93005, '2026-02-03 13:30:00', 'Confirmed', 'Self-Pickup'),
    (94007, 90007, 90102, NULL,  '2026-02-04 10:00:00', 'Cancelled', 'Self-Pickup'),
    (94008, 90004, 90103, NULL,  '2026-02-05 19:15:00', 'In Progress', 'Delivery'),
    (94009, 90007, 90101, NULL,  '2026-02-06 20:00:00', 'Pending', 'Delivery'),
    (94101, 90001, 90101, NULL, '2026-11-12 12:00:00', 'Pending', 'Delivery'),
    (94102, 90002, 90101, NULL, '2026-11-12 12:05:00', 'Pending', 'Delivery'),
    (94103, 90005, 90101, NULL, '2026-11-12 12:10:00', 'Pending', 'Delivery'),
    (94104, 90004, 90103, NULL, '2026-11-12 13:00:00', 'Confirmed', 'Delivery')
ON DUPLICATE KEY UPDATE
    host_user_id = VALUES(host_user_id),
    seller_user_id = VALUES(seller_user_id),
    coupon_id = VALUES(coupon_id),
    created_at = VALUES(created_at),
    order_status = VALUES(order_status),
    fulfillment_type = VALUES(fulfillment_type);

INSERT INTO solo_orders (order_id) VALUES
    (94001), (94004), (94007), (94104)
ON DUPLICATE KEY UPDATE order_id = VALUES(order_id);

-- 2099 deadlines are always open, 2000 deadlines always locked, so the derived
-- group_order_status_view returns both branches regardless of when it is queried.
INSERT INTO group_orders (order_id, deadline) VALUES
    (94002, '2099-12-31 23:59:59'),
    (94003, '2000-01-01 00:00:00'),
    (94005, '2099-12-31 23:59:59'),
    (94006, '2000-01-01 00:00:00'),
    (94008, '2099-12-31 23:59:59'),
    (94009, '2000-01-01 00:00:00'),
    (94101, '2099-12-31 23:59:59'),
    (94102, '2099-12-31 23:59:59'),
    (94103, '2099-12-31 23:59:59')
ON DUPLICATE KEY UPDATE deadline = VALUES(deadline);

-- Group sizes of 1, 3 and 4 cover boundary cases for participant-based cost sharing.
INSERT INTO group_order_participants (order_id, buyer_user_id) VALUES
    (94002, 90001),
    (94002, 90002),
    (94003, 90002),
    (94003, 90003),
    (94005, 90005),
    (94005, 90006),
    (94006, 90006),
    (94006, 90007),
    (94008, 90004),
    (94008, 90005),
    (94009, 90007),
    (94009, 90004),
    (94101, 90001),
    (94102, 90002),
    (94102, 90003),
    (94102, 90004),
    (94103, 90005),
    (94103, 90006),
    (94103, 90007),
    (94103, 90008)
ON DUPLICATE KEY UPDATE
    order_id = VALUES(order_id),
    buyer_user_id = VALUES(buyer_user_id);

-- 94001/92003 keeps a historical unit price (16.50) that differs from the current
-- menu_items.price (18.50): the snapshot is evidence, not a copy of the catalogue.
-- 94002 and 94005 each contain item 92001 added by TWO different buyers, which
-- is exactly the case the three-part PK (order_id, user_id, item_id) must allow.
INSERT INTO order_items (order_id, user_id, item_id, quantity, unit_price_snapshot) VALUES
    (94001, 90003, 92003, 2, 16.50),
    (94001, 90003, 92004, 1, 25.00),
    (94002, 90001, 92001, 1, 68.00),
    (94002, 90002, 92002, 2, 22.00),
    (94002, 90002, 92001, 1, 68.00),
    (94003, 90002, 92001, 1, 68.00),
    (94003, 90003, 92002, 1, 22.00),
    (94004, 90004, 92005, 1, 72.00),
    (94004, 90004, 92006, 1, 46.00),
    (94005, 90005, 92001, 1, 68.00),
    (94005, 90006, 92008, 2, 12.00),
    (94005, 90006, 92001, 1, 68.00),
    (94006, 90006, 92003, 2, 18.50),
    (94006, 90007, 92007, 1, 16.00),
    (94007, 90007, 92004, 1, 25.00),
    (94008, 90004, 92005, 1, 72.00),
    (94008, 90005, 92006, 2, 46.00),
    (94009, 90007, 92001, 1, 68.00),
    (94101, 90001, 92001, 1, 68.00),
    (94102, 90002, 92001, 1, 68.00),
    (94102, 90003, 92002, 1, 22.00),
    (94102, 90004, 92001, 1, 68.00),
    (94103, 90005, 92001, 1, 68.00),
    (94103, 90006, 92002, 1, 22.00),
    (94103, 90007, 92008, 1, 12.00),
    (94103, 90008, 92001, 1, 68.00),
    (94104, 90004, 92005, 1, 72.00),
    (94009, 90004, 92002, 1, 22.00)
ON DUPLICATE KEY UPDATE
    quantity = VALUES(quantity),
    unit_price_snapshot = VALUES(unit_price_snapshot);

-- 90001 favourites two sellers and 92001 is favourited by two buyers: both
-- directions of the two M:N favourites relationships are represented.
INSERT INTO favorite_sellers (buyer_user_id, seller_user_id, saved_time) VALUES
    (90001, 90101, '2026-01-10 09:00:00'),
    (90001, 90102, '2026-01-16 10:00:00'),
    (90002, 90102, '2026-01-11 09:30:00'),
    (90004, 90103, '2026-01-13 12:00:00'),
    (90005, 90101, '2026-01-14 08:15:00'),
    (90007, 90102, '2026-01-15 17:45:00')
ON DUPLICATE KEY UPDATE saved_time = VALUES(saved_time);

INSERT INTO favorite_items (buyer_user_id, item_id, saved_time) VALUES
    (90001, 92001, '2026-01-10 09:05:00'),
    (90002, 92001, '2026-01-16 10:05:00'),
    (90003, 92003, '2026-01-12 10:00:00'),
    (90004, 92005, '2026-01-13 12:05:00'),
    (90005, 92008, '2026-01-14 08:20:00'),
    (90006, 92006, '2026-01-14 18:30:00'),
    (90007, 92007, '2026-01-15 17:50:00')
ON DUPLICATE KEY UPDATE saved_time = VALUES(saved_time);

-- Scores are deliberately uneven, so seller_rating_view produces non-trivial
-- averages (90101 = 4.1667, 90102 = 4.25, 90103 = 3.75); 90104 has no scores.
INSERT INTO seller_ratings (buyer_user_id, seller_user_id, score) VALUES
    (90001, 90101, 5.0),
    (90002, 90101, 4.0),
    (90003, 90102, 4.5),
    (90004, 90103, 5.0),
    (90005, 90101, 3.5),
    (90006, 90102, 4.0),
    (90007, 90103, 2.5)
ON DUPLICATE KEY UPDATE score = VALUES(score);

-- Delivery orders have a matching delivery; the three Self-Pickup orders have
-- none. 90203 has no deliveries, covering the 0 side of COURIER ASSIGNED_TO.
-- 94104 has a zero-fee delivery; 94101-94103 exercise 1 / 3 / 4 participants.
INSERT INTO deliveries
    (delivery_id, order_id, courier_user_id, delivery_status, delivery_timestamp, shipping_fee)
VALUES
    (95001, 94002, 90201, 'Picked Up', '2026-01-16 18:45:00', 12.00),
    (95002, 94003, 90201, 'Assigned', '2026-01-17 19:05:00', 15.00),
    (95003, 94004, 90202, 'Delivered', '2026-02-01 12:50:00', 10.00),
    (95004, 94005, 90201, 'Assigned', '2026-02-02 18:10:00', 12.00),
    (95005, 94008, 90202, 'Picked Up', '2026-02-05 19:30:00', 15.00),
    (95006, 94009, 90201, 'Assigned', '2026-02-06 20:10:00', 12.00),
    (95101, 94101, 90201, 'Assigned', '2026-11-12 12:15:00', 10.00),
    (95102, 94102, 90202, 'Assigned', '2026-11-12 12:20:00', 10.00),
    (95103, 94103, 90201, 'Assigned', '2026-11-12 12:25:00', 10.02),
    (95104, 94104, 90202, 'Assigned', '2026-11-12 13:05:00', 0.00)
ON DUPLICATE KEY UPDATE
    order_id = VALUES(order_id),
    courier_user_id = VALUES(courier_user_id),
    delivery_status = VALUES(delivery_status),
    delivery_timestamp = VALUES(delivery_timestamp),
    shipping_fee = VALUES(shipping_fee);

COMMIT;
