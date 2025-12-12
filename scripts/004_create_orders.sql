-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  member_id UUID NOT NULL REFERENCES table_members(id) ON DELETE CASCADE,
  item_name TEXT,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  line_total INTEGER NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_member ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by_user_id);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view orders" ON orders 
  FOR SELECT USING (is_user_table_member(table_id));

CREATE POLICY "Members can insert orders" ON orders 
  FOR INSERT WITH CHECK (is_user_table_member(table_id));

CREATE POLICY "Owner, member, or creator can update orders" ON orders 
  FOR UPDATE USING (
    is_user_table_owner(table_id)
    OR created_by_user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
    OR member_id IN (
      SELECT tm.id
      FROM table_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = orders.member_id AND u.firebase_uid = auth.uid()::text
    )
  )
  WITH CHECK (true);

CREATE POLICY "Owner, member, or creator can delete orders" ON orders 
  FOR DELETE USING (
    is_user_table_owner(table_id)
    OR created_by_user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
    OR member_id IN (
      SELECT tm.id
      FROM table_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = orders.member_id AND u.firebase_uid = auth.uid()::text
    )
  );

-- Trigger to auto-calculate line_total
CREATE OR REPLACE FUNCTION set_orders_line_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.line_total = NEW.unit_price * NEW.quantity;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_line_total
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_orders_line_total();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
