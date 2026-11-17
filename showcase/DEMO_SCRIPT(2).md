# Website Showcase Script · 1:54

目标：展示真实网站操作如何改变 MySQL，覆盖 Create、Read、Update、Delete。按评分标准，视频最长 **2 分钟**，计入总共 5 分钟的 presentation。下方七段共 114 秒，留 6 秒给切换与查询刷新。

英文部分可直接念；中文是操作提示，不用念。只录网站演示，不在视频中重复讲 ER 图。

## 录制前

- 打开 `http://127.0.0.1:5000/showcase/live`，使用 1920 × 1080 窗口。
- 主窗口登录 Alice：`alice@gmail.com` / `123456`。
- 无痕窗口提前登录 Bob：`bob@gmail.com` / `123456`。两个普通标签页会共享登录，必须用独立会话。
- 勾选 **Follow order** 和 **Auto steps**，右侧选择 **Follow website**。
- Alice 提前打开 Harbour Cafe 的菜单；Bob 的窗口放在旁边，方便切换。
- 右侧每两秒刷新，高亮和删除提示保留约 30 秒。看到变化后停一下，再做下一步。

## 0 · Setting：交代演示环境｜0:00–0:08

**操作：** 镜头对准整个演示面板，从左到右缓慢扫一遍：左边是网站操作区，中间显示 SQL 语句，右边是数据库的真实查询结果。此时 Alice 已登录并打开 Harbour Cafe 菜单页。

**口播：**

> Before we start, here is our demo setting. On one panel, we put three views side by side: the website on the left, the SQL statements in the middle, and the live database query results on the right. So every action on the website can be checked directly against MySQL. We begin from Alice's point of view, and later we'll switch to another user, Bob, to show how two users share the same group order.

**看哪里：** 先整体看三栏布局，不需要看清具体数据；观众只需知道「左＝操作，中＝SQL，右＝结果」的对照关系。

## 1 · Read：菜单和已有数据｜0:08–0:16

**操作：** Alice 已在 Harbour Cafe 菜单页。右侧显示已有数据；提前将右侧滚到 `menu_items`，让观众看见菜名、价格。

**口播：**

> To begin with, Alice is browsing Harbour Cafe. The menu items and prices you see here are read from MySQL — the SELECT in the middle and the existing records on the right show exactly what was fetched.

**看哪里：** 左侧菜单；右侧 `menu_items` 的 `item_name`、`price`。中间的 Executed SELECT 是真实读取查询。

## 2 · Create：创建拼单并加菜｜0:16–0:36

**操作：** Alice 创建一个 **Delivery** 拼单，截止时间选择 15 分钟后，再加一份 Soy Sauce Chicken Rice。右侧自动跟随新的订单编号。

**口播：**

> Next, let's move on to Create. Still as Alice, she creates a delivery group order and adds chicken rice. As you can see on the right, MySQL stores a Pending order, its deadline, Alice's membership and the delivery record — all written in one transaction. Adding the food then creates a separate order-item row.

**看哪里：** 新 `order_id`；`orders` 为 `Pending`；`group_orders` 有 deadline；成员有 Alice；`order_items` 有鸡饭。建单时四张表写入同一事务；加菜是另一次请求。

## 3 · Create / Read：切换到 Bob 加入并点餐｜0:36–0:56

**操作：** 复制邀请链接，在 Bob 的无痕窗口打开。Bob 点击加入，再加一份 HK Milk Tea。回到 Alice 的演示台，等右侧刷新。

**口播：**

> Now, this order shouldn't stay single-user, so let's switch perspective to Bob. Bob opens the invitation in a separate browser session, joins, and adds a milk tea. Back on the right, the membership table now contains both buyers, and each food row records who ordered it — the same group order, but a different user ID.

**看哪里：** 此步只显示 `group_order_participants`、`order_items`；新增 Bob 的成员记录和奶茶记录。两人使用相同的 `order_id`，但拥有不同的用户编号。

## 4 · Update：修改数量｜0:56–1:14

**操作：** 在 Bob 的窗口将奶茶数量从 1 改成 2，回到 Alice 的演示台。鼠标停在右侧高亮的 quantity。

**口播：**

> Staying with Bob, here comes the Update. He changes his milk tea quantity from one to two. Focus on the highlighted row in the item table: the quantity is updated, while the unit-price snapshot stays at twenty-two Hong Kong dollars.

**看哪里：** 只显示 `order_items`；Bob 的 `quantity` 变为 `2`，黄色高亮；`unit_price_snapshot` 仍为 `22.00`。不用展示没有变化的表。

## 5 · Delete：退出拼单，切回 Alice｜1:14–1:34

**操作：** Bob 点击退出并确认。回到 Alice 的演示台，让观众看清当前结果和红色删除提示。Alice 的鸡饭保留，方便下一步提交。

**口播：**

> Finally for Delete — we switch back to Alice's side to watch it happen. Bob leaves the group. His milk tea and his membership are deleted from MySQL, while Alice's food remains. The red notices mark the removed records; notice they no longer appear in the current query results.

**看哪里：** 成员表只剩 Alice；菜品表只剩鸡饭。红色提示是已删除记录的短暂对照，不是当前数据库中的行。不要把取消订单当成 DELETE 来讲。

## 6 · Update / Read：提交并刷新｜1:34–1:54

**操作：** Alice 点击提交并确认。右侧显示 `Confirmed` 和时间字段后，刷新整个演示页面，确认记录仍然存在。

**口播：**

> To wrap up, Alice submits the remaining order. Its status becomes Confirmed, and the placement and expected completion times are stored. After refreshing the page, the same order is still there — which confirms these changes are persisted in MySQL, not just kept in the session.

**看哪里：** `orders.order_status` 从 `Pending` 变为 `Confirmed`，`placed_at`、`completion_due_at` 有值；刷新后编号和状态保留。配送记录可以仍为 `Assigned`，此时不用声称它已变化或已送达。

## 收尾检查

- 视频导出不超过 **2:00**；建议保留在 **1:50–1:55**。
- 四种操作都能看清：读菜单、创建拼单／加菜、改数量、退出时删除记录。
- 视频中的编号使用本次实际创建的编号，不照抄某个固定编号。
- 中间 **Write SQL example** 是简化说明；**Executed SELECT** 和右侧表格来自实际数据库读取。不要把示例说成完整的后台执行日志。
- 不等待 15–60 分钟自动完成，也不手工修改数据库来加速演示。

评分依据：[Final Project Assessment Criteria](../Instruction/Final%20Project%20Assessment%20Criteria.pdf) 的 B.4（视频展示 CRUD 与数据库操作，25 分）及 Basic Requirements（视频 ≤2 分钟，包含在总共 5 分钟内）。
