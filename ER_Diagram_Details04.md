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

# Foodpanda 在线外卖平台 - 数据库设计规范

## 项目目标
本次作业旨在为 Foodpanda 在线外卖平台设计一套严谨、详尽的 ER 图与数据库需求文档，涵盖用户、卖家、菜单项、订单、拼单、配送、收藏夹及促销活动等核心业务。

---

## 业务需求描述

1. **用户与账户（Users & Accounts）：** 
   * Foodpanda 存储所有注册账户的基础信息，每个账户拥有唯一的 `user_id`（主键）、`username`、`email` 和 `phone`。
   * **多账户角色隔离机制：** 每个账户在系统中**严格对应单一角色**（Buyer、Seller 或 Courier）。若真实用户需兼顾多种角色（如既是买家又是骑手），必须通过注册拥有不同 `user_id` 的独立账户来实现，从而确保权限与属性边界清晰。
   * **买家（Buyers）：** 代表可下个人订单、创建或加入拼单的顾客。买家可保存多个送货地址；每个地址拥有独立的代理主键 `address_id`，而详细地址文本 `address_line` 允许重复（例如同一家庭成员拥有相同地址但 `address_id` 各自独立）。
   * **卖家（Sellers）：** 代表平台商业实体，继承用户属性，并通过不相交的 ISA 细分为 **餐厅（Restaurants）** 与 **Grocery Stores（杂货店）**。
   * **骑手（Couriers）：** 记录交通工具类型、车牌号及工作状态。

2. **菜单项（Menu Items）：** 
   每个卖家维护商品目录。每个菜单项拥有唯一的 `item id`、名称、价格和可用状态，由且仅由一个卖家提供。

3. **收藏功能（Favorites）：** 
   买家可收藏商家与商品并记录 `saved_time`。
   * **唯一性约束：** 每个买家对同一商家或商品**最多只能收藏一次**，通过数据库唯一键自然控制，无需显式冗余 flag 字段。

4. **下单选项与拼单（Ordering Options & Group Orders）：** 
   所有订单统一建模为 **ORDERS 实体**，通过完全且不相交的 ISA 细分为 **SOLO ORDERS（个人单）** 与 **GROUP ORDERS（拼单）**。
   * 统一定义订单基础属性（ID、`created_at` 创建时间、状态、履约方式），另记录 `placed_at`（提交时间）、`completion_due_at`（预计完成时间）、`completed_at`（实际完成时间），由买家通过 `places` 关系向卖家下单。
   * 拼单的 `group_status` 只按截止时间派生为 open／locked；订单为 Pending 且未截止时可加入和改菜，提交后停止修改。订单进度由继承的 `order_status` 记录。其他买家通过 `participates` 加入。

5. **订单明细（Order Items）：** 
   建模为**独立实体**。记录购买数量与单价快照。其唯一标识由组合键 **[所属订单 + 添加买家 + 菜单项]** 决定，完美支持多人拼单时不同成员独立添加相同菜品而不冲突。

6. **优惠券（最终采纳方案 B）：** 
   * **选择理由：** 采用方案 B（强实体设计，拥有全局唯一 `coupon_id` 并外键关联买家）。因为优惠券作为平台或商家派发的促销资产，具备独立生命周期，避免了若采用弱实体导致的平台公共优惠券数据严重冗余。
   * 包含优惠券码、折扣面值、满减门槛、有效期，结账时每个订单最多使用一张。

7. **配送服务（Deliveries）：** 
   管理配送指派与追踪。每条配送记录拥有唯一的 `delivery id`、状态及时间戳，由且仅由一名骑手负责，并对应一个需要配送的订单。
