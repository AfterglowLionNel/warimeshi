import { db } from "@/lib/db";
import { users, tables, tableMembers, orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Resolve user ID from a guest token
 */
export async function resolveUserIdFromGuestToken(guestToken: string): Promise<string | null> {
  const [guestUser] = await db
    .select({ id: users.id, isGuestUser: users.isGuestUser, guestTokenExpiresAt: users.guestTokenExpiresAt })
    .from(users)
    .where(eq(users.guestToken, guestToken))
    .limit(1);

  if (!guestUser || !guestUser.isGuestUser) {
    return null;
  }

  if (guestUser.guestTokenExpiresAt && new Date(guestUser.guestTokenExpiresAt) < new Date()) {
    return null;
  }

  return guestUser.id;
}

/**
 * Get user by guest token
 */
export async function getUserByGuestToken(guestToken: string) {
  const [guestUser] = await db
    .select()
    .from(users)
    .where(eq(users.guestToken, guestToken))
    .limit(1);

  if (!guestUser || !guestUser.isGuestUser) {
    return null;
  }

  if (guestUser.guestTokenExpiresAt && new Date(guestUser.guestTokenExpiresAt) < new Date()) {
    return null;
  }

  return guestUser;
}

/**
 * Resolve the actual database user ID from a session user ID
 * Handles the case where session.user.id doesn't match the DB user ID
 * by falling back to email-based lookup
 */
export async function resolveDbUserId(sessionUserId: string, email?: string | null): Promise<string | null> {
  // First try by session user ID
  const [userById] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, sessionUserId))
    .limit(1);

  if (userById) {
    return userById.id;
  }

  // Fallback to email
  if (email) {
    const [userByEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userByEmail) {
      return userByEmail.id;
    }
  }

  return null;
}

/**
 * Check if a user is a member of a table
 * Tries both by direct userId and by email fallback
 */
export async function isUserTableMember(userId: string, tableId: string, email?: string | null): Promise<boolean> {
  // First try direct match
  const [member] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, userId)))
    .limit(1);

  if (member) return true;

  // If not found and email is provided, try to find the actual DB user ID
  if (email) {
    const dbUserId = await resolveDbUserId(userId, email);
    if (dbUserId && dbUserId !== userId) {
      const [memberByDbId] = await db
        .select({ id: tableMembers.id })
        .from(tableMembers)
        .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, dbUserId)))
        .limit(1);
      return !!memberByDbId;
    }
  }

  return false;
}

/**
 * Check if a user is the owner of a table
 * Tries both by direct userId and by email fallback
 */
export async function isUserTableOwner(userId: string, tableId: string, email?: string | null): Promise<boolean> {
  // First try direct match
  const [table] = await db
    .select({ id: tables.id })
    .from(tables)
    .where(and(eq(tables.id, tableId), eq(tables.ownerUserId, userId)))
    .limit(1);

  if (table) return true;

  // If not found and email is provided, try to find the actual DB user ID
  if (email) {
    const dbUserId = await resolveDbUserId(userId, email);
    if (dbUserId && dbUserId !== userId) {
      const [tableByDbId] = await db
        .select({ id: tables.id })
        .from(tables)
        .where(and(eq(tables.id, tableId), eq(tables.ownerUserId, dbUserId)))
        .limit(1);
      return !!tableByDbId;
    }
  }

  return false;
}

/**
 * Check if a user can access a table (is member or owner)
 */
export async function checkTableAccess(userId: string, tableId: string): Promise<boolean> {
  const [isMember, isOwner] = await Promise.all([
    isUserTableMember(userId, tableId),
    isUserTableOwner(userId, tableId),
  ]);

  return isMember || isOwner;
}

/**
 * Get the user's member record for a table
 */
export async function getUserTableMember(userId: string, tableId: string) {
  const [member] = await db
    .select()
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, userId)))
    .limit(1);

  return member ?? null;
}

/**
 * Check if a user can modify an order
 * Rules: user is table owner, order creator, or the member who placed the order
 */
export async function canModifyOrder(
  userId: string,
  orderId: string
): Promise<{ allowed: boolean; order: typeof orders.$inferSelect | null }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    return { allowed: false, order: null };
  }

  // Check if user is table owner
  const isOwner = await isUserTableOwner(userId, order.tableId);
  if (isOwner) {
    return { allowed: true, order };
  }

  // Check if user is the order creator
  if (order.createdByUserId === userId) {
    return { allowed: true, order };
  }

  // Check if user is the member who placed the order
  const [member] = await db
    .select()
    .from(tableMembers)
    .where(and(eq(tableMembers.id, order.memberId), eq(tableMembers.userId, userId)))
    .limit(1);

  if (member) {
    return { allowed: true, order };
  }

  return { allowed: false, order };
}

/**
 * Check if a user can delete a table member
 * Rules: user is table owner, or user is removing themselves
 */
export async function canDeleteTableMember(
  userId: string,
  memberId: string
): Promise<{ allowed: boolean; member: typeof tableMembers.$inferSelect | null }> {
  const [member] = await db.select().from(tableMembers).where(eq(tableMembers.id, memberId)).limit(1);

  if (!member) {
    return { allowed: false, member: null };
  }

  // User is removing themselves
  if (member.userId === userId) {
    return { allowed: true, member };
  }

  // User is table owner
  const isOwner = await isUserTableOwner(userId, member.tableId);
  if (isOwner) {
    return { allowed: true, member };
  }

  return { allowed: false, member };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

/**
 * Get or create user from session info
 * This is used when the user first accesses the app after OAuth login
 */
export async function getOrCreateUser(sessionUser: {
  id: string;
  email?: string | null;
  name?: string | null;
}) {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  // This shouldn't happen often as Auth.js adapter creates users
  // But handle it for edge cases
  const [newUser] = await db
    .insert(users)
    .values({
      id: sessionUser.id,
      email: sessionUser.email ?? null,
      nickname: sessionUser.name ?? null,
    })
    .returning();

  return newUser;
}
