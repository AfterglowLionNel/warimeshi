import { redirect } from "next/navigation"

export async function GET() {
  const sessionId = `solo-${Date.now()}`
  redirect(`/solo/${sessionId}`)
}
