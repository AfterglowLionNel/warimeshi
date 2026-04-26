import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  date,
  jsonb,
  numeric,
  time,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// =====================================================
// Auth.js Adapter Tables
// =====================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"), // Required by Auth.js
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  passwordHash: text("password_hash"),
  nickname: text("nickname"),
  image: text("image"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isGuestUser: boolean("is_guest_user").default(false).notNull(),
  guestToken: text("guest_token").unique(),
  guestTokenExpiresAt: timestamp("guest_token_expires_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// =====================================================
// Application Tables
// =====================================================

export const tables = pgTable("tables", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  eventDate: date("event_date", { mode: "date" }).notNull(),
  inviteToken: text("invite_token").notNull().unique(),
  inviteTokenExpiresAt: timestamp("invite_token_expires_at", { mode: "date", withTimezone: true }),
  invitePassword: text("invite_password"),
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
  isLocked: boolean("is_locked").default(false).notNull(),
  autoLockAt: timestamp("auto_lock_at", { mode: "date", withTimezone: true }),
  settlementSettings: jsonb("settlement_settings"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const tableMembers = pgTable("table_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  isMaster: boolean("is_master").default(false).notNull(),
  isGuest: boolean("is_guest").default(false).notNull(),
  addedByUserId: uuid("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
  joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => tableMembers.id, { onDelete: "cascade" }),
  itemName: text("item_name"),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  lineTotal: integer("line_total").notNull(),
  isShared: boolean("is_shared").default(false).notNull(),
  sharedGroupId: uuid("shared_group_id"),
  deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  fromMemberId: uuid("from_member_id")
    .notNull()
    .references(() => tableMembers.id, { onDelete: "cascade" }),
  toMemberId: uuid("to_member_id")
    .notNull()
    .references(() => tableMembers.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
  splitMode: text("split_mode").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const taxiRecords = pgTable("taxi_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  vehicleType: text("vehicle_type").notNull(),
  mode: text("mode").notNull(),
  settings: jsonb("settings").notNull(),
  input: jsonb("input"),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const taxiRides = pgTable("taxi_rides", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  baseKm: numeric("base_km", { precision: 5, scale: 1 }).notNull(),
  basePrice: integer("base_price").notNull(),
  perKmPrice: integer("per_km_price").notNull(),
  extraFromKm: numeric("extra_from_km", { precision: 5, scale: 1 }),
  extraPerKm: integer("extra_per_km"),
  surchargeFromTime: time("surcharge_from_time"),
  surchargeToTime: time("surcharge_to_time"),
  surchargeMultiplier: numeric("surcharge_multiplier", { precision: 3, scale: 2 }),
  totalDistance: numeric("total_distance", { precision: 6, scale: 1 }),
  totalPrice: integer("total_price"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const taxiSegments = pgTable("taxi_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  rideId: uuid("ride_id")
    .notNull()
    .references(() => taxiRides.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").references(() => tableMembers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  distanceKm: numeric("distance_km", { precision: 5, scale: 1 }).notNull(),
  orderIndex: integer("order_index").notNull(),
  shareAmount: integer("share_amount"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

// =====================================================
// Relations
// =====================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  ownedTables: many(tables),
  memberships: many(tableMembers),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  owner: one(users, {
    fields: [tables.ownerUserId],
    references: [users.id],
  }),
  members: many(tableMembers),
  orders: many(orders),
  payments: many(payments),
  taxiRecords: many(taxiRecords),
  taxiRides: many(taxiRides),
}));

export const tableMembersRelations = relations(tableMembers, ({ one, many }) => ({
  table: one(tables, {
    fields: [tableMembers.tableId],
    references: [tables.id],
  }),
  user: one(users, {
    fields: [tableMembers.userId],
    references: [users.id],
  }),
  addedByUser: one(users, {
    fields: [tableMembers.addedByUserId],
    references: [users.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  createdByUser: one(users, {
    fields: [orders.createdByUserId],
    references: [users.id],
  }),
  member: one(tableMembers, {
    fields: [orders.memberId],
    references: [tableMembers.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  table: one(tables, {
    fields: [payments.tableId],
    references: [tables.id],
  }),
  fromMember: one(tableMembers, {
    fields: [payments.fromMemberId],
    references: [tableMembers.id],
    relationName: "paymentFrom",
  }),
  toMember: one(tableMembers, {
    fields: [payments.toMemberId],
    references: [tableMembers.id],
    relationName: "paymentTo",
  }),
}));

export const taxiRecordsRelations = relations(taxiRecords, ({ one }) => ({
  table: one(tables, {
    fields: [taxiRecords.tableId],
    references: [tables.id],
  }),
  createdByUser: one(users, {
    fields: [taxiRecords.createdByUserId],
    references: [users.id],
  }),
}));

export const taxiRidesRelations = relations(taxiRides, ({ one, many }) => ({
  table: one(tables, {
    fields: [taxiRides.tableId],
    references: [tables.id],
  }),
  segments: many(taxiSegments),
}));

export const taxiSegmentsRelations = relations(taxiSegments, ({ one }) => ({
  ride: one(taxiRides, {
    fields: [taxiSegments.rideId],
    references: [taxiRides.id],
  }),
  member: one(tableMembers, {
    fields: [taxiSegments.memberId],
    references: [tableMembers.id],
  }),
}));

// =====================================================
// Type Exports
// =====================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;

export type TableMember = typeof tableMembers.$inferSelect;
export type NewTableMember = typeof tableMembers.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type TaxiRecord = typeof taxiRecords.$inferSelect;
export type NewTaxiRecord = typeof taxiRecords.$inferInsert;

export type TaxiRide = typeof taxiRides.$inferSelect;
export type NewTaxiRide = typeof taxiRides.$inferInsert;

export type TaxiSegment = typeof taxiSegments.$inferSelect;
export type NewTaxiSegment = typeof taxiSegments.$inferInsert;
