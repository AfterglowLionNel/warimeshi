import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { JoinTableForm } from "@/components/group/join-table-form"
import { ArchivedTableNotice } from "@/components/group/archived-table-notice"

export default async function JoinTablePage({
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
    redirect("/group?error=invalid_invite")
  }

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/group/join/${token}`)
  }

  // Resolve DB user
  // Get or create user record
  let { data: dbUser } = await supabase.from("users").select("*").eq("firebase_uid", user.id).single()

  if (!dbUser) {
    const nickname = user.user_metadata?.nickname || user.user_metadata?.name || user.email?.split("@")[0] || "ユーザー"

    const { data: newUser } = await supabase
      .from("users")
      .insert({
        firebase_uid: user.id,
        email: user.email,
        nickname,
      })
      .select()
      .single()

    dbUser = newUser
  }

  if (!dbUser) {
    redirect("/auth/error?error=user_creation_failed")
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

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("table_members")
    .select("id")
    .eq("table_id", table.id)
    .eq("user_id", dbUser.id)
    .single()

  if (existingMember) {
    redirect(`/group/table/${token}`)
  }

  // Get current member count (explicitly fetch ids to avoid stale/empty counts)
  const { data: members } = await supabase
    .from("table_members")
    .select("id")
    .eq("table_id", table.id)

  return (
    <JoinTableForm
      table={table}
      memberCount={members?.length || 0}
      defaultDisplayName={dbUser.nickname || ""}
    />
  )
}
