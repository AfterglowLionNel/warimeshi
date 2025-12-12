import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { TaxiCalculator } from "@/components/taxi/taxi-calculator"
import { ArrowLeft, Calendar, Users } from "lucide-react"

export default async function TableTaxiPage({
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
    redirect(`/auth/login?redirect=/group/table/${token}/taxi`)
  }

  // Get user's DB record
  const { data: dbUser } = await supabase.from("users").select("id").eq("firebase_uid", user.id).single()

  if (!dbUser) {
    redirect("/auth/error?error=user_not_found")
  }

  // Check if user is a member
  const { data: membership } = await supabase
    .from("table_members")
    .select("id")
    .eq("table_id", table.id)
    .eq("user_id", dbUser.id)
    .single()

  if (!membership) {
    redirect(`/group/join/${token}`)
  }

  // Get member count
  const { count: memberCount } = await supabase
    .from("table_members")
    .select("*", { count: "exact", head: true })
    .eq("table_id", table.id)

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
              {new Date(table.event_date).toLocaleDateString("ja-JP")}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {memberCount}人
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">タクシー・代行計算</p>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4 max-w-lg">
        <TaxiCalculator showBackLink={false} tableId={table.id} currentUserId={dbUser.id} />
      </div>
    </main>
  )
}
