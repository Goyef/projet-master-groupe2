import type { Metadata } from "next"

import { LegalArticle } from "@/components/legal/legal-article"
import { getTexts, canonicalUrl } from "@/lib/i18n-server"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.legal.privacyTitle, alternates: canonicalUrl("/confidentialite") }
}

export default async function PrivacyPage() {
  const dict = await getTexts()
  const { legal } = dict
  return (
    <LegalArticle
      title={legal.privacyTitle}
      intro={legal.privacyIntro}
      updatedAt={legal.updatedAt}
      sections={legal.privacySections}
    />
  )
}
