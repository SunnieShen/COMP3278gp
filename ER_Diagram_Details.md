# Foodpanda Online Food Delivery Platform - Database Design

## Objective
The goal of this project is to design a database and application for a Foodpanda Online Food Delivery Platform. Foodpanda wants to build a database to manage its stratified user accounts (Buyers and Sellers), restaurant/grocery menus, group orders, order items, coupons, and merchant analytics.

## Business Requirements & ISA Modeling

* **Users (Supertype):** 
  * **Description:** Foodpanda stores basic information for all registered accounts in a unified `Users` table, acting as the supertype entity in the system.
  * **Attributes:** Unique `user_id` (PK), `username`, `email`, and `phone`. 
  * **Functionality:** Supports universal user registration and login.

* **Buyers (Subtype of Users):** 
  * **Description:** A specialized user subtype representing customers who place orders or join group orders. Connected to `Users` via an ISA relationship.
  * **Attributes & Relationships:** Inherits `user_id` from `Users`. Can be associated with multiple `User_Addresses` (each having an `address_id` [PK], `address_line`, and `label` like Home/Office) to support multiple delivery locations.

* **Sellers (Subtype of Users):** 
  * **Description:** Business entities operating on the platform, representing the second subtype of `Users` under the **ISA (Is-A) generalization hierarchy**.
  * **Attributes:** Inherits `user_id` (serving as `seller_id`) and manages operational status. Sellers are further specialized into:
    * **Restaurants:** Specialized sellers that offer prepared meals and dishes, characterized by specific attributes including `cuisine_type`, `rating`, and `is_active` status.
    * **Grocery Stores:** Specialized sellers that offer retail goods and grocery inventories (designed as an expandable merchant type with dedicated inventory logic).

* **Restaurants & Grocery Menu Items:** 
  * **Description:** Each seller maintains its own catalog of goods or dishes.
  * **Attributes:** Each menu item/good has a unique `item_id` (PK), `seller_id` (FK), `name`, `price`, and `is_available` status.
  * **Operations:** Users can browse, search, and sort items. Merchants can manually update prices or delist items, and view backend analytics such as daily revenue and sales rankings (best-selling vs. underperforming items).

* **Group Orders:** 
  * **Description:** Users can initiate collaborative group orders tied to a specific seller.
  * **Attributes:** Each group order has a unique `group_order_id` (PK), `host_user_id` (FK referencing Buyers), `seller_id` (FK referencing Sellers), `deadline`, `status` (open, locked, completed), and `fulfillment_type` (Delivery vs. Self-Pickup).
  * **Operations:** A host can create, modify, or cancel a group order (which triggers cascading cleanup of associated members and items), and update its workflow status (`open` $\rightarrow$ `locked` $\rightarrow$ `completed`).

* **Order Members:** 
  * **Description:** Users can join or leave a group order as participants.
  * **Implementation:** This forms a many-to-many (M:N) relationship between `Users` (Buyers) and `Group_Orders`, managed explicitly through an association table (`order_members`) containing member-specific records.

* **Order Items & Fulfillment:** 
  * **Description:** Items selected within a group order before locking.
  * **Attributes & Rules:** Group order members can add items, update quantities, or remove items before the order is locked (modifications are strictly prohibited after locking). Each record in the `order_items` association table records a `unit_price` snapshot at the time of addition alongside the `quantity`. 
  * **Calculations:** Members can view individual payment breakdowns, including proportionally shared delivery fees. **Fulfillment flexibility:** Orders support either **Delivery** (with delivery fees applied) or **Self-Pickup** (waiving delivery fees).

* **Coupons & Discounts:** 
  * **Description:** Platform-wide promotional vouchers to incentivize purchases.
  * **Attributes:** Each coupon has a unique `coupon_id` / `code` (PK), `discount_value`, `min_spend` threshold, and `expiry_date`.
  * **Operations:** Users can select and apply valid coupons during checkout, which automatically recalculates and deducts from the total order amount.
