# COMP3278gp

[English](README.md) | **简体中文**

**Group Eats（拼单外卖）** — COMP3278 final project.

买家可以下个人订单，也可以发起或加入拼单，各自添加商品。数据库设计还涵盖商家、骑手、地址、收藏、评分、优惠券和配送。

## Frontend Preview

已加入 Foodpanda 风格的本地 mock 前端，支持商家浏览、菜单、购物篮、收藏及拼单演示。运行：

```bash
python3 -m http.server 5173 --directory frontend --bind 127.0.0.1
```

打开 http://127.0.0.1:5173 。前端使用浏览器本地模拟数据，尚未连接 MySQL；演示登录、好友加入和下单不产生真实交易。详见 [前端运行说明及接口交接](frontend/README.zh-CN.md)。

## Task Allocation

| Task | Description | Assigned To |
|---|---|---|
| ER Diagram | Identify entities, attributes, and relationships. | Cheng Hengqi |
| Relational Schema | Define tables, keys, and constraints. | Shen Hongshan |
| Database Implementation | Set up MySQL, tables, and sample data. | Gong Jianxiang |
| Frontend, Code Review & README | Build the frontend, review code, and document setup. | Zhen Qi |
| Backend & Integration | Implement SQL and connect the frontend to MySQL. | Yang Ruizhen |

## Current Design & Progress

当前 README 以 [ER03 图](ER/ER03.png)、[可编辑文件](ER/ER03.drawio) 和 [关系模式及建表脚本](db/schema.sql) 为依据，替代旧的六张表方案。

![Current ER diagram](ER/ER03.png)

- 已有 ER 图、业务说明和 `db/schema.sql`；建表脚本的存在不代表已经成功导入和验证。
- 当前数据库设计为 **18 张表、2 个视图**。实际网站功能仍需实现、整合和测试。
- 已有 `frontend/` mock 页面；`db/seed.sql`、真实后端、数据库连接和相关配置示例尚待补齐。
- `ER_Diagram_Details*.md` 保留了多版说明；出现冲突时，应与 ER03 和建表脚本核对后统一。

## Database Design

### Tables

PK = 主键，FK = 外键，UK = 唯一键。

| Table | Main fields / keys | Purpose |
|---|---|---|
| `users` | `user_id` PK, `username`, `email` UK, `phone_number`, `password_hash` | 账户基础信息 |
| `buyers` | `user_id` PK/FK → users | 买家角色 |
| `sellers` | `user_id` PK/FK → users | 商家角色 |
| `couriers` | `user_id` PK/FK → users, `vehicle_type`, `license_plate_number`, `availability_status` | 骑手角色 |
| `restaurants` | `user_id` PK/FK → sellers, `cuisine_type`, `active_status` | 餐厅子类 |
| `grocery_stores` | `user_id` PK/FK → sellers, `store_category` | 杂货店子类 |
| `addresses` | `address_id` PK, `buyer_user_id` FK, `address_line`, `label` | 买家保存的地址 |
| `menu_items` | `item_id` PK, `seller_user_id` FK, `item_name`, `price`, `availability_status` | 商家提供的商品 |
| `coupons` | `coupon_id` PK, `buyer_user_id` FK, `coupon_code`, `discount_value`, `minimum_spend_threshold`, `expiry_date` | 买家拥有的优惠券 |
| `orders` | `order_id` PK, `buyer_user_id` FK, `seller_user_id` FK, `coupon_id` UK/FK, `order_timestamp`, `order_status`, `fulfillment_type` | 订单公共信息 |
| `solo_orders` | `order_id` PK/FK → orders | 个人订单子类 |
| `group_orders` | `order_id` PK/FK → orders, `deadline` | 拼单子类 |
| `group_order_participants` | (`order_id`, `buyer_user_id`) composite PK/FKs | 买家参与拼单的多对多关系 |
| `order_items` | (`order_id`, `user_id`, `item_id`) composite PK/FKs, `quantity`, `unit_price_snapshot` | 每位买家添加的商品及价格快照 |
| `favorite_sellers` | (`buyer_user_id`, `seller_user_id`) composite PK/FKs, `saved_time` | 商家收藏，禁止重复 |
| `favorite_items` | (`buyer_user_id`, `item_id`) composite PK/FKs, `saved_time` | 商品收藏，禁止重复 |
| `seller_ratings` | (`buyer_user_id`, `seller_user_id`) composite PK/FKs, `score` | 每位买家对每个商家的评分 |
| `deliveries` | `delivery_id` PK, `order_id` UK/FK, `courier_user_id` FK, `delivery_status`, `delivery_timestamp`, `shipping_fee` | 配送记录及运费 |

### ER Rules & Implementation Notes

- **ISA（total, disjoint）**：每个用户恰为买家、商家、骑手之一；每个商家恰为餐厅、杂货店之一；每个订单恰为个人单、拼单之一。采用独立子类表；当前外键本身不能保证完全且互斥，仍需应用逻辑或触发器维护。
- **订单归属**：每个订单由一位买家发起、对应一个商家；拼单另用参与表连接多位买家，发起人也必须加入参与表。
- **订单明细**：由订单、买家、商品三个编号联合标识，保存 `unit_price_snapshot`，避免菜单改价影响历史金额。后端仍需检查添加者资格，以及商品是否属于订单商家。
- **拼单状态**：`group_order_status_view` 按截止时间派生 `open` / `locked`；完成或取消等业务状态使用 `orders.order_status`。后端需要阻止截止后的成员和明细修改。提前锁定目前未实现，不能只靠该视图支持。
- **优惠券**：每张券归属一位买家；订单最多使用一张，`orders.coupon_id` 唯一约束限制同一券最多关联一个订单。有效期、满减门槛和使用人需由后端校验。
- **配送**：每条配送记录关联一个订单和一个骑手；订单最多一条配送记录。仅配送订单需要记录，自取订单没有配送记录，此条件仍需业务逻辑维护。
- **评分**：`seller_rating_view` 计算商家平均分，不在商家表重复保存。分数范围为 1–5。
- **删除**：当前外键没有配置级联删除，不能假设删除订单会自动清理明细。应明确采用事务按顺序删除关联记录，或经讨论后修改外键规则。
- **待明确的规则**：当前地址表没有与订单直接关联；订单收货地址如何选择和保存，以及优惠券如何影响拼单分摊，需在相关功能实现前确定。

## Planned Features & CRUD Mapping

以下是设计支持的功能方向，不代表已实现；实际必做范围需由小组确认。

| Feature | CRUD | Main tables |
|---|---|---|
| 注册 / 登录 | Create / Read | users, buyers / sellers / couriers |
| 浏览商家和商品、搜索筛选 | Read | users, sellers, restaurants, grocery_stores, menu_items |
| 创建个人订单 / 拼单 | Create | orders, solo_orders / group_orders |
| 修改 / 取消订单 | Update; Delete if required | orders, group_orders and related records |
| 加入 / 退出拼单 | Create / Delete | group_order_participants |
| 添加商品 / 改数量 / 移除商品 | Create / Update / Delete | order_items |
| 查看成员商品金额及运费分摊 | Read | order_items, group_order_participants, deliveries |
| 收藏 / 取消收藏 | Create / Read / Delete | favorite_sellers, favorite_items |
| 管理商品价格和可用状态 | Update | menu_items |
| 地址、评分、优惠券、配送管理 | To be scoped | addresses, seller_ratings, coupons, deliveries |

金额计算使用 `SUM(quantity * unit_price_snapshot)`。配送费来自 `deliveries.shipping_fee`，自取订单没有配送费。按参与人数分摊时还需明确分币舍入和优惠券规则；当前没有完整结算实现。

### Representative SQL

```sql
-- 拼单中每位买家的商品金额（不含运费及优惠券），包含尚未加菜的成员。
SELECT p.order_id, u.user_id, u.username,
       COALESCE(SUM(i.quantity * i.unit_price_snapshot), 0) AS item_subtotal
FROM group_order_participants p
JOIN users u ON u.user_id = p.buyer_user_id
LEFT JOIN order_items i
  ON i.order_id = p.order_id AND i.user_id = p.buyer_user_id
WHERE p.order_id = 1
GROUP BY p.order_id, u.user_id, u.username;

-- 读取按截止时间计算的拼单状态。
SELECT order_id, deadline, group_status
FROM group_order_status_view;
```

以上 SQL 按当前字段编写，尚未在本项目数据库中运行验证。

## Environment & Setup

### Database

要求 MySQL **8.0.16+**，以支持脚本中实际生效的 CHECK 约束。从仓库根目录执行：

```bash
mysql -u root -p -e "CREATE DATABASE group_eats CHARACTER SET utf8mb4;"
mysql -u root -p group_eats < db/schema.sql
```

`schema.sql` 不是可重复执行的重置脚本，应首次在空库运行。`db/seed.sql` 尚未提供，演示数据准备好后再补充导入命令。上述命令为预期操作步骤，尚未完成本地导入验证。

### Application — Pending

- 前端采用 HTML/CSS/JavaScript modules，无需构建；后端技术栈和依赖文件待补齐。
- 提供 `.env.example`，说明本机数据库地址、端口、库名和账号配置。
- 补齐依赖安装、应用启动、访问地址和演示账号。
- 由另一位成员按 README 从空库完整复现后，再标记为可运行。

前端可以先用 mock data 实现页面及交互，并与后端约定字段、接口和错误格式；接入真实数据库后再做完整验证。

## Repository Structure

```text
ER/                         ER 图与可编辑 draw.io 文件
ER_Diagram_Details*.md       多版业务设计说明
Instruction/                课程要求与参考资料
db/schema.sql               当前 18 张表、2 个视图的建表脚本
README.md                   分工、当前设计及实现状态
```

`frontend/` 已提供前端源码、模拟数据、独立数据访问模块和本地食物图片。待补充：数据库示例数据、真实后端、相关依赖及配置，并验证端到端数据库流程。
