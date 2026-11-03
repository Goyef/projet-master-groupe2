import Link from "next/link"

import { Logo } from "@/components/layout/logo"
import { legalNav, mainNav, siteConfig } from "@/config/site"
import { getTexts } from "@/lib/i18n-server"

export async function SiteFooter() {
  const dict = await getTexts()
  return (
    <footer className="mt-auto border-t bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <Logo href="/" className="[&_img]:rounded-full [&_img]:bg-brand-ivory" />
          <p className="max-w-xs text-sm text-primary-foreground/75">{dict.meta.description}</p>
        </div>
        <nav aria-label={dict.footer.pages} className="flex flex-col gap-2 text-sm">
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:underline">
              {dict.nav[item.key]}
            </Link>
          ))}
          <Link href="/connexion" className="hover:underline">
            {dict.nav.clientArea}
          </Link>
        </nav>
        <nav aria-label={dict.footer.legal} className="flex flex-col gap-2 text-sm">
          {legalNav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:underline">
              {dict.footer[item.key]}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-primary-foreground/15 py-4 text-center text-xs text-primary-foreground/60">
        © <CurrentYear /> {siteConfig.name}. {dict.footer.rights}
      </div>
    </footer>
  )
}

function CurrentYear() {
  return new Date().getFullYear()
}
