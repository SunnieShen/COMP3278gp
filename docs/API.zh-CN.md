# 前后端接口约定 v1

[English](API.md) | **简体中文**

当前已实现买家登录、商家浏览、个人单与拼单、成员及菜品 CRUD、金额汇总、提交取消和模拟完成。保留 ER03 实体，orders 另加三个完成时间字段。本文是前后端共享的行为约定。

## 1. 通用规则

- 接口前缀 `/api/v1`。整合后由同一来源提供网页和 API；静态预览无法提供这些 API，请使用 Flask 启动完整应用。
- 请求使用 `Content-Type: application/json`。成功响应为 `{"data": ...}`；创建返回 201，查询和修改返回 200，成功删除返回 204 且没有响应正文。
- 登录使用 HttpOnly session cookie，不接受浏览器传一个用户编号就算登录。请求携带 cookie。`GET /auth/session` 还返回 `csrf_token`，所有 POST、PUT、PATCH、DELETE（包括登录退出）必须发送 `X-CSRF-Token`，由后端校验。
- 编号是 JavaScript 安全整数范围内的正整数。使用数据库实际编号；不能用 `Date.now()` 生成订单编号，也不能将 mock 编号发送到真实后端。
- API 金额一律是港币整数“分”，例如 `6800` 表示 HK$68.00。后端准确转换 MySQL DECIMAL；不要用浮点除法算账。前端只负责格式化显示。
- 列表为空时返回 `[]`；可选字段没有值时返回 `null`。未知写入字段、非法编号、非整数或非正数量、不合法时间返回 400。
- 后端检查输入、权限和金额；按钮禁用不能替代权限校验。SQL 参数化，多步写入用事务。

统一错误示例（不返回原始 SQL 或密码哈希）：

```json
{"error":{"code":"GROUP_LOCKED","message":"The deadline has passed. Items can no longer be changed."}}
```

| HTTP | 错误代码 |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `INVALID_CREDENTIALS`、`AUTH_REQUIRED` |
| 403 | `BUYER_REQUIRED`、`NOT_A_MEMBER`、`HOST_ONLY`、`HOST_CANNOT_LEAVE`、`CSRF_INVALID` |
| 404 | `NOT_FOUND` |
| 409 | `GROUP_LOCKED`、`ORDER_NOT_EDITABLE`、`ITEM_UNAVAILABLE`、`WRONG_SELLER`、`SELLER_INACTIVE`、`QUANTITY_LIMIT`、`CONCURRENT_UPDATE`、`EMPTY_ORDER`、`INVALID_ORDER` |
| 503 | `DELIVERY_NOT_CONFIGURED` |
| 500 | `INTERNAL_ERROR`，只给通用提示 |

## 2. 编号和字段统一

| 含义 | 数据库 | API／前端 |
|---|---|---|
| 登录买家 | users.user_id + buyers.user_id | session 返回的 `user_id` |
| 商家编号 | sellers.user_id | `seller_user_id` |
| 商家名称 | 通过 sellers 连接 users.username | `username` |
| 发起人 | orders.host_user_id | `host_user_id`，不用旧的 orders.buyer_user_id |
| 成员 | group_order_participants.buyer_user_id | members[].`buyer_user_id` |
| 商品编号 | menu_items.item_id | `item_id` |
| 当前价格 | menu_items.price | `price_cents` |
| 订单明细唯一键 | order_items(order_id,user_id,item_id) | 订单编号 + session 当前用户 + 商品编号 |
| 历史单价 | order_items.unit_price_snapshot | `unit_price_snapshot_cents` |
| 运费 | deliveries.shipping_fee | `shipping_fee_cents` |
| 截止时间派生状态 | group_order_status_view.group_status | `group_status`：`open`／`locked` |
| 订单业务状态 | orders.order_status | `order_status`，与 group_status 分开 |

商家还返回 `kind`（`restaurant`／`grocery`）、`cuisine_type` 或 `store_category`、`active_status`（杂货店为 null）、评分视图提供的 `rating`（允许 null）。商品返回 `item_name`、`availability_status`，与 seed 保持一致：`Available`／`Unavailable`，注意大小写。

商家图片、描述、评论数、优惠和最低消费不是数据库字段；已提交订单另有保存的预计完成时间。可以按真实编号配本地图片，没有就用占位图；不展示没有依据的优惠和费用。没有商品的商家返回空菜单，没有评分则返回 `rating: null`。

## 3. 时间和状态

- API 时间统一返回含香港偏移的 ISO 8601，例如 `2026-11-14T12:30:00+08:00`。拼单列表和详情同时返回 `server_time`，不能只信用户电脑的时钟。
- **每条 MySQL 连接**设置 `time_zone = '+08:00'`。现有 seed 的 DATETIME 按香港时间理解；收到其他明确偏移的时间时，先转换为香港时间再存。拒绝没有时区的时间。
- 新拼单截止时间必须晚于服务器当前时间。截止前 open，到达或超过截止时间 locked。不提供提前锁单接口、按钮或 `locked_at` 字段。
- 新订单使用 `Pending`。第一阶段只有 Pending 且尚未截止的拼单能改；取消写入 `Cancelled`，保留历史记录，并禁止继续加入、退出或改菜。
- 保留 seed 已有的 `Pending`、`Confirmed`、`In Progress`、`Completed`、`Cancelled`。历史订单即使截止时间派生为 open，如果业务状态已完成，也不能修改。
- 详情返回针对当前用户的 `can_edit`、`can_join`、`can_leave`、`can_cancel`、`can_place`。每次写入在事务内重新检查身份、状态、服务器时间，并锁定父订单行，避免加入、加菜和取消相互竞争。
- 当前支持个人单与拼单、金额查询、提交到 Confirmed 及模拟完成；支付、优惠券、送餐地址、商家／骑手页面和收藏尚未实现。

## 4. 接口清单

session、商家和菜单查询公开；所有拼单接口要求买家登录。未营业餐厅允许浏览，但不能新建拼单或增加新菜品记录。

| 方法 | 路径 | 请求／响应 |
|---|---|---|
| GET | `/auth/session` | `{data:{user:null或{user_id,username,role:"buyer"},csrf_token}}` |
| POST | `/auth/login` | `{email,password}`；200 返回相同 session 结构及新 CSRF token |
| POST | `/auth/logout` | 清除 session；204；再次登录前先取得新 session token |
| GET | `/sellers?kind=restaurant&q=noodle` | 商家数组；kind、搜索可选；名称／菜系／分类不区分大小写搜索；默认含两类商家，按编号排序 |
| GET | `/sellers/{seller_user_id}` | 单个商家对象 |
| GET | `/sellers/{seller_user_id}/items` | 按商品编号排序的菜单，包含不可售商品；前端禁止添加不可售商品 |
| GET | `/group-orders?scope=joinable` | `{data:{server_time,orders:[...]}}`；默认 joinable：Pending、未截止、当前用户尚未加入；mine 返回自己参与的拼单和历史 |
| POST | `/group-orders` | `{seller_user_id,deadline,fulfillment_type}`；履约方式为 `Delivery`／`Self-Pickup`；201 返回完整详情 |
| GET | `/group-orders/{order_id}` | 成员看到完整详情；非成员只看预览 `{order_id,seller_user_id,seller_name,host_user_id,deadline,group_status,order_status,member_count,server_time,can_join}` |
| PUT | `/group-orders/{order_id}/members/me` | 空 JSON 请求体；加入，已加入不重复插入；200 完整详情 |
| DELETE | `/group-orders/{order_id}/members/me` | 事务内退出并删除自己的明细；host 不能退出，应取消；204 |
| PUT | `/group-orders/{order_id}/items/{item_id}` | `{quantity}` 设置绝对数量（整数 1–99），新增／更新当前用户的明细；200 完整详情 |
| DELETE | `/group-orders/{order_id}/items/{item_id}` | 删除当前用户明细，已不存在也成功；204 |
| POST | `/group-orders/{order_id}/place` | 空 JSON；host 可在截止前或截止后提交非空 Pending 拼单，状态更新为 Confirmed；重复提交 Confirmed 不重复建单；200 详情 |
| POST | `/group-orders/{order_id}/cancel` | 空 JSON 请求体；仅 host，Pending 且截止前可取消；已取消则重复调用也成功；200 完整详情 |

不存在的订单返回 404。除了加入操作外，写入要求当前用户是成员。对已截止或非 Pending 的拼单，即使目标行已存在或已删除，也拒绝成员／菜品修改；重复取消已取消订单是例外。请求不能指定操作人、host、价格、优惠券、骑手或运费。

创建时在同一事务写 orders、group_orders 和 host 成员记录。新增菜品检查商家和可售状态，价格从数据库读取。调整已有菜品数量时保留价格快照；不可售的已有菜品可减少、删除，不可增加。删除后再添加则按当时价格重新取快照。成员可看全部人的菜品和金额，但只能改自己的。第一阶段不转移 host。

分享链接使用类似 `#/group/94102` 的前端路由，打开后请求预览，再以真实登录账号加入；链接不是身份凭证。204 后重新查询列表或详情；session 过期提示登录，409 后刷新状态。加载失败时显示错误，不偷偷换回 mock data。

## 5. 运费来源、余数和零运费

已有订单用 deliveries.shipping_fee，不用商家 mock 的 fee，也不能从“免运费”宣传标签推断金额。

**新配送拼单**需要确定运费和骑手：现有 schema 的配送记录要求骑手编号，但没有商家运费表。第一阶段本地演示采用服务器配置 `DELIVERY_FEE_CENTS`（默认 `1000`）和 `DEMO_COURIER_USER_ID`；骑手必须是 seed 中 Available 的骑手。在创建拼单的同一事务写入 Assigned 配送记录，把运费保存为快照。配置缺失／错误返回 503 并回滚，买家不能传入这些值。这是演示用的简化派单，不是真实配送系统。配置为 0 是合法免运费，不需改表。

自取不创建配送记录，返回运费 0。已有配送订单缺少配送记录应报错，不能当成免运费。

人数 N 包含 host 和尚未加菜的成员；运费 F 单位为分：

```text
每人基础运费 = F 整除 N
余数 = F 取余 N
普通成员运费 = 基础运费
host 运费 = 基础运费 + 余数
每人总额 = 自己的商品金额 + 自己的运费
```

后端计算所有人的金额，加入退出后重新计算；未截止时金额为暂估。所有人运费之和必须等于原运费。第一阶段不应用优惠券；已有带券订单返回 `coupon_id`、`coupon_applied: false`，明确显示“优惠券前金额”，不能当作最终应付款。

| Seed 订单 | 人数 | 运费（分） | 普通成员 | host |
|---|---:|---:|---:|---:|
| 94101 | 1 | 1000 | — | 1000 |
| 94102 | 3 | 1000 | 333 | 334 |
| 94103 | 4 | 1002 | 250 | 252 |
| 94104（个人单） | 1 | 0 | — | 0 |

现有零运费 seed 是个人单，不是拼单。如需在第一阶段网页验证，可将服务器运费配置为 0 后创建配送拼单，个人单接口见下文。

## 6. 详情返回示例

host 90002 查询 `GET /group-orders/94102` 的完整 JSON 示例见 [英文版第 6 节](API.md#6-example-complete-group-response)。字段相同，不做中英两套接口。关键结果：

| 成员 | 商品金额（分） | 运费（分） | 总额（分） |
|---|---:|---:|---:|
| 90002 Bob（host） | 6800 | 334 | 7134 |
| 90003 Carol | 2200 | 333 | 2533 |
| 90004 David | 6800 | 333 | 7133 |

详情包括 order_id、host_user_id、seller_user_id、seller_name、created_at、deadline、server_time、order_status、group_status、fulfillment_type、coupon_id、currency、coupon_applied、summary_basis、shipping_fee_cents、五个权限字段、members 和 items。currency 为 HKD，summary_basis 为 before_coupons。

members 按 buyer_user_id 排序，含 username、is_host、item_subtotal_cents、shipping_share_cents、total_cents；items 按 user_id、item_id 排序，含 order_id、user_id、item_id、item_name、quantity、unit_price_snapshot_cents、line_total_cents。列表按 order_id 倒序，使用预览字段并增加 is_member、is_host，不包含所有人的菜品。

## 7. 集成说明

使用 API 返回的真实订单编号、整数分和服务器时间。环境准备、演示账号和测试步骤见项目 README；接口改动同步更新中英文版本。

## 提交订单补充

can_place 仅在 host、Pending 且有菜品时为 true。POST /place 锁定父订单，检查成员一致性和配送信息后更新为 Confirmed，不重复创建订单或配送记录。提交后不可编辑；这是订单确认，不是在线付款或真实派单。

## 统一订单历史

GET /orders?type=all|group|individual（默认 all）要求买家登录，只列出自己参与的拼单和自己拥有的个人单，返回 {data:{server_time,orders:[...]}}。列表含 order_type、created_at、状态、商家、履约方式和拼单信息；个人单 deadline/group_status 为 null。GET /orders/{id} 为拼单成员返回带 order_type=group 的详情，为个人单拥有者返回 order_type=individual、items、item_subtotal_cents、shipping_fee_cents、total_cents、coupon_applied=false、summary_basis=before_coupons、can_edit/can_cancel/can_place（Pending 可编辑）。他人的个人单返回404，拼单非成员在此接口返回403，应从拼单邀请接口查看预览。个人单创建与修改见下方接口。

## 个人单操作

POST /orders 请求 {seller_user_id,fulfillment_type}，事务内创建 Pending 订单、solo_orders 子类及可选配送记录。PUT /orders/{id}/items/{item_id} 请求 {quantity}（1–99）；DELETE 同路径移除自己的明细。POST /orders/{id}/place 可立即提交非空 Pending 订单，不需要截止时间；重复 Confirmed 提交不重复建单。POST /orders/{id}/cancel 取消 Pending，可重复调用。仅订单拥有者能读写，否则404。详情提供 can_edit、can_cancel、can_place；提交或取消后不可改。价格快照和服务器运费规则沿用拼单，个人单不创建拼单参与记录。

Deadline 是加入和改菜的时间上限，不是最早提交时间。Host 可在截止前或后提交非空 Pending 拼单。提交使用现有 order_status=Confirmed，立即禁止所有成员和菜品修改；提前提交本身不需要独立锁单字段；模拟完成另增加下文的三个时间字段。提前提交后，纯时间派生的 group_status 仍可能为 open，因此权限必须同时检查 order_status。

## 订单状态与自动完成

- Pending：草稿。个人单可编辑；拼单只有截止前可加入、退出和改菜。非空订单可由个人单拥有者／拼单 host 提交，拼单不必等截止时间。
- Confirmed：已提交，菜品和成员只读。提交事务保存 placed_at，并随机选择 15–60 分钟后的 completion_due_at；重复提交保留原时间。
- Completed：后台到期自动完成，写 completed_at；配送记录同时改为 Delivered，自取没有配送记录。
- Cancelled：提交前取消，保留记录，不进入自动完成。seed 中的 In Progress 是历史状态，本模拟不自动迁移它。

已有数据库先运行 `python -m backend.manage migrate`，它可重复执行，添加三个时间字段和索引，不清空订单和密码。首次 init 已包含新结构。历史 Confirmed 订单没有预计时间时不自动回填或完成；只对新提交、或重新确认并建立计划的订单计时。

`python app.py` 会启动后台检查线程，每 5 秒检查一次，不需要打开网页；服务器停机时暂停，重启后补处理已到期订单。页面每 15 秒刷新，状态显示可能稍晚。预计和实际完成时间保存在数据库，重启不重新抽取。若通过其他 WSGI 服务启动网页，另运行 `python -m backend.completion`。这是课程模拟，不代表真实派送或支付。

本地开发默认自动重载 Python 代码（APP_RELOAD=1），不启用交互式调试器。首次升级仍需重启旧进程。界面里的 Add food before placing 只在确实没有菜品时显示，已加菜却不能提交应检查登录身份、订单状态及后端版本。

订单列表、详情和提交响应增加 placed_at、completion_due_at、completed_at，均为可空的香港 ISO 时间。新草稿为 null，提交后保存计划。这是运行记录字段，不增加实体。
