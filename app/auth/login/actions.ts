"use server"

import { signIn } from "@/auth"
import { redirect } from "next/navigation"

export async function signInWithGoogle() {
  try {
    await signIn("google", { redirectTo: "/group" })
  } catch (error) {
    // Auth.js throws a NEXT_REDIRECT error on success
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error
    }
    console.error("Google signIn error:", error)
    redirect("/auth/error?error=Configuration")
  }
}

export async function signInWithLine() {
  try {
    await signIn("line", { redirectTo: "/group" })
  } catch (error) {
    // Auth.js throws a NEXT_REDIRECT error on success
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error
    }
    console.error("LINE signIn error:", error)
    redirect("/auth/error?error=Configuration")
  }
}
