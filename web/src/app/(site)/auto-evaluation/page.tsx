import type { Metadata } from "next"
import { LockIcon } from "lucide-react"

import { SelfAssessment } from "@/components/quiz/self-assessment"
import { Badge } from "@/components/ui/badge"
import { getTexts, canonicalUrl } from "@/lib/i18n-server"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.quiz.metaTitle, description: dict.quiz.intro, alternates: canonicalUrl("/auto-evaluation") }
}

export default async function SelfAssessmentPage() {
  const dict = await getTexts()
  return (
    <section className="mx-auto max-w-3xl space-y-10 px-4 py-16 sm:px-6">
      <div className="space-y-5">
        <Badge variant="secondary">{dict.quiz.badge}</Badge>
        <h1 className="text-5xl font-semibold">{dict.quiz.title}</h1>
        <p className="text-lg text-muted-foreground">{dict.quiz.intro}</p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockIcon className="size-4 shrink-0 text-brand-sky" aria-hidden />
          {dict.quiz.privacy}
        </p>
      </div>
      <SelfAssessment dict={dict.quiz} crisis={dict.crisis} />
    </section>
  )
}
