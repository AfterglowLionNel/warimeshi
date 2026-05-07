"use client"

import Image from "next/image"
import Link from "next/link"
import type { Session } from "next-auth"
import { Button } from "@/components/ui/button"
import { LogoutMenuItem } from "@/components/auth/logout-control"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, Settings, LogIn } from "lucide-react"

interface AccountMenuProps {
  session: Session | null
}

export function AccountMenu({ session }: AccountMenuProps) {
  if (!session?.user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/auth/login">
          <LogIn className="h-4 w-4 mr-2" />
          ログイン
        </Link>
      </Button>
    )
  }

  const initial = session.user.name?.charAt(0) || session.user.email?.charAt(0) || "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 rounded-full"
              unoptimized
            />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">{initial}</span>
            </div>
          )}
          <span className="hidden sm:inline max-w-24 truncate">
            {session.user.name || session.user.email?.split("@")[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">
            {session.user.name || "ユーザー"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {session.user.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/group" className="cursor-pointer">
            <User className="h-4 w-4 mr-2" />
            ダッシュボード
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="h-4 w-4 mr-2" />
            設定
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LogoutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
