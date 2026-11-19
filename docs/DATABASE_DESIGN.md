# Foodpanda Online Food Delivery Platform - Database Design Specification

## Objective
The goal of this assignment is to design a rigorous and comprehensive ER diagram and database specification for a Foodpanda Online Food Delivery Platform. Foodpanda manages users, sellers, menu items, orders, group orders, deliveries, favorites, and promotional activities. 

---

## Business Requirements

1. **Users & Accounts:** 
   * Foodpanda stores basic information for all registered user accounts. Each account has a unique `user_id` (primary key), a `username`, an `email`, and a `phone number`. 
   * **Role Isolation via Accounts:** Each user account corresponds to strictly **one role** (Buyer, Seller, or Courier) through an ISA generalization hierarchy. If a real-world person acts in multiple roles (e.g., both a Buyer and a Courier), they must register separate accounts with distinct `user_id`s, ensuring complete isolation of permissions and attributes.
   * **Buyers:** Buyers represent customers who can place solo orders, create group orders, or join existing group orders. Each buyer can save multiple delivery addresses. Each address is uniquely identified by a surrogate key `address_id`, while the textual `address_line` may be identical across different accounts or family members (differentiated solely by `address_id`). Each address belongs to exactly one buyer, while a buyer may save multiple addresses or none yet.
   * **Sellers:** Sellers represent business entities operating on the platform and inherit all attributes from Users. Sellers are further specialized into **Restaurants** and **Grocery Stores** through a disjoint ISA generalization hierarchy.
     * **Restaurants:** Offer prepared meals and dishes, recording a `cuisine type`, a `rating`, and an active status.
     * **Grocery Stores:** Offer retail goods and grocery inventories, recording a store category and a `rating`.
   * **Couriers (Delivery Riders):** Represent delivery personnel, recording a vehicle type (e.g., Bicycle, Motorcycle, Car), a license plate number, and working status.

2. **Menu Items:** 
   Each seller maintains a catalog of items. Each menu item has a unique `item id`, an `item name`, a `price`, and an `availability status`. Each menu item is offered by exactly one seller, while a seller may offer multiple items (or none for newly registered sellers).

3. **Favorites:** 
   Buyers can save favorite sellers and items for quick re-ordering, recording the `saved_time`. 
   * **Uniqueness Constraint:** Each buyer may save a particular seller or menu item **at most once**. Duplicate favorites are strictly prohibited, maintained via database unique constraints on the relation without redundant flags.

4. **Ordering Options & Group Orders:** 
   All orders are modeled under a single **ORDERS** entity, specialized into **SOLO ORDERS** and **GROUP ORDERS** through a total, disjoint ISA hierarchy.
   * **ORDERS Entity:** Records a unique `order id`, `created_at` (creation time), an `order status`, `placed_at` (placement time), `completion_due_at` (expected completion time), `completed_at` (actual completion time), and a `fulfillment type` (Delivery or Self-Pickup). Every order corresponds to one seller and is placed by one buyer via the `places` relationship.
   * **SOLO ORDERS:** Regular orders placed by a single buyer for immediate checkout, carrying no additional attributes and unjoinable by others.
   * **GROUP ORDERS:** Collaborative orders hosted by one buyer, recording a `deadline` and a derived `group_status` (`open` before the deadline, otherwise `locked`). Members can join and edit items while the order is Pending and open. Placing the order stops further changes. Order progress is recorded in the inherited `order_status`. The placing buyer acts as the host.
   * **Joining Group Orders:** Buyers can join group orders as members via the `participates` relationship, allowing multiple member buyers per group order.

5. **Order Items:** 
   **ORDER ITEMS** is modeled as an independent entity rather than a multi-valued attribute. Each order item records the purchase `quantity` and `unit price` snapshot. Its unique identity is formed by the combination of: **[Belonging Order + Adding Buyer + Menu Item]**. This allows different members in the same group order to independently add the same menu item with their own quantities and price snapshots.

6. **Coupons (Option B Selected):** 
   * **Design Choice:** Selected **Option B** (Strong entity with a globally unique `coupon_id`), as coupons are platform-issued promotional assets with independent lifecycles, avoiding data redundancy across users.
   * **Attributes:** Each coupon has a unique `coupon id`, a `coupon code`, a `discount value`, a `minimum spend threshold`, and an `expiry date`. Each coupon belongs to one owner buyer via a foreign key, while a buyer can own multiple coupons. Orders can apply at most one coupon during checkout.

7. **Deliveries:** 
   For delivery-fulfillment orders, Foodpanda manages tracking via **Deliveries**. Each delivery record has a unique `delivery id`, a `delivery status` (Assigned, Picked Up, Delivered), and a `delivery timestamp`. Each delivery is assigned to exactly one courier and corresponds to exactly one order (1:1 relation for delivery-required orders).

---
