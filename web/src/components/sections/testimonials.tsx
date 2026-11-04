import { QuoteIcon } from "lucide-react"
import { cn } from "cn"

import { Card, CardContent } from "@/components/ui/card"
import type { Testimonial } from "@/content/texts"

type TestimonialsProps = {
  eyebrow: string
  title: string
  items: readonly Testimonial[]
  id?: string
  className?: string
}

// Section réutilisable (accueil, séminaires) : rien n'est affiché tant que la liste est vide.
export function Testimonials({ eyebrow, title, items, id, className }: TestimonialsProps) {
  if (items.length === 0) return null
  const headingId = `${id ?? "temoignages"}-titre`

  return (
    <section id={id} aria-labelledby={headingId} className={cn("mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6", className)}>
      <div className="mb-10 space-y-2">
        <p className="text-sm font-medium tracking-widest text-brand-sky uppercase">{eyebrow}</p>
        <h2 id={headingId} className="text-4xl font-semibold">
          {title}
        </h2>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li key={`${item.author}-${index}`}>
            <Card className="h-full">
              <CardContent className="h-full">
                <figure className="flex h-full flex-col gap-4">
                  <QuoteIcon className="size-6 text-brand-sky" aria-hidden />
                  <blockquote className="flex-1 text-base leading-relaxed text-foreground">
                    <p>{item.quote}</p>
                  </blockquote>
                  <figcaption className="flex flex-col gap-0.5">
                    <span className="font-medium">{item.author}</span>
                    {item.context && <span className="text-muted-foreground">{item.context}</span>}
                  </figcaption>
                </figure>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
