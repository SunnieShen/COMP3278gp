-- One-time migration for databases created with the previous schema.sql.
-- Preserves existing host IDs and the foreign-key constraint.
ALTER TABLE orders
    RENAME COLUMN buyer_user_id TO host_user_id;
