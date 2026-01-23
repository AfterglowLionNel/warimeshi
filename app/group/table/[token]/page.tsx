import { db } from "@/lib/db";
import { tables, tableMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TableDetailPageClient } from "@/components/group/table-detail-page-client";

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

  // Convert table to expected format
  const tableForComponent = {
    id: table.id,
    owner_user_id: table.ownerUserId,
    name: table.name,
    event_date: table.eventDate.toISOString().split("T")[0],
    invite_token: table.inviteToken,
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
