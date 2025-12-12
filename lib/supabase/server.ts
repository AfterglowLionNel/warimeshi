import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options"

export async function createClient(response?: NextResponse) {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
            response?.cookies.set(name, value, options)
          })
        } catch {
          // Called from Server Component - middleware handles refresh
        }
      },
    },
  })
}
