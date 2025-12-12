import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SettingsForm } from "@/components/settings/settings-form"

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/settings")
  }

  const { data: dbUser } = await supabase.from("users").select("*").eq("firebase_uid", user.id).single()

  if (!dbUser) {
    redirect("/auth/error?error=user_not_found")
  }

  return <SettingsForm user={dbUser} />
}
