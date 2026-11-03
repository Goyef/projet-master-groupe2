import type { Metadata } from "next"

import { LegalArticle } from "@/components/legal/legal-article"
import { texts as dict } from "@/content/texts"

export const metadata: Metadata = { title: dict.legal.noticeTitle }

export default function LegalPage() {
  const { legal } = dict
  return (
    <LegalArticle
      title={legal.noticeTitle}
      intro={legal.noticeIntro}
      updatedAt={legal.updatedAt}
      sections={legal.noticeSections}
    />
  )
}
