import { createBrowserClient } from "@supabase/ssr"
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options"

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getAuthCookieOptions(),
    },
  )

  return supabaseInstance
}
