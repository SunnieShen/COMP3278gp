# Presentation 脚本 v2 · slide × demo 分工版

配套：[`showcase.html`](showcase.html)（排练用）。本文取代 `DEMO_SCRIPT.md` 的讲稿部分——v1 是按"独立 demo"写的，没考虑 slide 已经讲了什么，直接用会大量重复。

---

## 1. 现状诊断

Slide 共 8 页主内容 + 1 页 backup（见 §3.4 附表）。对照后有三类问题：

**重复点（slide 和 v1 demo 都在讲）**

| # | 重复内容 | Slide 位置 | v1 demo 位置 | 处理 |
|---|---|---|---|---|
| A | ER：ISA / M:N / 弱实体 / `unit_price_snapshot` | S2 完整 ER 图 + S9 backup | §3.2 ER 段 43s | demo 整段删，ER 归 slide |
| B | `unit_price_snapshot` 保留历史价 | S3 表格第 4 行 + S4 重复出现 | 镜 4 主口播 | demo 镜 4 改成「印证 slide 声明」，不再是首次介绍 |
| C | CRUD 四类操作清单 | S7 明确列出 C/R/U/D 四条 | 视频 6 镜逐个念 | demo 不念操作名，改连续流程；S7 引入只当目录 |
| D | 26 tests / 162 seed / README | S8 三栏完整呈现 | §3.4 收尾 25s | demo 收尾删，归 S8 |

**缺口（slide 有一页是空的）**

- **S6「04 BACKEND & KEY SQL」整页空白**——只有表头（Table / Key or constraint / Why it matters），一行内容都没有。这是评分项 B.3「关键 SQL 15 分」，空页等于这 15 分白丢。v1 demo 的 SQL 讲稿正好可以搬过去。

**冗余（slide 自身）**

- S4 表格末尾两行（`order_items unit_price_snapshot` / `orders → coupons coupon_id UNIQUE + FK`）与 S3 的第 4、5 行**逐字重复**，是复制粘贴残留。
- S4 标题写 "FOREIGN KEY, ENUM and CHECK constraints"，但表格里没有任何 ENUM 行——schema.sql 里实际有两处 ENUM（`fulfillment_type`、`delivery_status`），标题和内容不符。

---

## 2. 分工原则

一句话：**Slide 讲「设计成什么样」，demo 讲「跑起来确实是这样」。**

Slide 上的每一条设计声明，都应该在 demo 里有一个对应的「运行时证据」。这样两部分不但不重复，还互相扣分点接龙：

| Slide 声明 | Demo 里对应的证据 |
|---|---|
| S2「one order model, two ways to order」 | 视频里一个订单从 solo 流程切到 group 流程 |
| S3「unit_price_snapshot keeps historical prices」 | 镜 4：改数量，快照列不动 |
| S3「backend checks ownership」（页脚） | 镜 5：只删自己的菜（Alice 删 Alice 的） |
| S6「LEFT JOIN + COALESCE → 没点菜也显示 0」 | 镜 3：小计查询真实跑出结果 |
| S6「事务：四表要么全建要么不建」 | 镜 2：四张表同时出现绿色新行 |
| S8「Real CRUD」 | 视频 6 镜全程 |

讲的时候用**回指句**把两边缝起来，例如镜 4 的 "Slide 3 declared this rule; here it is actually holding."。这是承接，不是复读。

---

## 3. Slide 增删建议

### 3.1 必改（直接影响分数）

**S6 填内容**——15 分项，不能空。按现有三列表头填这三行（就是 demo 里会真跑的两条 + 一条设计声明）：

| Table | Key or constraint | Why it matters |
|---|---|---|
| `group_order_participants` | `LEFT JOIN order_items` + `COALESCE(SUM(quantity × unit_price_snapshot), 0)` | Member subtotals — a member with no items still shows 0 |
| `group_order_status_view` | `CASE WHEN deadline > NOW() THEN 'open' ELSE 'locked' END` | Status derived from data — no scheduled job to flip it |
| `orders` | one transaction → `orders` + `group_orders` + `participants` + `deliveries` | Group creation is atomic: all four rows, or none |

S6 讲稿见 §5，视频镜 3 会回指这里。

**S7 的占位符**——"Video to be added · 1:50" 要在展示前替换成真视频（占位符是任务提醒，不是增删建议，但漏了直接没视频分）。

### 3.2 建议改（去冗余，半分钟搞定）

**S4 删表格末尾两行**（`order_items unit_price_snapshot` 和 `orders → coupons`），它们逐字重复 S3。删掉后 S4 聚焦 FK / CHECK / ENUM 本身的实现，S3 讲「是什么约束」，S4 讲「怎么落进 DDL」，正好分层。

**S4 补一行 ENUM 或改标题**。二选一：
- 补一行：`orders` · `fulfillment_type ENUM('Delivery','Self-Pickup')` · "Delivery creates a delivery record; pickup doesn't"（和 S5 的费用拆分正好呼应）
- 或把标题里的 "ENUM" 去掉。

**S7 截图与视频叙事对齐**。截图是 Bob 已登录的 Orders 页，而视频从 Alice 开始。两种处理任选：
- 换成 Alice 视角的截图（如果 Google Slides 能本地改）；
- 或者不改图，讲的时候一句话接住："This is Bob's view — he joins halfway through."（v2 讲稿已按此写，见 §5）

### 3.3 可选（锦上添花）

- S5 柱状图的 Bob / Carol / David 在 seed 里真实存在（已核实 `Carol Lee`、`David Lam`），如果被追问，直接说 "these are seed buyers 90002/90003/90004"。
- S9 backup 页讲稿最后一句主动提一句 "the full 18-table diagram is on the backup slide"，让评分者知道你们准备了大图（v2 S2 讲稿已含此句）。

### 3.4 Slide 清单（当前状态）

| 页 | 标题 | 讲者 | 现状 |
|---|---|---|---|
| S1 | 封面 | Zhen Qi | OK |
| S2 | 01 ER DESIGN | Cheng Hengqi | OK（精简 ER 图） |
| S3 | 02 RELATIONAL SCHEMA | Shen Hongshan | OK |
| S4 | 03 DB IMPL · 约束实现 | Gong Jianxiang | 尾部两行冗余；缺 ENUM 行 |
| S5 | 03 DB IMPL · 费用拆分 | Gong Jianxiang | OK |
| S6 | 04 BACKEND & KEY SQL | Yang Ruizhen | **空白，必须填** |
| S7 | 05 APPLICATION DEMO | Zhen Qi | OK，等视频 |
| S8 | 06 DELIVERY & VERIFICATION | Zhen Qi | OK |
| S9 | BACKUP 完整 ER | Cheng Hengqi | OK |

---

## 4. 5 分钟时间轴（v2）

总长 294 秒 = 4:54，留 6 秒缓冲。视频压到 slide 自己标注的 **1:50**。

| 时间 | 时长 | 谁 | 页 | 内容 |
|---|---|---|---|---|
| 0:00–0:08 | 8s | Zhen Qi | S1 | 封面：一句话定位 |
| 0:08–0:40 | 32s | Cheng Hengqi | S2 | ER |
| 0:40–1:10 | 30s | Shen Hongshan | S3 | 关系模式与约束 |
| 1:10–1:32 | 22s | Gong Jianxiang | S4 | DDL 实现（FK/CHECK/ENUM） |
| 1:32–1:54 | 22s | Gong Jianxiang | S5 | 费用拆分 |
| 1:54–2:34 | 40s | Yang Ruizhen | S6 | 关键 SQL |
| 2:34–2:42 | 8s | Zhen Qi | S7 | 引入视频 |
| 2:42–4:32 | 1:50 | 视频 | S7 | CRUD + 数据库操作 |
| 4:32–4:54 | 22s | Zhen Qi | S8 | 收尾 |

全员发言核查：Cheng 32s / Shen 30s / Gong 44s / Yang 40s / Zhen 30s（live）+ 视频旁白。✅

---

## 5. Slide 逐字稿

### S1 封面 · Zhen Qi · 8s

> We built foodpanda — individual orders and group orders, on one connected MySQL database.

中文要点：不展开，一句话就翻页。

### S2 ER · Cheng Hengqi · 32s

鼠标顺序：`ORDERS` 的 ISA 三角 → `participates` 菱形 → `ORDER_ITEM`。

> One order model, two ways to order. `Orders` is a **total, disjoint** ISA into solo and group orders, so we never duplicate order columns. The many-to-many **participates** goes through `group_order_participants` — one buyer joins one group once. `Order_item` is the weak entity: its key is order, user and item, so each buyer owns exactly one line per menu item. The full 18-table diagram is on the backup slide.

中文要点：ISA / M:N / 弱实体 / 键设计，四个点各一句。最后一句主动指 backup 页。

### S3 模式 · Shen Hongshan · 30s

> Turning relationships into constraints. `group_order_participants` has a **composite primary key**, so a buyer joins a group once. `order_items` is keyed by order, user and item — one line per buyer per item. `unit_price_snapshot` keeps the price the buyer actually agreed to. And `coupon_id` is **UNIQUE**, so one voucher attaches to at most one order.

中文要点：对着表格四行逐行讲，别跳。

### S4 DDL · Gong Jianxiang · 22s

> These constraints are enforced by **MySQL itself**, not just the backend. Composite primary keys stop duplicate joins, foreign keys keep references intact, and CHECK bounds rating scores. This needs MySQL 8.0.16 or later — which is why the README pins that version.

中文要点：强调「数据库层保证」而非应用层；版本号是真实约束来源。

### S5 费用拆分 · Gong Jianxiang · 22s

> Splitting the delivery fee **without losing a cent**. We compute in integer cents — no floating point — so 1,000 cents split three ways gives the host 334, and the others 333 each. The one-cent remainder goes to the host, and pickup orders have no fee at all.

中文要点：数字直接念屏幕上的 334/333/333，不用换算。

### S6 关键 SQL · Yang Ruizhen · 40s

> Two pieces of SQL do the heavy lifting. First, **member subtotals**: `LEFT JOIN` order_items, then `COALESCE` turns the NULL sum into zero — a member who has not ordered anything still shows up, with zero. Second, **group status**: we never store "open" or "locked"; a view derives it from the deadline, so there's no scheduled job to flip it, and the rule lives in exactly one place. You'll see both run in the video.

中文要点：只讲两条 SQL 的**意图**，不念完整语句（表里有摘要，视频里会看到真实执行）。最后一句是给视频的钩子。

### S7 引入视频 · Zhen Qi · 8s

> This is Bob's view — he joins halfway. One workflow; MySQL on the right.

中文要点：解释截图为什么是 Bob（S7 截图是 Bob 的 Orders 页），把叙事错位变成「预告」。

### S8 收尾 · Zhen Qi · 22s

> Built to run, checked end to end. Real CRUD on individual and group ordering, 26 integration tests covering permissions, transactions and deadline boundaries, and a README that takes a marker from an empty database to a running app. Thank you.

中文要点：对齐 S8 的三栏，念完即结束，别拖。

---

## 6. 视频 1:50 分镜（v2，印证式）

总长 110 秒。和 v1 的三点不同：**不念 CRUD 名字**（S7 已列）、**回指 slide**（承接而非重复）、**只讲 slide 上看不到的数据库证据**。旁白 Zhen Qi 3 镜、Yang Ruizhen 3 镜。

| 镜 | 视频时间 | showcase Step | 画面 | 旁白 |
|---|---|---|---|---|
| 1 | 0:00–0:10 | Step 1 | 菜单页 + `menu_items` | Zhen Qi |
| 2 | 0:10–0:32 | Step 2 | 建单 → 四表白屏 | Yang Ruizhen |
| 3 | 0:32–0:54 | Step 3 | Bob 加入 + 小计查询 | Zhen Qi |
| 4 | 0:54–1:14 | Step 4 | 改数量，快照不动 | Yang Ruizhen |
| 5 | 1:14–1:34 | Step 5 | 删菜，行消失 | Zhen Qi |
| 6 | 1:34–1:50 | Step 6 | Pending→Confirmed | Yang Ruizhen |

---

**镜 1 · 0:00–0:10**

> Alice is browsing Harbour Cafe's menu — that's our Read. Watch the right side: every action here lands in MySQL immediately.

中文要点：开场不重复 slide 1 的定位，直接进入画面；「看右边」定下全程视线规则。

---

**镜 2 · 0:10–0:32 · 扣 S6 第 3 行（事务）**

> Creating the group writes **four tables in one transaction**. If any of them failed, none would be created. Four green rows appear at the same time — that's the atomicity you can only see from the database side.

中文要点：S6 只说了「事务」两个字，这里是唯一的运行时证据——四张表**同时**出绿行。鼠标点住 `order_items` 那行新行。

---

**镜 3 · 0:32–0:54 · 扣 S6 第 1 行（小计）**

> Bob joins through the invite link. Now the subtotal query runs: `LEFT JOIN` with `COALESCE` — even a member who ordered nothing shows zero. This is the exact query from the previous slide, now on real data.

中文要点：**必须**说出 "the exact query from the previous slide"，这是 slide 和 demo 缝合的关键句。查询结果留在屏幕上 2 秒再切走。

---

**镜 4 · 0:54–1:14 · 扣 S3 第 4 行（快照）**

> Bob doubles the milk tea. Only `quantity` changes — the snapshot stays at 22 dollars. Slide 3 declared this rule; here you can see it actually holding while the row is being updated in the database.

中文要点：回指 S3。"here you can see it actually holding" 是全片的承接句模板。

---

**镜 5 · 1:14–1:34 · 扣 S3 页脚（ownership）**

> Alice removes her chicken rice. This is a real **DELETE**, not a hidden row — the line turns red, then it's gone. I'll refresh. It does not come back, so the row is really gone from the database.

中文要点：刷新不回来必须拍出来。如果想扣 S3 页脚的 ownership，可以在口播加半句 "Alice can only remove her own item"（时间允许时）。

---

**镜 6 · 1:34–1:50**

> Finally Alice places the group order: Pending becomes **Confirmed**, `placed_at` is written, and the order becomes read-only. Everything you just saw survives a refresh — all of it is persisted in MySQL.

中文要点：收在「持久化」，正好落回评分标准的 "database operations"。

---

### 语速核算（已按词数验证）

| 镜 | 词数 | 秒 | wpm |
|---|---|---|---|
| 1 | 22 | 10 | 132 |
| 2 | 37 | 22 | 101 |
| 3 | 40 | 22 | 109 |
| 4 | 33 | 20 | 99 |
| 5 | 40 | 20 | 120 |
| 6 | 30 | 16 | 113 |

全部在 99–132 词/分，比正常语速慢一档，留出切换画面的停顿。

---

## 7. 录制设置（继承 v1，只列变更）

完整设置看 git 里的 v1 版本（`git log --all -- showcase/DEMO_SCRIPT.md`），此处只列不变点和新增点：

- 分屏、DBeaver auto-refresh、`Cmd+Shift+5`、1080p —— 同 v1
- 重录前按子表→父表顺序 DELETE 残留订单 —— 同 v1
- **新增**：镜 3 的小计查询要**预先跑一次**并截图，如果现场跑慢了就贴截图过渡（不要卡在等待上）
- **新增**：视频旁白两人各录 3 镜，录完拼轨，不要一人代录全部（评分要求全员参与，视频里的声音也算）
- **新增**：口播里出现 "previous slide" / "Slide 3" 的两处回指，录的时候**手上动作要同步**——说到 "the exact query" 时鼠标就停在查询结果上

---

## 8. 检查清单与超时删减

### 检查清单

**环境**
- [ ] 演示机 MySQL 8.0.16+ 在跑，`python app.py` 起得来，`127.0.0.1:5000` 打得开
- [ ] `.env` 的 host / port / database 与**真实在跑**的实例一致（本机临时实例用 33307 / `group_eats_local`，没问题，关键是能连上）
- [ ] README 里 "Kelly's current WSL machine" 那段改成中性表述，否则 marker 照抄连不上
- [ ] Alice / Bob 都能登录（`alice@example.com` / `bob@example.com`，`DemoPass3278!`）
- [ ] Bob 用隐私窗口（独立会话），不是同一窗口的两个标签页

**数据**
- [ ] 上次录制的残留订单已清（子表先删）
- [ ] 常驻两条 `SELECT` 已在客户端写好并跑通
- [ ] 不要在建单前 reseed

**slide 与 demo 对齐**
- [ ] S6 已经填上 §3.1 的三行
- [ ] S4 尾部冗余两行已删
- [ ] S7 占位符已换成真视频
- [ ] 视频 ≤1:50，导出 1080p
- [ ] 5 人按 §4 时间轴走一遍，掐表，每人都有开口

### 超时删减（从后往前）

1. S8 压到 15s（去 tests 那句）→ 省 7s
2. S6 去掉第三条（事务）口头解释，只指表格 → 省 6s
3. S2 去掉最后一句 backup 提示 → 省 4s
4. 视频镜 1 压到 7s → 省 3s

删到 4:50 就停。**不动全员发言**，那是 B.5 的 10 分。
