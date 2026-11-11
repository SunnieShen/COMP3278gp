-- COMP3278 Group Eats test fixtures
-- Import after schema.sql. All IDs are reserved for these fixtures.
-- Re-running this file updates the same fixture rows instead of duplicating them.
-- Contains approximately 120 rows across all tables, covering different order,
-- coupon, fulfillment, availability, rating, and group-deadline scenarios.

START TRANSACTION;

INSERT INTO users (user_id, username, email, phone_number, password_hash) VALUES
    (90001, 'Test Buyer Alice', 'alice.test@example.invalid', '+85200009001', 'test-only-hash-90001'),
    (90002, 'Test Buyer Bob', 'bob.test@example.invalid', '+85200009002', 'test-only-hash-90002'),
    (90003, 'Test Buyer Carol', 'carol.test@example.invalid', '+85200009003', 'test-only-hash-90003'),
    (90004, 'Test Buyer David', 'david.test@example.invalid', '+85200009004', 'test-only-hash-90004'),
    (90005, 'Test Buyer Emma', 'emma.test@example.invalid', '+85200009005', 'test-only-hash-90005'),
    (90006, 'Test Buyer Frank', 'frank.test@example.invalid', '+85200009006', 'test-only-hash-90006'),
    (90007, 'Test Buyer Grace', 'grace.test@example.invalid', '+85200009007', 'test-only-hash-90007'),
    (90101, 'Test Restaurant', 'restaurant.test@example.invalid', '+85200009101', 'test-only-hash-90101'),
    (90102, 'Test Grocery Store', 'grocery.test@example.invalid', '+85200009102', 'test-only-hash-90102'),
    (90103, 'Test Noodle Shop', 'noodles.test@example.invalid', '+85200009103', 'test-only-hash-90103'),
    (90201, 'Test Courier', 'courier.test@example.invalid', '+85200009201', 'test-only-hash-90201'),
    (90202, 'Test Courier Two', 'courier2.test@example.invalid', '+85200009202', 'test-only-hash-90202')
ON DUPLICATE KEY UPDATE
    username = VALUES(username),
    email = VALUES(email),
    phone_number = VALUES(phone_number),
    password_hash = VALUES(password_hash);

INSERT INTO buyers (user_id) VALUES
    (90001), (90002), (90003), (90004), (90005), (90006), (90007)
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO sellers (user_id) VALUES
    (90101), (90102), (90103)
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO couriers (user_id, vehicle_type, license_plate_number, availability_status) VALUES
    (90201, 'Bicycle', 'TEST-90201', 'Available'),
    (90202, 'Motorcycle', 'TEST-90202', 'On Delivery')
ON DUPLICATE KEY UPDATE
    vehicle_type = VALUES(vehicle_type),
    license_plate_number = VALUES(license_plate_number),
    availability_status = VALUES(availability_status);

INSERT INTO restaurants (user_id, cuisine_type, active_status) VALUES
    (90101, 'Hong Kong Cafe', 'Active'),
    (90103, 'Noodles', 'Active')
ON DUPLICATE KEY UPDATE
    cuisine_type = VALUES(cuisine_type),
    active_status = VALUES(active_status);

INSERT INTO grocery_stores (user_id, store_category) VALUES
    (90102, 'Test Grocery')
ON DUPLICATE KEY UPDATE store_category = VALUES(store_category);

INSERT INTO addresses (address_id, buyer_user_id, address_line, label) VALUES
    (91001, 90001, 'Test Address 1, Central', 'Home'),
    (91002, 90002, 'Test Address 2, Sheung Wan', 'Home'),
    (91003, 90003, 'Test Address 3, Wan Chai', 'Work'),
    (91004, 90004, 'Test Address 4, Kowloon City', 'Home'),
    (91005, 90005, 'Test Address 5, Mong Kok', 'Home'),
    (91006, 90006, 'Test Address 6, Causeway Bay', 'Work'),
    (91007, 90007, 'Test Address 7, Tai Wai', 'Home')
ON DUPLICATE KEY UPDATE
    buyer_user_id = VALUES(buyer_user_id),
    address_line = VALUES(address_line),
    label = VALUES(label);

INSERT INTO menu_items (item_id, seller_user_id, item_name, price, availability_status) VALUES
    (92001, 90101, 'Test Set Meal', 68.00, 'Available'),
    (92002, 90101, 'Test Milk Tea', 22.00, 'Available'),
    (92003, 90102, 'Test Apples', 18.50, 'Available'),
    (92004, 90102, 'Test Bread', 25.00, 'Unavailable'),
    (92005, 90103, 'Test Beef Noodles', 72.00, 'Available'),
    (92006, 90103, 'Test Dumplings', 46.00, 'Available'),
    (92007, 90102, 'Test Orange Juice', 16.00, 'Available'),
    (92008, 90101, 'Test Egg Tart', 12.00, 'Available'),
    (92009, 90103, 'Test Chili Oil', 9.50, 'Unavailable')
ON DUPLICATE KEY UPDATE
    seller_user_id = VALUES(seller_user_id),
    item_name = VALUES(item_name),
    price = VALUES(price),
    availability_status = VALUES(availability_status);

INSERT INTO coupons
    (coupon_id, buyer_user_id, coupon_code, discount_value, minimum_spend_threshold, expiry_date)
VALUES
    (93001, 90001, 'TEST-ALICE-10', 10.00, 50.00, '2099-12-31 23:59:59'),
    (93002, 90003, 'TEST-CAROL-5', 5.00, 20.00, '2099-12-31 23:59:59'),
    (93003, 90004, 'TEST-DAVID-15', 15.00, 70.00, '2099-12-31 23:59:59'),
    (93004, 90005, 'TEST-EMMA-EXPIRED', 8.00, 30.00, '2020-01-01 00:00:00'),
    (93005, 90006, 'TEST-FRANK-5', 5.00, 0.00, '2099-12-31 23:59:59')
ON DUPLICATE KEY UPDATE
    buyer_user_id = VALUES(buyer_user_id),
    coupon_code = VALUES(coupon_code),
    discount_value = VALUES(discount_value),
    minimum_spend_threshold = VALUES(minimum_spend_threshold),
    expiry_date = VALUES(expiry_date);

INSERT INTO orders
    (order_id, host_user_id, seller_user_id, coupon_id, order_timestamp, order_status, fulfillment_type)
VALUES
    (94001, 90003, 90102, 93002, '2026-01-15 12:00:00', 'Completed', 'Self-Pickup'),
    (94002, 90001, 90101, 93001, '2026-01-16 18:30:00', 'In Progress', 'Delivery'),
    (94003, 90002, 90101, NULL,  '2026-01-17 19:00:00', 'Pending', 'Delivery'),
    (94004, 90004, 90103, 93003, '2026-02-01 12:15:00', 'Completed', 'Delivery'),
    (94005, 90005, 90101, NULL,  '2026-02-02 18:00:00', 'Pending', 'Delivery'),
    (94006, 90006, 90102, 93005, '2026-02-03 13:30:00', 'Confirmed', 'Self-Pickup'),
    (94007, 90007, 90102, NULL,  '2026-02-04 10:00:00', 'Cancelled', 'Self-Pickup'),
    (94008, 90004, 90103, NULL,  '2026-02-05 19:15:00', 'In Progress', 'Delivery'),
    (94009, 90007, 90101, NULL,  '2026-02-06 20:00:00', 'Pending', 'Delivery')
ON DUPLICATE KEY UPDATE
    host_user_id = VALUES(host_user_id),
    seller_user_id = VALUES(seller_user_id),
    coupon_id = VALUES(coupon_id),
    order_timestamp = VALUES(order_timestamp),
    order_status = VALUES(order_status),
    fulfillment_type = VALUES(fulfillment_type);

INSERT INTO solo_orders (order_id) VALUES
    (94001), (94004), (94007)
ON DUPLICATE KEY UPDATE order_id = VALUES(order_id);

INSERT INTO group_orders (order_id, deadline) VALUES
    (94002, '2099-12-31 23:59:59'),
    (94003, '2000-01-01 00:00:00'),
    (94005, '2099-12-31 23:59:59'),
    (94006, '2000-01-01 00:00:00'),
    (94008, '2099-12-31 23:59:59'),
    (94009, '2000-01-01 00:00:00')
ON DUPLICATE KEY UPDATE deadline = VALUES(deadline);

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
    (94009, 90004)
ON DUPLICATE KEY UPDATE
    order_id = VALUES(order_id),
    buyer_user_id = VALUES(buyer_user_id);

INSERT INTO order_items (order_id, user_id, item_id, quantity, unit_price_snapshot) VALUES
    (94001, 90003, 92003, 2, 18.50),
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
    (94009, 90004, 92002, 1, 22.00)
ON DUPLICATE KEY UPDATE
    quantity = VALUES(quantity),
    unit_price_snapshot = VALUES(unit_price_snapshot);

INSERT INTO favorite_sellers (buyer_user_id, seller_user_id, saved_time) VALUES
    (90001, 90101, '2026-01-10 09:00:00'),
    (90002, 90102, '2026-01-11 09:30:00'),
    (90004, 90103, '2026-01-13 12:00:00'),
    (90005, 90101, '2026-01-14 08:15:00'),
    (90007, 90102, '2026-01-15 17:45:00')
ON DUPLICATE KEY UPDATE saved_time = VALUES(saved_time);

INSERT INTO favorite_items (buyer_user_id, item_id, saved_time) VALUES
    (90001, 92001, '2026-01-10 09:05:00'),
    (90003, 92003, '2026-01-12 10:00:00'),
    (90004, 92005, '2026-01-13 12:05:00'),
    (90005, 92008, '2026-01-14 08:20:00'),
    (90006, 92006, '2026-01-14 18:30:00'),
    (90007, 92007, '2026-01-15 17:50:00')
ON DUPLICATE KEY UPDATE saved_time = VALUES(saved_time);

INSERT INTO seller_ratings (buyer_user_id, seller_user_id, score) VALUES
    (90001, 90101, 5.0),
    (90002, 90101, 4.0),
    (90003, 90102, 4.5),
    (90004, 90103, 5.0),
    (90005, 90101, 3.5),
    (90006, 90102, 4.0),
    (90007, 90103, 2.5)
ON DUPLICATE KEY UPDATE score = VALUES(score);

INSERT INTO deliveries
    (delivery_id, order_id, courier_user_id, delivery_status, delivery_timestamp, shipping_fee)
VALUES
    (95001, 94002, 90201, 'Picked Up', '2026-01-16 18:45:00', 12.00),
    (95002, 94003, 90201, 'Assigned', '2026-01-17 19:05:00', 15.00),
    (95003, 94004, 90202, 'Delivered', '2026-02-01 12:50:00', 10.00),
    (95004, 94005, 90201, 'Assigned', '2026-02-02 18:10:00', 12.00),
    (95005, 94008, 90202, 'Picked Up', '2026-02-05 19:30:00', 15.00),
    (95006, 94009, 90201, 'Assigned', '2026-02-06 20:10:00', 12.00)
ON DUPLICATE KEY UPDATE
    order_id = VALUES(order_id),
    courier_user_id = VALUES(courier_user_id),
    delivery_status = VALUES(delivery_status),
    delivery_timestamp = VALUES(delivery_timestamp),
    shipping_fee = VALUES(shipping_fee);

COMMIT;
