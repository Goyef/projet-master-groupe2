import Link from "next/link"

import { Logo } from "@/components/layout/logo"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ThemeMenu } from "@/components/layout/theme-menu"
import { Button } from "@/components/ui/button"
import { mainNav } from "@/config/site"
import { texts as dict } from "@/content/texts"

export function SiteHeader() {
  const items = mainNav.map((item) => ({ title: dict.nav[item.key], href: item.href }))
  const clientArea = { title: dict.nav.clientArea, href: "/connexion" }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo href="/" />
        <nav aria-label={dict.nav.mainLabel} className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Button key={item.href} variant="ghost" render={<Link href={item.href} />} nativeButton={false}>
              {item.title}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" render={<Link href={clientArea.href} />} nativeButton={false}>
              {clientArea.title}
            </Button>
            <Button render={<Link href="/rendez-vous" />} nativeButton={false}>
              {dict.nav.bookCta}
            </Button>
          </div>
          {/* Thème et mode clair / sombre, visible sur ordinateur comme sur mobile. */}
          <ThemeMenu dict={dict.theme} />
          <div className="md:hidden">
            <MobileNav
              items={[...items, clientArea]}
              labels={{ menu: dict.nav.menu, open: dict.nav.openMenu, nav: dict.nav.mobileLabel }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
