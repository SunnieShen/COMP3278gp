# Foodpanda Online Food Delivery Platform - Database Design

## Objective

The goal of this assignment is to practice designing an ER diagram for a Foodpanda Online Food Delivery Platform.  
Foodpanda wants to build a database to manage its users, restaurants, menu items, group orders, favorites, and promotional activities.  
The business requirements are described as follows:

## Business Requirements

- **Users:** Foodpanda stores basic information about all registered users. Each user has a unique user id, a username, an email, and a phone number. Users are specialized into Buyers and Sellers through an ISA generalization hierarchy, where every user is either a buyer or a seller, but not both.
  - **Buyers:** Buyers represent customers who can place orders or join group orders. Each buyer inherits all attributes from Users and can save multiple delivery addresses. Each address has a unique address id, an address line, and a label (e.g., Home, Office). Each address belongs to exactly one buyer, while a buyer may save multiple addresses or none yet.
  - **Sellers:** Sellers represent business entities operating on the platform and inherit all attributes from Users. Sellers are further specialized into Restaurants and Grocery Stores through an ISA generalization hierarchy, but not both.
    - **Restaurants:** Restaurants offer prepared meals and dishes, recording specific attributes including a cuisine type, a rating, and an active status.
    - **Grocery Stores:** Grocery Stores offer retail goods and grocery inventories, recording a store category and a rating.
- **Menu Items:** Each seller maintains a catalog of items (dishes or grocery goods). Each menu item has a unique item id, an item name, a price, and an availability status. Each menu item is offered by exactly one seller, while a seller may offer multiple menu items. Some newly registered sellers may not have listed any menu items yet.
- **Favorites:** Buyers can save their favorite sellers and favorite menu items for quick re-ordering.
  - **Favorite Sellers:** A buyer may save multiple sellers as favorites, and a seller may be saved by multiple buyers. For each saved seller, Foodpanda records the saved time. Some buyers may not have saved any sellers, and some sellers may not be saved by any buyers yet.
  - **Favorite Items:** A buyer may save multiple menu items as favorites, and a menu item may be saved by multiple buyers. For each saved item, Foodpanda records the saved time. Some buyers may not have saved any items, and some menu items may not be saved by any buyers yet.
- **Group Orders:** Buyers can initiate collaborative group orders tied to a specific seller. Each group order has a unique group order id, a deadline, an order status (e.g., open, locked, completed), and a fulfillment type (e.g., Delivery or Self-Pickup). Each group order is hosted by exactly one buyer (the host) and corresponds to exactly one seller. A buyer may host multiple group orders, while a seller may receive multiple group orders.
- **Order Members:** Buyers can join group orders as members. A buyer may join multiple group orders, and a group order may consist of multiple member buyers.
- **Order Items:** Members can add menu items to a group order before it is locked. A group order contains multiple order items, and each menu item may be selected in multiple group orders. For each order item, Foodpanda records the purchase quantity, the unit price snapshot at the time of addition, and the member buyer who added the item.
- **Coupons:** Foodpanda stores information about promotional coupons. Each coupon has a unique coupon id, a coupon code, a discount value, a minimum spend threshold, and an expiry date. A buyer may apply a coupon to a group order during checkout. A group order may use at most one coupon, while a coupon may be applied to multiple group orders by different buyers.
