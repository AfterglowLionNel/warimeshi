-- PostgreSQL Initialization Script for Warimeshi
-- Run this after creating the schema with `pnpm db:push`

-- Create trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for auto-calculating line_total
CREATE OR REPLACE FUNCTION set_orders_line_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.line_total = NEW.unit_price * NEW.quantity;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS tables_updated_at ON tables;
CREATE TRIGGER tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS taxi_rides_updated_at ON taxi_rides;
CREATE TRIGGER taxi_rides_updated_at
  BEFORE UPDATE ON taxi_rides
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS taxi_segments_updated_at ON taxi_segments;
CREATE TRIGGER taxi_segments_updated_at
  BEFORE UPDATE ON taxi_segments
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- Apply line_total trigger for orders
DROP TRIGGER IF EXISTS orders_set_line_total ON orders;
CREATE TRIGGER orders_set_line_total
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_orders_line_total();

-- Add constraints
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_quantity_check;
ALTER TABLE orders ADD CONSTRAINT orders_quantity_check CHECK (quantity > 0);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_unit_price_check;
ALTER TABLE orders ADD CONSTRAINT orders_unit_price_check CHECK (unit_price >= 0);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_table_members_table_id ON table_members(table_id);
CREATE INDEX IF NOT EXISTS idx_table_members_user_id ON table_members(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_member_id ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_invite_token ON tables(invite_token);
CREATE INDEX IF NOT EXISTS idx_tables_owner_user_id ON tables(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_taxi_records_table_id ON taxi_records(table_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMENT ON TABLE users IS 'User accounts';
COMMENT ON TABLE tables IS 'Group dining events/tables';
COMMENT ON TABLE table_members IS 'Members participating in tables';
COMMENT ON TABLE orders IS 'Food/drink orders within a table';
COMMENT ON TABLE taxi_records IS 'Saved taxi fare calculations';
COMMENT ON TABLE taxi_rides IS 'Individual taxi ride configurations';
COMMENT ON TABLE taxi_segments IS 'Segments within a shared taxi ride';

SELECT 'PostgreSQL initialization completed successfully!' AS status;
