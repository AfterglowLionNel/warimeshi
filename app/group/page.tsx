import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { GroupDashboard } from "@/components/group/group-dashboard"

export default async function GroupPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login?redirect=/group")
  }

  // Get or create user in our users table
  let { data: dbUser } = await supabase.from("users").select("*").eq("firebase_uid", user.id).single()

  if (!dbUser) {
    // Create user record
    const nickname = user.user_metadata?.nickname || user.user_metadata?.name || user.email?.split("@")[0] || "ユーザー"

    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        firebase_uid: user.id,
        email: user.email,
        nickname,
      })
      .select()
      .single()

    if (createError) {
      console.error("Failed to create user:", createError)
      redirect("/auth/error?error=user_creation_failed")
    }

    dbUser = newUser
  }

  // Get tables where user is a member
  const { data: memberships } = await supabase
    .from("table_members")
    .select("table_id, is_master, display_name")
    .eq("user_id", dbUser.id)

  const tableIds = memberships?.map((m) => m.table_id) || []

  let tables: Array<{
    id: string
    name: string
    event_date: string
    invite_token: string
    is_archived: boolean
    is_master: boolean
    member_count: number
  }> = []

  if (tableIds.length > 0) {
    const { data: tablesData } = await supabase
      .from("tables")
      .select("*")
      .in("id", tableIds)
      .order("event_date", { ascending: false })

    if (tablesData) {
      // Get member counts for each table
      const memberCounts = await Promise.all(
        tablesData.map(async (table) => {
          const { count } = await supabase
            .from("table_members")
            .select("*", { count: "exact", head: true })
            .eq("table_id", table.id)
          return { tableId: table.id, count: count || 0 }
        }),
      )

      tables = tablesData.map((table) => {
        const membership = memberships?.find((m) => m.table_id === table.id)
        const countData = memberCounts.find((c) => c.tableId === table.id)
        return {
          ...table,
          is_master: membership?.is_master || false,
          member_count: countData?.count || 0,
        }
      })
    }
  }

  return <GroupDashboard user={dbUser} tables={tables} />
}
