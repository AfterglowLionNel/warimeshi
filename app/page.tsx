import Link from "next/link"
import { auth } from "@/lib/auth"
import { HeroSection } from "@/components/landing/hero-section"
import { JoinSection } from "@/components/landing/join-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { AccountMenu } from "@/components/layout/account-menu"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await auth()

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">warimeshi</span>
          </Link>
          <AccountMenu session={session} />
        </div>
      </header>

      {/* Hero Section */}
      <HeroSection />

      {/* Join Section - QR/URL input for PWA users */}
      <JoinSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            warimeshi - 飲み会の会計をスマートに
          </p>
        </div>
      </footer>
    </main>
  )
}
