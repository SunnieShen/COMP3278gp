# COMP3278gp

## Task Allocation

| Task | Description | Assigned To |
|---|---|---|
| ER Diagram | Identify entities, attributes, and relationships. | Cheng Hengqi |
| Relational Schema | Define tables, keys, and constraints. | Shen Hongshan |
| Database Implementation | Set up MySQL, tables, and sample data. | Gong Jianxiang |
| Frontend, Code Review & README | Build the frontend, review code, and document setup. | Zhen Qi |
| Backend & Integration | Implement SQL and connect the frontend to MySQL. | Yang Ruizhen |

## System Features & CRUD Mapping

为了满足项目对 **CRUD（增删改查）** 的核心要求，我们设计了以下业务场景与数据库表操作的映射关系：

| 业务场景 (Feature) | 触发角色 | CRUD 类型 | 涉及数据表 (Tables) |
| :--- | :--- | :--- | :--- |
| **注册 / 添加送货地址** | 顾客 (Customer) | **Create** | `Users`, `User_Addresses` |
| **浏览餐厅菜单 / 搜索菜品** | 顾客 (Customer) | **Read** | `Restaurants`, `Dishes` |
| **提交订单（包含多件菜品）** | 顾客 (Customer) | **Create** | `Orders`, `Order_Items` |
| **修改菜品状态 / 价格** | 商家 (Merchant) | **Update** | `Dishes` |
| **更新订单配送状态** | 商家 / 骑手 | **Update** | `Orders` |
| **取消未制作的订单** | 顾客 / 商家 | **Delete / Update** | `Orders` *(软删除或物理删除)* |
| **提交订单评价** | 顾客 (Customer) | **Create** | `Reviews` |
| **删除 / 撤回评语** | 顾客 (Customer) | **Delete** | `Reviews` |


