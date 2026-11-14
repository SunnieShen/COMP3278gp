-- One-time rename for existing databases; values and defaults are preserved.
-- For a repeatable upgrade, use: python -m backend.manage migrate
ALTER TABLE orders RENAME COLUMN order_timestamp TO created_at;
