-- Taxi rides table
CREATE TABLE IF NOT EXISTS taxi_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  base_km DECIMAL(5,1) NOT NULL,
  base_price INTEGER NOT NULL,
  per_km_price INTEGER NOT NULL,
  extra_from_km DECIMAL(5,1),
  extra_per_km INTEGER,
  surcharge_from_time TIME,
  surcharge_to_time TIME,
  surcharge_multiplier DECIMAL(3,2),
  total_distance DECIMAL(6,1),
  total_price INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Taxi segments (per-person distances)
CREATE TABLE IF NOT EXISTS taxi_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES taxi_rides(id) ON DELETE CASCADE,
  member_id UUID REFERENCES table_members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  distance_km DECIMAL(5,1) NOT NULL,
  order_index INTEGER NOT NULL,
  share_amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_taxi_rides_table ON taxi_rides(table_id);
CREATE INDEX IF NOT EXISTS idx_taxi_segments_ride ON taxi_segments(ride_id);

-- Enable RLS
ALTER TABLE taxi_rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxi_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view taxi rides" ON taxi_rides 
  FOR SELECT USING (is_user_table_member(table_id));

CREATE POLICY "Members can manage taxi rides" ON taxi_rides 
  FOR ALL USING (is_user_table_member(table_id));

CREATE POLICY "Members can view taxi segments" ON taxi_segments 
  FOR SELECT USING (
    ride_id IN (SELECT id FROM taxi_rides WHERE is_user_table_member(table_id))
  );

CREATE POLICY "Members can manage taxi segments" ON taxi_segments 
  FOR ALL USING (
    ride_id IN (SELECT id FROM taxi_rides WHERE is_user_table_member(table_id))
  );

CREATE TRIGGER taxi_rides_updated_at
  BEFORE UPDATE ON taxi_rides
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER taxi_segments_updated_at
  BEFORE UPDATE ON taxi_segments
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
