# Foodpanda Online Food Delivery Platform - Database Design

## Objective

The goal of this assignment is to practice designing an ER diagram for a Foodpanda Online Food Delivery Platform.  
Foodpanda wants to build a database to manage its users (Buyers, Sellers, and Couriers), restaurants, menu items, orders and group orders, deliveries, favorites, and promotional activities.  
The business requirements are described as follows:

## Business Requirements

1. **Users:** Foodpanda stores basic information about all registered users. Each user has a unique user id, a username, an email, and a phone number. Users are specialized into Buyers, Sellers, and Couriers through an ISA generalization hierarchy, where every user belongs to exactly one role.
   - **Buyers:** Buyers represent customers who can place solo orders, create group orders, or join existing group orders. Each buyer inherits all attributes from Users and can save multiple delivery addresses. Each address has a unique address id, an address line, and a label (e.g., Home, Office). Each address belongs to exactly one buyer, while a buyer may save multiple addresses or none yet.
   - **Sellers:** Sellers represent business entities operating on the platform and inherit all attributes from Users. Sellers are further specialized into Restaurants and Grocery Stores through an ISA generalization hierarchy, but not both.
     - **Restaurants:** Restaurants offer prepared meals and dishes, recording specific attributes including a cuisine type, a rating, and an active status.
     - **Grocery Stores:** Grocery Stores offer retail goods and grocery inventories, recording a store category and a rating.
   - **Couriers (Delivery Riders):** Couriers represent delivery personnel operating on the platform and inherit all attributes from Users. Each courier records specific delivery-related attributes such as vehicle type (e.g., Bicycle, Motorcycle, Car), license plate number, and availability/working status.
2. **Menu Items:** Each seller maintains a catalog of items (dishes or grocery goods). Each menu item has a unique item id, an item name, a price, and an availability status. Each menu item is offered by exactly one seller, while a seller may offer multiple menu items. Some newly registered sellers may not have listed any menu items yet.
3. **Favorites:** Buyers can save their favorite sellers and favorite menu items for quick re-ordering.
   - **Favorite Sellers:** A buyer may save multiple sellers as favorites, and a seller may be saved by multiple buyers. For each saved seller, Foodpanda records the saved time. Some buyers may not have saved any sellers, and some sellers may not be saved by any buyers yet.
   - **Favorite Items:** A buyer may save multiple menu items as favorites, and a menu item may be saved by multiple buyers. For each saved item, Foodpanda records the saved time. Some buyers may not have saved any items, and some menu items may not be saved by any buyers yet.
4. **Ordering Options & Group Orders:** When placing an order, buyers have multiple options: placing a solo order, creating a new group order, or joining an existing group order hosted by another buyer.
   - **Solo Orders:** A buyer may place an individual solo order tied to a specific seller, recording a unique order id, an order timestamp, an order status, a fulfillment type (e.g., Delivery or Self-Pickup), and the placing buyer.
   - **Create Group Orders:** A buyer may host a collaborative group order tied to a specific seller. Each group order has a unique group order id, a deadline, an order status (e.g., open, locked, completed), and a fulfillment type (e.g., Delivery or Self-Pickup). Each group order is hosted by exactly one buyer (the host) and corresponds to exactly one seller.
   - **Join Group Orders:** A buyer may join a group order hosted by another buyer as a member. A buyer may join multiple group orders, and a group order may consist of multiple member buyers.
5. **Order Items:** For both solo orders and group orders (before locking), order items record the selected menu items. Each order item connects to a specific solo order or group order and a menu item, recording the purchase quantity, the unit price snapshot at the time of addition, and the buyer who added the item.
6. **Coupons:** Foodpanda stores information about promotional coupons. Each coupon has a unique coupon id, a coupon code, a discount value, a minimum spend threshold, and an expiry date. A buyer may apply a coupon to a solo order or a group order during checkout. An order or group order may use at most one coupon, while a coupon may be applied to multiple orders or group orders by different buyers.
7. **Deliveries:** For orders or group orders requiring delivery (Delivery fulfillment type), Foodpanda manages the delivery assignment and tracking process. Each delivery record has a unique delivery id, a delivery status (e.g., Assigned, Picked Up, Delivered), and a delivery timestamp. Each delivery is assigned to exactly one courier and corresponds to exactly one solo order or group order. A courier may handle multiple deliveries over time, while an order requiring delivery is assigned to at most one courier.
