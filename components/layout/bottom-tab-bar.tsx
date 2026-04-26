"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, User, Users, Car, Menu } from "lucide-react"

type TabKey = "home" | "solo" | "group" | "taxi" | "menu"

const tabs: { key: TabKey; label: string; href: string; icon: typeof Home; matches: (p: string) => boolean }[] = [
  { key: "home", label: "ホーム", href: "/", icon: Home, matches: (p) => p === "/" },
  { key: "solo", label: "ソロ", href: "/solo", icon: User, matches: (p) => p.startsWith("/solo") },
  { key: "group", label: "グループ", href: "/group", icon: Users, matches: (p) => p.startsWith("/group") },
  { key: "taxi", label: "タクシー", href: "/taxi", icon: Car, matches: (p) => p.startsWith("/taxi") },
  { key: "menu", label: "メニュー", href: "/settings", icon: Menu, matches: (p) => p.startsWith("/settings") },
]

const HIDDEN_PREFIXES = ["/auth/"]

export function BottomTabBar() {
  const pathname = usePathname() ?? "/"

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null
  }

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--wm-line)] backdrop-blur-md md:hidden"
      style={{ background: "rgba(250, 250, 247, 0.92)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5">
        {tabs.map((tab) => {
          const active = tab.matches(pathname)
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold tracking-[.04em] transition-colors"
                style={{ color: active ? "var(--wm-accent)" : "var(--wm-ink-3)" }}
              >
                <tab.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span>{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
