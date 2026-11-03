import type { Metadata } from "next"

import { LegalArticle } from "@/components/legal/legal-article"
import { texts as dict } from "@/content/texts"

export const metadata: Metadata = { title: dict.legal.privacyTitle }

export default function PrivacyPage() {
  const { legal } = dict
  return <LegalArticle title={legal.privacyTitle} intro={legal.privacyIntro} sections={legal.privacySections} />
}
