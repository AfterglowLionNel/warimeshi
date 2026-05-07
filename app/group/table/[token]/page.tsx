import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TableDetailPageClient } from "@/components/group/table-detail-page-client";
import { decryptInvitePassword, isEncryptedInvitePassword } from "@/lib/crypto/invite-password";

// 動的URLは検索エンジンにインデックスさせない
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Get table by invite token (server-side)
  const [table] = await db
    .select()
    .from(tables)
    .where(eq(tables.inviteToken, token))
    .limit(1);

  if (!table) {
    return <TableDetailPageClient table={null} token={token} error="table_not_found" />;
  }

  // Get owner info
  const [ownerMember] = await db
    .select({ displayName: tableMembers.displayName })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, table.id), eq(tableMembers.isMaster, true)))
    .limit(1);

  // 現在のユーザーがテーブルのオーナーかを判定。
  // オーナーにのみ復号した招待パスワードを返す (一般メンバーには渡さない)。
  const session = await auth();
  let currentUserId: string | null = null;
  if (session?.user?.id) {
    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    currentUserId = dbUser?.id ?? session.user.id;
    if (!dbUser && session.user.email) {
      const [byEmail] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, session.user.email))
        .limit(1);
      if (byEmail) currentUserId = byEmail.id;
    }
  }
  const isOwner = currentUserId !== null && currentUserId === table.ownerUserId;

  let invitePasswordForOwner: string | null = null;
  if (isOwner && table.invitePassword) {
    if (isEncryptedInvitePassword(table.invitePassword)) {
      invitePasswordForOwner = decryptInvitePassword(table.invitePassword);
    } else if (!table.invitePassword.startsWith("$2")) {
      // 旧平文 (移行期間)。bcrypt ハッシュは復元不能なので null のまま。
      invitePasswordForOwner = table.invitePassword;
    }
  }

  // Convert table to expected format
  const tableForComponent = {
    id: table.id,
    owner_user_id: table.ownerUserId,
    name: table.name,
    event_date: table.eventDate.toISOString().split("T")[0],
    invite_token: table.inviteToken,
    invite_password: invitePasswordForOwner,
    is_archived: table.isArchived,
    archived_at: table.archivedAt?.toISOString() ?? null,
    is_locked: table.isLocked,
    auto_lock_at: table.autoLockAt?.toISOString() ?? null,
    created_at: table.createdAt.toISOString(),
    updated_at: table.updatedAt.toISOString(),
  };

  return (
    <TableDetailPageClient
      table={tableForComponent}
      token={token}
      ownerName={ownerMember?.displayName || "作成者"}
    />
  );
}
