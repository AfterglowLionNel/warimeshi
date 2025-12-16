import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TableDetailClient } from "@/components/group/table-detail-client"
import { ArchivedTableNotice } from "@/components/group/archived-table-notice"

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Get table by invite token
  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("*")
    .eq("invite_token", token)
    .single()

  if (tableError || !table) {
    redirect("/group?error=table_not_found")
  }

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/group/table/${token}`)
  }

  // Get user's DB record
  const { data: dbUser } = await supabase.from("users").select("*").eq("firebase_uid", user.id).single()

  if (!dbUser) {
    redirect("/auth/error?error=user_not_found")
  }

  // Archived tables are only accessible by the owner
  if (table.is_archived && table.owner_user_id !== dbUser.id) {
    const { data: ownerMember } = await supabase
      .from("table_members")
      .select("display_name")
      .eq("table_id", table.id)
      .eq("is_master", true)
      .limit(1)
      .single()

    return (
      <ArchivedTableNotice
        tableName={table.name}
        eventDate={table.event_date}
        ownerName={ownerMember?.display_name || "作成者"}
      />
    )
  }

  // Check if user is a member
  const { data: membership } = await supabase
    .from("table_members")
    .select("*")
    .eq("table_id", table.id)
    .eq("user_id", dbUser.id)
    .single()

  if (!membership) {
    redirect(`/group/join/${token}`)
  }

  // Get all members
  const { data: members } = await supabase
    .from("table_members")
    .select("*, user:users(*)")
    .eq("table_id", table.id)
    .order("joined_at", { ascending: true })

  // Get orders (non-deleted)
  const { data: orders } = await supabase
    .from("orders")
    .select("*, member:table_members(*)")
    .eq("table_id", table.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return (
    <TableDetailClient
      table={table}
      currentUser={dbUser}
      currentMembership={membership}
      initialMembers={members || []}
      initialOrders={orders || []}
    />
  )
}
