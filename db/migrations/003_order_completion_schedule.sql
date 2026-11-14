-- One-time migration. For repeatable upgrades, run: python -m backend.manage migrate
-- Existing orders/financial amounts are preserved; historic orders are not rescheduled.
ALTER TABLE orders
    ADD COLUMN placed_at DATETIME NULL,
    ADD COLUMN completion_due_at DATETIME NULL,
    ADD COLUMN completed_at DATETIME NULL,
    ADD INDEX idx_order_completion (order_status, completion_due_at);
