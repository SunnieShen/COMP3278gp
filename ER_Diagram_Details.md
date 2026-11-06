# Foodpanda Online Food Delivery Platform - Database Design

## Objective
The goal of this project is to design a database and application for a Foodpanda Online Food Delivery Platform. Foodpanda wants to build a database to manage its users, delivery addresses, restaurants, dishes, orders, order items, and reviews.

## Business Requirements

* **Users:** Foodpanda stores information about all registered customers. Each user has a unique user id, a username, an email, and a phone number.
* **User Addresses:** Users can save multiple delivery addresses. Each address has a unique address id, an address line, and a label (e.g., Home, Office). Each address belongs to exactly one user. A user may have multiple addresses, while some users may not have added any addresses yet.
* **Restaurants:** Foodpanda stores information about various restaurants. Each restaurant has a unique restaurant id, a restaurant name, a cuisine type, a rating, and an active status indicating whether it is currently operating.
* **Dishes:** Restaurants offer menus consisting of various dishes. Each dish has a unique dish id, a dish name, a price, and an availability status (e.g., in stock or sold out). Each dish is offered by exactly one restaurant. A restaurant may offer multiple dishes, while some newly registered restaurants may not have any dishes listed yet.
* **Orders:** Users can place orders from restaurants. Each order has a unique order id, total amount, order status (e.g., Pending, Preparing, Delivering, Completed, Cancelled), and a creation date. Each order is placed by exactly one user and received by exactly one restaurant. A user may place multiple orders, while some users may not have placed any orders yet. A restaurant may receive multiple orders, while some restaurants may not have received any orders.
* **Order Items:** Orders contain multiple items corresponding to specific dishes. Each order item has a unique order item id and records the purchase quantity and the unit price at the time of ordering. Each order item belongs to exactly one order and references exactly one dish. An order must contain one or more order items, while a dish may appear in multiple order items across different orders.
* **Reviews:** Users can write reviews for completed orders and restaurants. Each review has a unique review id, a rating (from 1 to 5), and comment text. Each review corresponds to exactly one order, is written by exactly one user, and evaluates exactly one restaurant. An order may have at most one review, while a user or a restaurant may be associated with multiple reviews over time.
