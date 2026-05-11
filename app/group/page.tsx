import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { GroupPageClient } from "@/components/group/group-page-client";

export const metadata: Metadata = {
  title: "グループ割り勘 | リンク共有・リアルタイム同期",
  description: "飲み会や旅行のグループで割り勘計算。招待リンクを共有するだけで参加可能。注文をリアルタイムで共有し、誰が何を頼んだか一目で分かる。幹事の負担を軽減。",
  alternates: {
    canonical: "https://warimeshi.com/group",
  },
  openGraph: {
    title: "グループ割り勘 | リンク共有・リアルタイム同期",
    description: "飲み会や旅行のグループで割り勘計算。招待リンクを共有するだけで参加可能。",
  },
};

export default async function GroupPage() {
  const session = await auth();

  // If no session, render the client component which will handle guest auth
  if (!session?.user?.id) {
    return <GroupPageClient serverUser={null} serverTables={[]} />;
  }

  // Get or create user in our users table
  let [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!dbUser) {
    // Create user record (shouldn't happen with Auth.js adapter, but handle edge case)
    const nickname = session.user.name || session.user.email?.split("@")[0] || "ユーザー";

    try {
      const [newUser] = await db
        .insert(users)
        .values({
          id: session.user.id,
          email: session.user.email ?? null,
          nickname,
        })
        .onConflictDoNothing()
        .returning();

      if (newUser) {
        dbUser = newUser;
      } else {
        // Email conflict - try to find existing user by email
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, session.user.email!))
          .limit(1);
        if (existingUser) {
          dbUser = existingUser;
        } else {
          return <GroupPageClient serverUser={null} serverTables={[]} />;
        }
      }
    } catch {
      // Fallback: try to find by email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, session.user.email!))
        .limit(1);
      if (existingUser) {
        dbUser = existingUser;
      } else {
        return <GroupPageClient serverUser={null} serverTables={[]} />;
      }
    }
  }

  // Sync nickname from Auth.js name if nickname is not set
  if (!dbUser.nickname && (dbUser.name || session.user.name)) {
    const newNickname = dbUser.name || session.user.name!;
    await db
      .update(users)
      .set({ nickname: newNickname, updatedAt: new Date() })
      .where(eq(users.id, dbUser.id));
    dbUser = { ...dbUser, nickname: newNickname };
  }

  // Get tables where user is a member
  const memberships = await db
    .select({
      tableId: tableMembers.tableId,
      isMaster: tableMembers.isMaster,
      displayName: tableMembers.displayName,
    })
    .from(tableMembers)
    .where(eq(tableMembers.userId, dbUser.id));

  const tableIds = memberships.map((m) => m.tableId);

  let tablesWithDetails: Array<{
    id: string;
    name: string;
    event_date: string;
    invite_token: string;
    is_archived: boolean;
    is_master: boolean;
    member_count: number;
  }> = [];

  if (tableIds.length > 0) {
    const tablesData = await db
      .select()
      .from(tables)
      .where(inArray(tables.id, tableIds))
      .orderBy(desc(tables.eventDate));

    if (tablesData.length > 0) {
      // Get member counts for each table
      const memberCounts = await Promise.all(
        tablesData.map(async (table) => {
          const members = await db
            .select({ id: tableMembers.id })
            .from(tableMembers)
            .where(eq(tableMembers.tableId, table.id));
          return { tableId: table.id, count: members.length };
        })
      );

      tablesWithDetails = tablesData.map((table) => {
        const membership = memberships.find((m) => m.tableId === table.id);
        const countData = memberCounts.find((c) => c.tableId === table.id);
        return {
          id: table.id,
          name: table.name,
          event_date: table.eventDate.toISOString().split("T")[0],
          invite_token: table.inviteToken,
          is_archived: table.isArchived,
          is_master: membership?.isMaster || false,
          member_count: countData?.count || 0,
        };
      });
    }
  }

  // Client Component に渡す最小限の DTO。
  // is_admin / created_at / updated_at は UI で使わず、漏らす理由がないため含めない。
  const userForComponent = {
    id: dbUser.id,
    email: dbUser.email,
    nickname: dbUser.nickname,
  };

  return <GroupPageClient serverUser={userForComponent} serverTables={tablesWithDetails} />;
}
