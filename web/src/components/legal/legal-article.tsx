import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

type LegalArticleProps = {
  title: string
  intro: string
  updatedAt?: string
  // `items` : liste à puces facultative affichée sous le texte de la section.
  sections: { title: string; text: string; items?: readonly string[] }[]
}

export function LegalArticle({ title, intro, updatedAt, sections }: LegalArticleProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-16 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-5xl font-semibold">{title}</h1>
        {updatedAt && <p className="text-sm text-muted-foreground">{updatedAt}</p>}
      </div>
      <Alert>
        <AlertDescription>{intro}</AlertDescription>
      </Alert>
      {sections.map((section, index) => (
        <section key={section.title} className="space-y-3">
          {index > 0 && <Separator className="mb-8" />}
          <h2 className="text-3xl font-semibold">{section.title}</h2>
          <p className="leading-relaxed text-foreground/85">{section.text}</p>
          {section.items && (
            <ul className="ml-5 list-disc space-y-2 leading-relaxed text-foreground/85">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  )
}
