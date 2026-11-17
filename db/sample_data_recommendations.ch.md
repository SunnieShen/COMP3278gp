# ER03 特殊情况与 Sample Data 补充建议

本文整理三项建议及对应的 sample data。第 2、3 节的数据已加入 `db/seed.sql`；第 1 节的提前锁定功能不受支持，也未加入 seed。

示例使用现有测试买家、商家和骑手 ID，并使用新的订单 ID（`94101` 起）和配送 ID（`95101` 起）。导入前应确认目标数据库中已有这些关联的基础测试记录。

## 1. 团购提前锁定

### 当前实现

目前 `group_orders` 仅保存 `deadline`；`group_order_status_view` 根据截止时间推导状态：

- `NOW() < deadline`：`open`
- `NOW() >= deadline`：`locked`

现有样例已覆盖未来截止时间和过去截止时间。它没有表示“截止时间尚未到，但主持人主动结束组团”的数据。

### 如果决定支持提前锁定

需要同步修改数据库结构、视图、应用逻辑和测试，而不只是增加一条 sample data：

1. 在 `group_orders` 增加可空的 `locked_at DATETIME`。`NULL` 表示没有提前锁定；非 `NULL` 记录主持人实际执行锁定的时间。
2. 修改状态视图：如果 `locked_at` 有值，或截止时间已到，则状态为 `locked`；否则为 `open`。
3. 应用逻辑需在锁定后拒绝新增或修改团购参与者和订单商品。
4. 增加测试，分别验证提前锁定、截止时间自动锁定，以及锁定后禁止修改。

例如，状态计算可以采用：

```sql
CASE
    WHEN locked_at IS NOT NULL OR deadline <= NOW() THEN 'locked'
    ELSE 'open'
END
```

如果保留提前锁定功能，可用以下数据展示“截止时间仍在未来，但已经提前锁定”：

```sql
-- 前提：group_orders 已增加 locked_at 列。
-- 先建立订单，再建立团购和参与者，以满足外键及主持人参与规则。
INSERT INTO orders
    (order_id, host_user_id, seller_user_id, coupon_id,
     created_at, order_status, fulfillment_type)
VALUES
    (94190, 90001, 90101, NULL,
     '2026-01-01 09:00:00', 'Pending', 'Self-Pickup');

INSERT INTO group_orders (order_id, deadline, locked_at)
VALUES (94190, '2099-12-31 23:59:59', '2026-01-01 10:00:00');

INSERT INTO group_order_participants (order_id, buyer_user_id)
VALUES (94190, 90001);
```

预期：`deadline` 尚未到，但 `locked_at` 非空，因此状态为 `locked`。现有 `94002` 一类未来截止且未设置 `locked_at` 的团购仍为 `open`；现有 `94003` 一类过去截止且 `locked_at` 为空的团购仍为 `locked`。

### 建议

ER03 对提前锁定的描述是可选项。若项目不准备实现 `locked_at`、状态视图更新、锁定后禁止修改等完整行为，建议从 ER03 删除“主持人提前锁定”的说明，明确本项目只按 `deadline` 自动推导状态。这样 ER 图、数据库和应用行为保持一致，也避免只画了功能却没有实现。

## 2. 团购人数边界与运费分摊

以下三组数据覆盖一人、三人和四人的情况，并展示运费无法平均分到整分时，将余数计入主持人账单；这些记录现已并入 `db/seed.sql`。

```sql
INSERT INTO orders
    (order_id, host_user_id, seller_user_id, coupon_id,
     created_at, order_status, fulfillment_type)
VALUES
    (94101, 90001, 90101, NULL, '2026-11-12 12:00:00', 'Pending', 'Delivery'),
    (94102, 90002, 90101, NULL, '2026-11-12 12:05:00', 'Pending', 'Delivery'),
    (94103, 90005, 90101, NULL, '2026-11-12 12:10:00', 'Pending', 'Delivery');

INSERT INTO group_orders (order_id, deadline)
VALUES
    (94101, '2099-12-31 23:59:59'),
    (94102, '2099-12-31 23:59:59'),
    (94103, '2099-12-31 23:59:59');

-- 每个团购的主持人也列为参与者。
INSERT INTO group_order_participants (order_id, buyer_user_id)
VALUES
    (94101, 90001),
    (94102, 90002),
    (94102, 90003),
    (94102, 90004),
    (94103, 90005),
    (94103, 90006),
    (94103, 90007),
    (94103, 90008);

-- 为每个订单提供商品明细；团购商品由该团的参与者添加。
INSERT INTO order_items
    (order_id, user_id, item_id, quantity, unit_price_snapshot)
VALUES
    (94101, 90001, 92001, 1, 68.00),
    (94102, 90002, 92001, 1, 68.00),
    (94102, 90003, 92002, 1, 22.00),
    (94102, 90004, 92001, 1, 68.00),
    (94103, 90005, 92001, 1, 68.00),
    (94103, 90006, 92002, 1, 22.00),
    (94103, 90007, 92008, 1, 12.00),
    (94103, 90008, 92001, 1, 68.00);

INSERT INTO deliveries
    (delivery_id, order_id, courier_user_id, delivery_status,
     delivery_timestamp, shipping_fee)
VALUES
    (95101, 94101, 90201, 'Assigned', '2026-11-12 12:15:00', 10.00),
    (95102, 94102, 90202, 'Assigned', '2026-11-12 12:20:00', 10.00),
    (95103, 94103, 90201, 'Assigned', '2026-11-12 12:25:00', 10.02);
```

按“先将运费均分到整分，再把余数加到主持人账单”的规则，配送费分摊如下。金额仅包含运费，尚未加上各参与者自己的商品金额：

| 订单 | 参与人数 | 运费 | 非主持人每人承担 | 主持人承担 | 说明 |
|---|---:|---:|---:|---:|---|
| `94101` | 1 | `$10.00` | — | `$10.00` | 只有主持人参与，主持人承担全部运费 |
| `94102` | 3 | `$10.00` | `$3.33` | `$3.34` | 均分后剩 `$0.01`，加到主持人账单 |
| `94103` | 4 | `$10.02` | `$2.50` | `$2.52` | 均分后剩 `$0.02`，加到主持人账单 |

也就是说，先用“运费总额（分）整除人数”作为每人的基础运费，余数全部由主持人承担。应用端应使用整数分进行计算，避免浮点误差。

## 3. 零运费配送

数据库允许配送费为零（约束为 `shipping_fee >= 0`）。样例中已增加一笔**免运费配送**，验证零值是合法费用，而不是被应用误判为缺失值或无效值。

```sql
INSERT INTO orders
    (order_id, host_user_id, seller_user_id, coupon_id,
     created_at, order_status, fulfillment_type)
VALUES
    (94104, 90004, 90103, NULL,
     '2026-11-12 13:00:00', 'Confirmed', 'Delivery');

INSERT INTO solo_orders (order_id)
VALUES (94104);

INSERT INTO order_items
    (order_id, user_id, item_id, quantity, unit_price_snapshot)
VALUES
    (94104, 90004, 92005, 1, 72.00);

INSERT INTO deliveries
    (delivery_id, order_id, courier_user_id, delivery_status,
     delivery_timestamp, shipping_fee)
VALUES
    (95104, 94104, 90202, 'Assigned', '2026-11-12 13:05:00', 0.00);
```

这条数据代表“骑手配送，但免收配送费”，例如促销免运费或商家承担运费。它**不代表顾客自取**：自取订单应设置为 `Self-Pickup`，并且没有 `deliveries` 记录；零运费配送仍是 `Delivery`，因此仍有配送记录和骑手。

加入此案例可验证：

- `0.00` 能通过数据库的非负运费约束；
- 订单总额计算能正确处理零配送费；
- 系统不会把零运费误当作 `NULL`、缺少配送记录或自取订单。

## 使用说明

第 2、3 节的 SQL 已整合进 `db/seed.sql`，运行 `db/seed.sh` 时会一并导入。第 1 节的提前锁定示例仍仅作讨论参考；当前 schema 不包含提前锁定的数据结构。
