import type { Metadata } from "next"

import { LegalArticle } from "@/components/legal/legal-article"
import { getTexts, canonicalUrl } from "@/lib/i18n-server"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.legal.noticeTitle, alternates: canonicalUrl("/mentions-legales") }
}

export default async function LegalPage() {
  const dict = await getTexts()
  const { legal } = dict
  return <LegalArticle title={legal.noticeTitle} intro={legal.noticeIntro} sections={legal.noticeSections} />
}
