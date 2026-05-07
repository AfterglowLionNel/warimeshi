"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { clearGuestSession } from "@/lib/guest/guest-session"
import { cn } from "@/lib/utils"

async function clearClientAuthCache() {
  clearGuestSession()

  try {
    if ("caches" in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Cache Storage is best-effort and may be blocked by the browser.
  }
}

async function logout(redirectTo: string) {
  await clearClientAuthCache()

  try {
    await signOut({ redirect: false, redirectTo })
  } finally {
    await fetch("/auth/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => null)
    await clearClientAuthCache()
    window.location.replace(redirectTo)
  }
}

type LogoutButtonProps = Omit<React.ComponentProps<typeof Button>, "type" | "onClick"> & {
  redirectTo?: string
  iconOnly?: boolean
}

export function LogoutButton({
  redirectTo = "/",
  iconOnly = false,
  children,
  className,
  disabled,
  ...props
}: LogoutButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const Icon = isPending ? Loader2 : LogOut

  return (
    <Button
      type="button"
      className={className}
      disabled={disabled || isPending}
      onClick={() => {
        setIsPending(true)
        void logout(redirectTo)
      }}
      {...props}
    >
      <Icon className={cn("h-4 w-4", isPending && "animate-spin")} />
      {iconOnly ? <span className="sr-only">ログアウト</span> : children ?? "ログアウト"}
    </Button>
  )
}

interface LogoutMenuItemProps {
  redirectTo?: string
  className?: string
}

export function LogoutMenuItem({ redirectTo = "/", className }: LogoutMenuItemProps) {
  const [isPending, setIsPending] = useState(false)
  const Icon = isPending ? Loader2 : LogOut

  return (
    <DropdownMenuItem
      disabled={isPending}
      className={cn("cursor-pointer text-destructive focus:text-destructive", className)}
      onSelect={(event) => {
        event.preventDefault()
        setIsPending(true)
        void logout(redirectTo)
      }}
    >
      <Icon className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
      ログアウト
    </DropdownMenuItem>
  )
}
