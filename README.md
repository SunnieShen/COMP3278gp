# COMP3278gp

**Group Eats（拼单外卖）** — COMP3278 final project.

> 同学们围绕一家餐厅**发起拼单**，各自加菜，系统自动算出**每人应付**（含配送费分摊）。
> 与常见外卖系统的区别：订单不再属于单一顾客，而是属于一组人（M:N）——这是本系统数据模型的核心设计维度。

[ER_draw.io] (https://drive.google.com/file/d/1b7vayr8sRvNcRWX1jdi7jlw_3vsMw5-Z/view?usp=sharing)

## Task Allocation

| Task                           | Description                                          | Assigned To    |
| ------------------------------ | ---------------------------------------------------- | -------------- |
| ER Diagram                     | Identify entities, attributes, and relationships.    | Cheng Hengqi   |
| Relational Schema              | Define tables, keys, and constraints.                | Shen Hongshan  |
| Database Implementation        | Set up MySQL, tables, and sample data.               | Gong Jianxiang |
| Frontend, Code Review & README | Build the frontend, review code, and document setup. | Zhen Qi        |
| Backend & Integration          | Implement SQL and connect the frontend to MySQL.     | Yang Ruizhen   |

## System Features & CRUD Mapping

为了满足项目对 **CRUD（增删改查）** 的核心要求，我们设计了以下业务场景与数据库表操作的映射关系：

| 业务场景 (Feature)                     | 触发角色            | CRUD 类型                    | 涉及数据表 (Tables)                              |
| :--------------------------------- | :--------------- | :------------------------- | :------------------------------------------- |
| **注册 / 登录**                      | 用户 (User)       | **Create / Read**          | `users`                                      |
| **浏览餐厅菜单 / 搜索排序**              | 用户 (User)       | **Read**                   | `restaurants`, `menu_items`                  |
| **发起拼单（选餐厅 / 设截止时间）**         | 用户 → 发起人 (Host) | **Create**                 | `group_orders`                               |
| **修改拼单信息 / 取消拼单**               | 发起人 (Host)      | **Update / Delete**        | `group_orders` *(级联清理成员与明细)*                |
| **加入 / 退出拼单**                    | 用户 → 成员 (Member) | **Create / Delete**        | `order_members` *(M:N 关联表)*                  |
| **加菜 / 改数量 / 移除菜品（锁定后禁止）**      | 成员 (Member)     | **Create / Update / Delete** | `order_items` *(unit_price 价格快照)*            |
| **锁定拼单 / 标记完成**                  | 发起人 (Host)      | **Update**                 | `group_orders` *(status: open → locked → completed)* |
| **查看每人应付明细（分摊配送费）**             | 成员 (Member)     | **Read** *(派生查询)*          | `order_items`, `group_orders`, `order_members` |
| **营收统计（按日 / 按菜品）**               | 商家 (Merchant)   | **Read** *(派生查询)*          | `order_items`, `group_orders`, `menu_items`   |
| **菜品销量分析（好卖 / 滞销榜）**             | 商家 (Merchant)   | **Read**                   | `order_items`, `menu_items`                  |
| **手动调价 / 下架菜品**                  | 商家 (Merchant)   | **Update / Delete**        | `menu_items` *(price / is_available)*        |

**角色说明**：不设独立商家账号体系——商家即拥有某餐厅的普通登录用户（`restaurants.owner_id`），权限判据为 `当前登录用户 == owner_id`。

**明确不做（Out of scope）**：自动调价 / 自动下架（需触发器或定时任务）、支付、第三方登录、图片上传、骑手端。

## Database Design

### 核心表结构（六张）

| 表                | 字段（要点）                                                        | 说明                          |
| ---------------- | -------------------------------------------------------------- | --------------------------- |
| `users`          | id PK, name, email **UK**, password_hash, created_at           | 密码存哈希，不存明文                   |
| `restaurants`    | id PK, **owner_id FK→users**, name, **store_type**, cuisine, rating, delivery_fee | store_type 见下方 ISA 设计        |
| `menu_items`     | id PK, restaurant_id FK, name, price **CHECK ≥ 0**, is_available | 下架 = is_available 置 0        |
| `group_orders`   | id PK, host_id FK, restaurant_id FK, status, deadline, created_at | 状态机：open → locked → completed / cancelled |
| `order_members`  | (group_order_id, user_id) **复合主键**, joined_at                  | users ⇄ group_orders 的 **M:N** 落地 |
| `order_items`    | id PK, group_order_id FK, user_id FK, menu_item_id FK, quantity **CHECK > 0**, unit_price | **unit_price 为下单时价格快照**      |

约束：`UNIQUE(group_order_id, user_id)`（防重复加入）；全部外键建立；`status = 'locked'` 后禁止增删改明细。

### ER 设计要点

1. **M:N 关联表 `order_members`**——一次拼单属于多个人；教程示例中订单只属于一人，这是本设计的核心差异。
2. **价格快照**——`order_items.unit_price` 存下单时价格，而非 `JOIN menu_items.price`：菜单会调价，历史订单金额不能变。
3. **派生值不存表**——每人应付 = `SUM(unit_price × quantity)` + 配送费 ÷ 人数，实时查询计算。
4. **ISA 特化（total, disjoint）**——store 特化为 food / grocery，用 `store_type ENUM + CHECK` 落表（单表方案）；两个子类特有属性差异小，故不拆两张表。
5. **状态机**——锁定后禁止改动，由一列 `status` + `WHERE status = 'open'` 条件实现，无需新表。

### 代表性 SQL

```sql
-- 每人应付（含配送费均摊）—— 派生查询，不存表
SELECT u.name,
       SUM(oi.unit_price * oi.quantity) AS food_cost,
       SUM(oi.unit_price * oi.quantity)
         + r.delivery_fee
           / (SELECT COUNT(*) FROM order_members om WHERE om.group_order_id = go.id) AS amount_due
FROM group_orders go
JOIN restaurants r  ON r.id = go.restaurant_id
JOIN order_items oi ON oi.group_order_id = go.id
JOIN users u        ON u.id = oi.user_id
WHERE go.id = 1
GROUP BY u.id, u.name;

-- 商家营收（按日，仅已完成订单）
SELECT DATE(go.created_at) AS day, SUM(oi.unit_price * oi.quantity) AS revenue
FROM order_items oi
JOIN group_orders go ON go.id = oi.group_order_id
WHERE go.restaurant_id = 1 AND go.status = 'completed'
GROUP BY DATE(go.created_at);

-- 菜品销量榜（好卖 / 滞销分析）
SELECT mi.name, SUM(oi.quantity) AS sold
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE mi.restaurant_id = 1
GROUP BY mi.id, mi.name
ORDER BY sold DESC;
```

## Environment & Setup 【待代码完成后填写】

> 本节对应评分 **Submission Materials and Reproducibility（30 分）**，填写后需由一名非编写者从空数据库完整复现一遍。

### 1. Requirements
- MySQL 8.x（本机运行即可，无需云部署）
- 【待填：技术栈与版本】

### 2. Database setup
```bash
mysql -u root -p -e "CREATE DATABASE group_eats CHARACTER SET utf8mb4;"
mysql -u root -p group_eats < db/schema.sql
mysql -u root -p group_eats < db/seed.sql
```

### 3. Configuration
复制 `.env.example` 为 `.env`，填入本机 MySQL 的地址、端口、库名、账号、密码。

### 4. Run
【待填：依赖安装与启动命令、访问地址】

### 5. Demo accounts
【待填：seed 数据中的演示账号，至少包含普通用户与某餐厅 owner】

## Repository Structure（规划）

```
├── app.py / server        应用入口
├── db/
│   ├── schema.sql         建表脚本（含约束）
│   └── seed.sql           演示数据
├── queries.sql            关键查询 + 注释（答辩讲解用）
├── .env.example           连接配置模板
├── requirements.txt       依赖清单
└── README.md
```
