import Link from "next/link"

import { Logo } from "@/components/layout/logo"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ThemeMenu } from "@/components/layout/theme-menu"
import { LanguageMenu } from "@/components/layout/language-menu"
import { Button } from "@/components/ui/button"
import { mainNav } from "@/config/site"
import { getTexts } from "@/lib/i18n-server"

export async function SiteHeader() {
  const dict = await getTexts()
  const items = mainNav.map((item) => ({ title: dict.nav[item.key], href: item.href }))
  const clientArea = { title: dict.nav.clientArea, href: "/connexion" }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo href="/" />
        <nav aria-label={dict.nav.mainLabel} className="hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <Button key={item.href} variant="ghost" render={<Link href={item.href} />} nativeButton={false}>
              {item.title}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="outline" render={<Link href={clientArea.href} />} nativeButton={false}>
              {clientArea.title}
            </Button>
            <Button render={<Link href="/rendez-vous" />} nativeButton={false}>
              {dict.nav.bookCta}
            </Button>
          </div>
          {/* Thème et mode clair / sombre, visible sur ordinateur comme sur mobile. */}
          <ThemeMenu dict={dict.theme} />
          <LanguageMenu dict={dict.language} />
          <div className="lg:hidden">
            <MobileNav
              items={[...items, clientArea]}
              labels={{ menu: dict.nav.menu, open: dict.nav.openMenu, nav: dict.nav.mobileLabel, close: dict.common.close }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
