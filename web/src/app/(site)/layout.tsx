import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { getTexts } from "@/lib/i18n-server"

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const dict = await getTexts()
  return (
    <>
      <div className="bg-primary px-4 py-2 text-center text-xs text-primary-foreground">{dict.common.demoNotice}</div>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
