import Link from "next/link"

import { Logo } from "@/components/layout/logo"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { mainNav } from "@/config/site"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          {mainNav.map((item) => (
            <Button key={item.href} variant="ghost" render={<Link href={item.href} />} nativeButton={false}>
              {item.title}
            </Button>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" render={<Link href="/connexion" />} nativeButton={false}>
            Espace client
          </Button>
          <Button render={<Link href="/rendez-vous" />} nativeButton={false}>
            Prendre rendez-vous
          </Button>
        </div>
        <MobileNav />
      </div>
    </header>
  )
}
