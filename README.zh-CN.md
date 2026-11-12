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

- 已有 ER 图、业务说明、`db/schema.sql` 和可复现导入脚本 `db/setup.sh`
- 当前数据库设计为 **18 张表、2 个视图**。实际网站功能仍需实现、整合和测试。
- 已有 `frontend/` mock 页面和 `db/seed.sql` 测试数据；真实后端、数据库连接和相关配置示例尚待补齐。
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
| `orders` | `order_id` PK, `host_user_id` FK → buyers, `seller_user_id` FK → sellers, `coupon_id` UK/FK, `order_timestamp`, `order_status`, `fulfillment_type` | 订单公共信息；host 是下单发起人 |
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
- **订单归属**：`orders.host_user_id` 记录唯一的下单发起人（团长），`seller_user_id` 记录商家。拼单通过参与表关联多位买家，且团长也必须加入参与表。`group_order_participants.buyer_user_id` 表示所有参与者，不是订单的第二个归属字段。
- **订单明细**：由订单、买家、商品三个编号联合标识，保存 `unit_price_snapshot`，避免菜单改价影响历史金额。后端仍需检查添加者资格，以及商品是否属于订单商家。
- **拼单状态**：`group_order_status_view` 按截止时间派生 `open` / `locked`；完成或取消等业务状态使用 `orders.order_status`。后端需要阻止截止后的成员和明细修改。提前锁定目前未实现，不能只靠该视图支持。
- **优惠券**：每张券归属一位买家；订单最多使用一张，`orders.coupon_id` 唯一约束限制同一券最多关联一个订单。有效期、满减门槛和使用人需由后端校验。
- **配送**：每条配送记录关联一个订单和一个骑手；订单最多一条配送记录。仅配送订单需要记录，自取订单没有配送记录，此条件仍需业务逻辑维护。
- **评分**：`seller_rating_view` 计算商家平均分，不在商家表重复保存。分数范围为 1–5。
- **删除**：当前外键没有配置级联删除，不能假设删除订单会自动清理明细。应明确采用事务按顺序删除关联记录，或经讨论后修改外键规则。
- **待明确的规则**：当前地址表没有与订单直接关联；订单收货地址如何选择和保存，以及优惠券如何影响拼单分摊，需在相关功能实现前确定。

### Design decisions and fixture evidence

设计修订来自仓库外保存的三轮批注讨论（`ER01问题.pdf`、`ER01问题 回应.pdf`、`Foodpanda_ER_02 问题.pdf`、`关于Foodpanda_ER_03的想法.pdf`）。`db/seed.sql` 刻意保持精简：每个设计决策都至少有一行数据，是旧设计无法表达、会丢失或会冗余的反例。衡量标准是**情况覆盖度，不是数据条数**。

| 设计决策 | 讨论出处 | 样例数据证据 | 对应模式对象 |
|---|---|---|---|
| 一个账号恰对应一个角色（total, disjoint ISA） | ER01 红字「必须为 buyer/seller/courier 中的一种」；ER03 想法 §1 | 15 个用户分为 90001–90008 买家、90101–90104 商家、90201–90203 骑手，无交集 | `users` + 三张角色表 |
| 代理主键 `address_id`；买家可有 0..N 个地址 | ER02 问题（不同买家可同地址文本）；ER03 想法 §2 | 90001 有 91001 与 91008；90008 没有地址 | `addresses` PK / FK |
| 收藏不重复，且 M:N 两侧都成立 | ER01「一个买家不能多次收藏同一个商家」；ER03 想法 §3 | 90001 收藏 90101 与 90102；92001 被 90001 与 90002 收藏 | 两张收藏表的复合主键 |
| `rating` 为派生属性，底层是 RATE M:N 关系 | ER01 回应 ① 蓝色 `buyer — rate — seller` 草图，划掉两个旧 `rating` 椭圆 | 7 个评分 → 4.1667 / 4.25 / 3.75；90104 经 LEFT JOIN 得 NULL | `seller_ratings`、`seller_rating_view` |
| ORDER_ITEM 为 ID-dependent 弱实体，三段式标识键 | ER01 回应中 ADDS / CONTAINS / SELECTS 的绿色双线 | 94002 与 94005 中，92001 由两位不同买家各自添加 | `order_items` 复合主键 |
| `group_status` 由截止时间派生，`completed` 归入 `order_status` | ER01 回应「group_status 作为 derived attribute from deadline」 | 2099 / 2000 两个截止时间；94009 已 `locked` 但仍是 `Pending` | `group_order_status_view` |
| `shipping_fee` 挂在 DELIVERY；HAS_DELIVERY 为 1:1 且部分参与 | ER01 回应 DELIVERY 旁绿色「shipping_fee?」圈注 | 6 个配送单各有一条配送；3 个自取单没有 | `deliveries.order_id UNIQUE` |
| 优惠券是每位买家的一次性券（APPLIES 1:1） | ER01 回应「really?」质疑券复用；ER03 想法 §5 方案 B | 4 张券各用一次、93004 过期未用、5 个订单 `coupon_id` 为 NULL | `orders.coupon_id UNIQUE`、`coupons.buyer_user_id` |
| ORDERS 作为个人单 / 拼单的父类 | ER02 问题「shared features」与手绘 ISA 草图；ER03 想法 §4 | 9 个订单 = 3 个人单 + 6 拼单，共用 host、商家、状态字段 | `orders` + 两张子类表 |
| 价格快照不受菜单改价影响 | ER02 问题 `unit price snapshot` | 94001 / 92003 保存 16.50，而当前价为 18.50 | `order_items.unit_price_snapshot` |
| 参与约束的「0」侧真实存在 | ER01「一个骑手可接 0 或 ≥1 单」「新卖家尚未列出菜单项」 | 90203 无配送；90104 无商品、无评分 | 角色表、视图中的 `LEFT JOIN` |

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
WHERE p.order_id = 94002
GROUP BY p.order_id, u.user_id, u.username;

-- 读取按截止时间计算的拼单状态。
SELECT order_id, deadline, group_status
FROM group_order_status_view;
```

导入 `db/seed.sql` 后，第一条查询应返回 `90001 = 68.00`、`90002 = 112.00`（合计 `180.00`）；第二条返回 3 个 `open` 和 3 个 `locked` 拼单。以上 SQL 按当前字段编写，尚未在本项目环境中连接真实 MySQL 实例运行验证。

## Environment & Setup

### Database

要求 MySQL **8.0.16+**，以支持脚本中实际生效的 CHECK 约束。从仓库根目录运行以下命令；脚本会创建数据库（如尚不存在），导入 `db/schema.sql`，并提示输入 MySQL 密码：

```bash
bash db/setup.sh
```

可通过环境变量指定连接信息和目标库，例如：

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_DATABASE=group_eats bash db/setup.sh
```

目标数据库必须是新建的空库；`schema.sql` 不是重置脚本，在已建表的库上重复运行会报错。需要重新验证时，请改用一个新的 `MYSQL_DATABASE`。上述建表命令已在本机 MySQL 数据库成功运行。

若数据库已由旧版 schema 建立，重新导入新版测试数据前需执行一次列名迁移：

```bash
mysql -u root -p group_eats < db/migrations/001_rename_order_buyer_to_host.sql
```

该迁移会将 `orders.buyer_user_id` 改名为 `orders.host_user_id`，保留已有数据和外键。

#### 测试数据

建表完成后，运行以下命令导入测试数据：

```bash
bash db/seed.sh
```

脚本会将 131 条相互关联的测试记录从 `db/seed.sql` 导入选定数据库，并提示输入 MySQL 密码。数据覆盖多个买家和商家、在售及停售商品、已使用及过期优惠券、个人单和不同截止状态的拼单、多种订单状态、配送和自取、评分、收藏及不同配送进度。在拼单 `94002` 和 `94005` 中，不同买家都添加了同一个菜品，体现同一拼单中多人可选择相同菜品的情况。边界情况还包括：有 2 个地址的买家与 0 个地址的买家、无商品且无评分的商家、无配送记录的骑手、收藏关系 M:N 的两个方向，以及与当前价不同的历史价格快照。各情况支撑哪项设计决策见 [Design decisions and fixture evidence](#design-decisions-and-fixture-evidence)；这批数据是覆盖清单，不追求条数。数据使用专用 ID 和 upsert，重复运行会更新同一批测试记录，不会重复新增。可使用与 `db/setup.sh` 相同的 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER` 和 `MYSQL_DATABASE` 环境变量指定连接信息。测试账号的密码哈希是占位值，仅用于数据库测试。

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
db/setup.sh                 创建数据库并导入 schema.sql 的可复现脚本
db/seed.sql                 可重复导入的数据库测试数据
db/seed.sh                  一键导入测试数据
README.md                   分工、当前设计及实现状态
```

`frontend/` 已提供前端源码、模拟数据、独立数据访问模块和本地食物图片。待补充：真实后端、相关依赖及配置，并验证端到端数据库流程。
