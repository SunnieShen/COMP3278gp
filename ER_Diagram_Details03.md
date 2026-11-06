# Foodpanda Online Food Delivery Platform - Database Design

## Objective

The goal of this assignment is to practice designing an ER diagram for a Foodpanda Online Food Delivery Platform.  
Foodpanda wants to build a database to manage its users (Buyers, Sellers, and Couriers), restaurants, menu items, orders and group orders, deliveries, favorites, and promotional activities.  
The business requirements are described as follows:

## Business Requirements

1. **Users:** Foodpanda stores basic information about all registered users. Each user has a unique user id, a username, an email, and a phone number. Users are specialized into Buyers, Sellers, and Couriers through an ISA generalization hierarchy, where a user may hold more than one role at the same time (for example, one user may be both a Buyer and a Seller, or both a Seller and a Courier), and every user has at least one role.
   - **Buyers:** Buyers represent customers who can place solo orders, create group orders, or join existing group orders. Each buyer inherits all attributes from Users and can save multiple delivery addresses. Each address has a unique address id, an address line, and a label (e.g., Home, Office). Each address belongs to exactly one buyer, while a buyer may save multiple addresses or none yet.
   - **Sellers:** Sellers represent business entities operating on the platform and inherit all attributes from Users. Sellers are further specialized into Restaurants and Grocery Stores through an ISA generalization hierarchy, but not both.
     - **Restaurants:** Restaurants offer prepared meals and dishes, recording specific attributes including a cuisine type, a rating, and an active status.
     - **Grocery Stores:** Grocery Stores offer retail goods and grocery inventories, recording a store category and a rating.
   - **Couriers (Delivery Riders):** Couriers represent delivery personnel operating on the platform and inherit all attributes from Users. Each courier records specific delivery-related attributes such as vehicle type (e.g., Bicycle, Motorcycle, Car), license plate number, and availability/working status.

2. **Menu Items:** Each seller maintains a catalog of items (dishes or grocery goods). Each menu item has a unique item id, an item name, a price, and an availability status. Each menu item is offered by exactly one seller, while a seller may offer multiple menu items. Some newly registered sellers may not have listed any menu items yet.

3. **Favorites:** Buyers can save their favorite sellers and favorite menu items for quick re-ordering.
   - **Favorite Sellers:** A buyer may save multiple sellers as favorites, and a seller may be saved by multiple buyers. For each saved seller, Foodpanda records the saved time. A buyer may save each particular seller at most once; the same buyer cannot favorite the same seller multiple times. Some buyers may not have saved any sellers, and some sellers may not be saved by any buyers yet.
   - **Favorite Items:** A buyer may save multiple menu items as favorites, and a menu item may be saved by multiple buyers. For each saved item, Foodpanda records the saved time. A buyer may save each particular menu item at most once; the same buyer cannot favorite the same item multiple times. Some buyers may not have saved any items, and some menu items may not be saved by any buyers yet.

  3. Ordering Options & Group Orders: All orders, whether solo or collaborative, are modeled as a single ORDERS entity, which is specialized into SOLO ORDERS and GROUP ORDERS through a total, disjoint ISA generalization hierarchy.
	- The ORDERS entity: Each order has a unique order id, an order timestamp, an order status, and a fulfillment type (e.g., Delivery or Self-Pickup). Every order corresponds to exactly one seller, and is placed by exactly one buyer through the places relationship: placing a solo order and creating a new group order are both expressed as one buyer placing one order. A buyer may place many orders over time, and a seller may receive many orders.
	- SOLO ORDERS: A solo order is a regular order placed by a single buyer for immediate checkout. It carries no additional attributes beyond those inherited from ORDERS, and it is not joinable by other buyers.
	- GROUP ORDERS: A group order is a collaborative order hosted by one buyer. In addition to the inherited attributes, it records a deadline (before which buyers may join and add items), and its status progresses through open, locked, and completed. The buyer who places a group order is its host.
	- Joining group orders: A buyer may join an existing group order hosted by another buyer as a member, through the participates relationship between Buyers and GROUP ORDERS. A buyer may join multiple group orders, and a group order may consist of multiple member buyers (including its host). A solo order has no members other than the buyer who placed it.

5.  Order Items: ORDER ITEMS is modeled as a separate entity, rather than a relationship or a multivalued attribute of Order. Each order item records the purchase quantity and the unit price snapshot at the time of addition, and is uniquely identified by the combination of the order it belongs to, the buyer who added it, and the menu item selected.
	- Each order item belongs to exactly one order (solo or group), and an order may contain multiple order items.
	- Each order item is added by exactly one buyer, and a buyer may add multiple order items.
	- Each order item refers to exactly one menu item, and a menu item may be referred to by many order items across different orders.
	- Because the adding buyer is part of its identity, the same menu item may appear in the same group order as separate order items added by different members, each with its own quantity and price snapshot.
	- Order items may be added, modified, or removed while the group order is still open (before it is locked).
![[Pasted image 20261107001405.png]]

6.  Coupons: Foodpanda stores information about promotional coupons. Each coupon records a coupon code, a discount value, a minimum spend threshold, and an expiry date. A buyer may apply a coupon to a solo order or a group order during checkout. An order may use at most one coupon, while a coupon may be applied to multiple orders over time. Two alternative interpretations of the Coupon entity are proposed below; only one will be kept in the final design.
	- Option A - Coupon as a weak entity of Buyer: A coupon does not have a globally unique identifier of its own. It is modeled as a weak entity identified by its owner buyer together with its partial key, the coupon code. Each coupon belongs to exactly one buyer, while a buyer may own multiple coupons.
	- Option B - Coupon as a strong entity associated with one buyer: Each coupon has a globally unique coupon id, and is associated with one unique buyer who owns it. A buyer may own multiple coupons, while each coupon belongs to exactly one buyer.

7. **Deliveries:** For orders or group orders requiring delivery (Delivery fulfillment type), Foodpanda manages the delivery assignment and tracking process. Each delivery record has a unique delivery id, a delivery status (e.g., Assigned, Picked Up, Delivered), and a delivery timestamp. Each delivery is assigned to exactly one courier and corresponds to exactly one solo order or group order. A courier may handle multiple deliveries over time, while an order requiring delivery is assigned to at most one courier.
