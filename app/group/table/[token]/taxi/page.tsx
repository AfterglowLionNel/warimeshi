import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TaxiCalculator } from "@/components/taxi/taxi-calculator";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import { ArchivedTableNotice } from "@/components/group/archived-table-notice";

export default async function TableTaxiPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Get table by invite token
  const [table] = await db
    .select()
    .from(tables)
    .where(eq(tables.inviteToken, token))
    .limit(1);

  if (!table) {
    redirect("/group?error=table_not_found");
  }

  // Check if user is logged in
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/auth/login?redirect=/group/table/${token}/taxi`);
  }

  // Get user's DB record
  let [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Fallback to email search
  if (!dbUser && session.user.email) {
    [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
  }

  // Create user if not exists
  if (!dbUser && session.user.email) {
    const nickname = session.user.name || session.user.email.split("@")[0] || "ユーザー";
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          id: session.user.id,
          email: session.user.email,
          nickname,
          image: session.user.image ?? null,
        })
        .onConflictDoNothing()
        .returning();
      if (newUser) {
        dbUser = { id: newUser.id };
      }
    } catch {
      // Ignore creation errors
    }
  }

  if (!dbUser) {
    redirect("/auth/error?error=user_not_found");
  }

  // Archived tables are only accessible by the owner
  if (table.isArchived && table.ownerUserId !== dbUser.id) {
    const [ownerMember] = await db
      .select({ displayName: tableMembers.displayName })
      .from(tableMembers)
      .where(and(eq(tableMembers.tableId, table.id), eq(tableMembers.isMaster, true)))
      .limit(1);

    return (
      <ArchivedTableNotice
        tableName={table.name}
        eventDate={table.eventDate.toISOString().split("T")[0]}
        ownerName={ownerMember?.displayName || "作成者"}
      />
    );
  }

  // Check if user is a member
  const [membership] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, table.id), eq(tableMembers.userId, dbUser.id)))
    .limit(1);

  if (!membership) {
    redirect(`/group/join/${token}`);
  }

  // Get member count
  const members = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(eq(tableMembers.tableId, table.id));

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href={`/group/table/${token}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            テーブルに戻る
          </Link>
          <h1 className="text-xl font-bold text-primary">{table.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {table.eventDate.toLocaleDateString("ja-JP")}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {members.length}人
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">タクシー・代行計算</p>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4 max-w-lg">
        <TaxiCalculator showBackLink={false} tableId={table.id} currentUserId={dbUser.id} />
      </div>
    </main>
  );
}
