/**
 * Data Migration Script: Supabase → Self-hosted PostgreSQL
 *
 * This script migrates data from Supabase to the new self-hosted PostgreSQL database.
 *
 * Prerequisites:
 * 1. Export data from Supabase using pg_dump or Supabase dashboard
 * 2. Set up the new PostgreSQL database with the Drizzle schema
 * 3. Configure DATABASE_URL to point to the new database
 *
 * Usage:
 * 1. First run `pnpm db:push` to create the schema in the new database
 * 2. Then run this script: `npx tsx scripts/migrate-data.ts`
 */

import postgres from "postgres";

// Configuration - Update these values
const SUPABASE_DB_URL = process.env.SUPABASE_DATABASE_URL;
const NEW_DB_URL = process.env.DATABASE_URL;

if (!SUPABASE_DB_URL || !NEW_DB_URL) {
  console.error("Error: Set SUPABASE_DATABASE_URL and DATABASE_URL environment variables");
  process.exit(1);
}

const sourceDb = postgres(SUPABASE_DB_URL);
const targetDb = postgres(NEW_DB_URL);

async function migrateUsers() {
  console.log("Migrating users...");

  const users = await sourceDb`
    SELECT
      id,
      firebase_uid,
      email,
      nickname,
      is_admin,
      created_at,
      updated_at
    FROM public.users
  `;

  for (const user of users) {
    await targetDb`
      INSERT INTO users (id, email, nickname, is_admin, created_at, updated_at)
      VALUES (
        ${user.id},
        ${user.email},
        ${user.nickname},
        ${user.is_admin},
        ${user.created_at},
        ${user.updated_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(`Migrated ${users.length} users`);
  return users;
}

async function migrateTables() {
  console.log("Migrating tables...");

  const tables = await sourceDb`
    SELECT
      id,
      owner_user_id,
      name,
      event_date,
      invite_token,
      is_archived,
      archived_at,
      created_at,
      updated_at
    FROM public.tables
  `;

  for (const table of tables) {
    await targetDb`
      INSERT INTO tables (id, owner_user_id, name, event_date, invite_token, is_archived, archived_at, created_at, updated_at)
      VALUES (
        ${table.id},
        ${table.owner_user_id},
        ${table.name},
        ${table.event_date},
        ${table.invite_token},
        ${table.is_archived},
        ${table.archived_at},
        ${table.created_at},
        ${table.updated_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(`Migrated ${tables.length} tables`);
  return tables;
}

async function migrateTableMembers() {
  console.log("Migrating table members...");

  const members = await sourceDb`
    SELECT
      id,
      table_id,
      user_id,
      display_name,
      is_master,
      joined_at
    FROM public.table_members
  `;

  for (const member of members) {
    await targetDb`
      INSERT INTO table_members (id, table_id, user_id, display_name, is_master, joined_at)
      VALUES (
        ${member.id},
        ${member.table_id},
        ${member.user_id},
        ${member.display_name},
        ${member.is_master},
        ${member.joined_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(`Migrated ${members.length} table members`);
  return members;
}

async function migrateOrders() {
  console.log("Migrating orders...");

  const orders = await sourceDb`
    SELECT
      id,
      table_id,
      created_by_user_id,
      member_id,
      item_name,
      unit_price,
      quantity,
      line_total,
      deleted_at,
      created_at,
      updated_at
    FROM public.orders
  `;

  for (const order of orders) {
    await targetDb`
      INSERT INTO orders (id, table_id, created_by_user_id, member_id, item_name, unit_price, quantity, line_total, deleted_at, created_at, updated_at)
      VALUES (
        ${order.id},
        ${order.table_id},
        ${order.created_by_user_id},
        ${order.member_id},
        ${order.item_name},
        ${order.unit_price},
        ${order.quantity},
        ${order.line_total},
        ${order.deleted_at},
        ${order.created_at},
        ${order.updated_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(`Migrated ${orders.length} orders`);
  return orders;
}

async function migrateTaxiRecords() {
  console.log("Migrating taxi records...");

  const records = await sourceDb`
    SELECT
      id,
      table_id,
      created_by_user_id,
      vehicle_type,
      mode,
      settings,
      input,
      result,
      created_at
    FROM public.taxi_records
  `;

  for (const record of records) {
    await targetDb`
      INSERT INTO taxi_records (id, table_id, created_by_user_id, vehicle_type, mode, settings, input, result, created_at)
      VALUES (
        ${record.id},
        ${record.table_id},
        ${record.created_by_user_id},
        ${record.vehicle_type},
        ${record.mode},
        ${record.settings},
        ${record.input},
        ${record.result},
        ${record.created_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(`Migrated ${records.length} taxi records`);
  return records;
}

async function migrateTaxiRides() {
  console.log("Migrating taxi rides...");

  const rides = await sourceDb`
    SELECT
      id,
      table_id,
      base_km,
      base_price,
      per_km_price,
      extra_from_km,
      extra_per_km,
      surcharge_from_time,
      surcharge_to_time,
      surcharge_multiplier,
      total_distance,
      total_price,
      created_at,
      updated_at
    FROM public.taxi_rides
  `;

  for (const ride of rides) {
    await targetDb`
      INSERT INTO taxi_rides (id, table_id, base_km, base_price, per_km_price, extra_from_km, extra_per_km, surcharge_from_time, surcharge_to_time, surcharge_multiplier, total_distance, total_price, created_at, updated_at)
      VALUES (
        ${ride.id},
        ${ride.table_id},
        ${ride.base_km},
        ${ride.base_price},
        ${ride.per_km_price},
        ${ride.extra_from_km},
        ${ride.extra_per_km},
        ${ride.surcharge_from_time},
        ${ride.surcharge_to_time},
        ${ride.surcharge_multiplier},
        ${ride.total_distance},
        ${ride.total_price},
        ${ride.created_at},
        ${ride.updated_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(`Migrated ${rides.length} taxi rides`);
  return rides;
}

async function migrateTaxiSegments() {
  console.log("Migrating taxi segments...");

  const segments = await sourceDb`
    SELECT
      id,
      ride_id,
      member_id,
      name,
      distance_km,
      order_index,
      share_amount,
      created_at,
      updated_at
    FROM public.taxi_segments
  `;

  for (const segment of segments) {
    await targetDb`
      INSERT INTO taxi_segments (id, ride_id, member_id, name, distance_km, order_index, share_amount, created_at, updated_at)
      VALUES (
        ${segment.id},
        ${segment.ride_id},
        ${segment.member_id},
        ${segment.name},
        ${segment.distance_km},
        ${segment.order_index},
        ${segment.share_amount},
        ${segment.created_at},
        ${segment.updated_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log(`Migrated ${segments.length} taxi segments`);
  return segments;
}

async function main() {
  console.log("Starting data migration from Supabase to self-hosted PostgreSQL...\n");

  try {
    // Migrate in order of dependencies
    await migrateUsers();
    await migrateTables();
    await migrateTableMembers();
    await migrateOrders();
    await migrateTaxiRecords();
    await migrateTaxiRides();
    await migrateTaxiSegments();

    console.log("\n✅ Data migration completed successfully!");
    console.log("\n⚠️  Important notes:");
    console.log("1. Supabase Auth passwords cannot be migrated");
    console.log("2. All existing users must reset their passwords");
    console.log("3. OAuth users can sign in normally with Google/LINE");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sourceDb.end();
    await targetDb.end();
  }
}

main();
