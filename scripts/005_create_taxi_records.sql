-- Taxi records to store fare settings and results per table
CREATE TABLE IF NOT EXISTS taxi_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vehicle_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  settings JSONB NOT NULL,
  input JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxi_records_table ON taxi_records(table_id);
CREATE INDEX IF NOT EXISTS idx_taxi_records_created ON taxi_records(created_at DESC);

ALTER TABLE taxi_records ENABLE ROW LEVEL SECURITY;

-- Members or owners can view
CREATE POLICY "Members can view taxi records" ON taxi_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM table_members tm
      WHERE tm.table_id = taxi_records.table_id
        AND tm.user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
    )
  );

-- Members or owners can insert
CREATE POLICY "Members can insert taxi records" ON taxi_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM table_members tm
      WHERE tm.table_id = taxi_records.table_id
        AND tm.user_id IN (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
    )
  );
