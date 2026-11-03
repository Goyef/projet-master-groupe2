import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

type LegalArticleProps = {
  title: string
  intro: string
  sections: { title: string; text: string }[]
}

export function LegalArticle({ title, intro, sections }: LegalArticleProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-16 sm:px-6">
      <h1 className="text-5xl font-semibold">{title}</h1>
      <Alert>
        <AlertDescription>{intro}</AlertDescription>
      </Alert>
      {sections.map((section, index) => (
        <section key={section.title} className="space-y-3">
          {index > 0 && <Separator className="mb-8" />}
          <h2 className="text-3xl font-semibold">{section.title}</h2>
          <p className="leading-relaxed text-foreground/85">{section.text}</p>
        </section>
      ))}
    </article>
  )
}
