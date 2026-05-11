import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { users, tableMembers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { tableEvents, type TableEvent } from "@/lib/events/table-events"
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions"

const GUEST_COOKIE_NAME = "wm_guest_token"

async function resolveUserId(_request: Request): Promise<string | null> {
  const session = await auth()

  if (session?.user?.id) {
    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (dbUser) return dbUser.id
  }

  // ゲストトークンは HttpOnly Cookie から読む。
  // 以前は URL クエリ (?token=) で渡していたが、Nginx / Next.js / アクセスログに
  // 平文で残るリスクがあったため Cookie ベースに移行した。
  const cookieStore = await cookies()
  const guestToken = cookieStore.get(GUEST_COOKIE_NAME)?.value
  if (guestToken) {
    const guestUserId = await resolveUserIdFromGuestToken(guestToken)
    if (guestUserId) return guestUserId
  }

  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tableId } = await params
  const userId = await resolveUserId(request)

  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Verify membership
  const [member] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, userId)))
    .limit(1)

  if (!member) {
    return new Response("Forbidden", { status: 403 })
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let pingInterval: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", tableId, timestamp: Date.now() })}\n\n`))

      // Subscribe to table events
      unsubscribe = tableEvents.subscribeToTable(tableId, (event: TableEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Stream closed
        }
      })

      // Keep-alive ping every 30 seconds
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // Stream closed
        }
      }, 30000)
    },
    cancel() {
      if (unsubscribe) unsubscribe()
      if (pingInterval) clearInterval(pingInterval)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
