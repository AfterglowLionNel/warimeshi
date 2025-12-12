-- Table charges (service charge, seat charge, appetizer)
CREATE TABLE IF NOT EXISTS table_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID UNIQUE NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  service_charge INTEGER DEFAULT 0,
  seat_charge INTEGER DEFAULT 0,
  appetizer_charge INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE table_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view charges" ON table_charges 
  FOR SELECT USING (is_user_table_member(table_id));

CREATE POLICY "Master can manage charges" ON table_charges 
  FOR ALL USING (is_user_table_owner(table_id));

CREATE TRIGGER table_charges_updated_at
  BEFORE UPDATE ON table_charges
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
