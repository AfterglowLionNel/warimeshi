ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE table_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view orders"
ON orders
FOR SELECT
USING (
  is_user_table_member(table_id)
);

CREATE POLICY "Members can insert orders"
ON orders
FOR INSERT
WITH CHECK (
  is_user_table_member(table_id)
);

CREATE POLICY "Owner, member, or creator can update orders"
ON orders
FOR UPDATE
USING (
  is_user_table_owner(table_id)
  OR created_by_user_id IN (
    SELECT id FROM users WHERE firebase_uid = auth.uid()::text
  )
  OR member_id IN (
    SELECT tm.id
    FROM table_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.id = orders.member_id
      AND u.firebase_uid = auth.uid()::text
  )
)
WITH CHECK (
  is_user_table_owner(table_id) OR is_user_table_member(table_id)
);

CREATE POLICY "Owner, member, or creator can delete orders"
ON orders
FOR DELETE
USING (
  is_user_table_owner(table_id)
  OR created_by_user_id IN (
    SELECT id FROM users WHERE firebase_uid = auth.uid()::text
  )
  OR member_id IN (
    SELECT tm.id
    FROM table_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.id = orders.member_id
      AND u.firebase_uid = auth.uid()::text
  )
);

CREATE POLICY "Members can view table_members"
ON table_members
FOR SELECT
USING (
  user_id IN (
    SELECT id FROM users WHERE firebase_uid = auth.uid()::text
  )
  OR is_user_table_owner(table_id)
);

CREATE POLICY "Owner can insert table_members"
ON table_members
FOR INSERT
WITH CHECK (
  is_user_table_owner(table_id)
);

CREATE POLICY "Owner can delete table_members"
ON table_members
FOR DELETE
USING (
  is_user_table_owner(table_id)
);

CREATE POLICY "Users can view own profile"
ON users
FOR SELECT
USING (
  firebase_uid = auth.uid()::text
);

CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
USING (
  firebase_uid = auth.uid()::text
);
