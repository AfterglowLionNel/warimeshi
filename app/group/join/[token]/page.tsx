import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { JoinTableForm } from "@/components/group/join-table-form"

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

  // Get current member count
  const { count: memberCount } = await supabase
    .from("table_members")
    .select("*", { count: "exact", head: true })
    .eq("table_id", table.id)

  return (
    <JoinTableForm
      table={table}
      user={dbUser}
      memberCount={memberCount || 0}
      defaultDisplayName={dbUser.nickname || ""}
    />
  )
}
