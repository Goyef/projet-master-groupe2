import Link from "next/link"
import { cookies } from "next/headers"

import { Logo } from "@/components/layout/logo"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ThemeMenu } from "@/components/layout/theme-menu"
import { LanguageMenu } from "@/components/layout/language-menu"
import { Button } from "@/components/ui/button"
import { mainNav } from "@/config/site"
import { getTexts } from "@/lib/i18n-server"
import { currentUser, type User } from "@/lib/store"

// Compte connecté, s'il y en a un. Une base indisponible ne doit pas casser l'en-tête :
// le visiteur voit alors simplement « Se connecter ».
// Le cookie est lu hors du try : Next.js signale par une exception qu'il doit rendre la page
// à chaque requête, et ce signal ne doit pas être intercepté. Seule une erreur de base est rattrapée.
async function signedInUser(): Promise<User | null> {
  const token = (await cookies()).get("session")?.value
  if (!token) return null
  try {
    return await currentUser(token)
  } catch (error) {
    console.error("[en-tête] session illisible :", error)
    return null
  }
}

export async function SiteHeader() {
  const [dict, user] = await Promise.all([getTexts(), signedInUser()])
  const items = mainNav.map((item) => ({ title: dict.nav[item.key], href: item.href }))
  // « Se connecter » pour un visiteur, « Espace client » (ou « Espace gérant ») une fois connecté.
  const clientArea = {
    title: !user ? dict.nav.login : user.role === "admin" ? dict.nav.adminArea : dict.nav.clientArea,
    href: "/connexion",
  }

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
