import { Fragment } from "react"
import { LifeBuoyIcon } from "lucide-react"

import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"
import { cn } from "@/lib/utils"

// Numéros français, identiques dans les deux langues (le texte anglais précise « in France »).
const numbers = { suicide: "3114", samu: "15", europe: "112" }

// Remplace {suicide}, {samu} et {europe} par des liens `tel:`.
function withPhoneLinks(template: string, callLabel: string) {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const number = numbers[part.slice(1, -1) as keyof typeof numbers]
    if (!number) return <Fragment key={index}>{part}</Fragment>
    return (
      <a
        key={index}
        href={`tel:${number}`}
        aria-label={format(callLabel, { number })}
        className="font-semibold underline underline-offset-4"
      >
        {number}
      </a>
    )
  })
}

// Encart sobre des ressources d'urgence : pied de page (`footer`) et résultat du questionnaire.
export function CrisisResources({
  dict,
  variant = "card",
  className,
}: {
  dict: Texts["crisis"]
  variant?: "card" | "footer"
  className?: string
}) {
  return (
    <aside
      aria-label={dict.title}
      className={cn(
        "flex gap-3 text-sm",
        variant === "card" ? "rounded-lg border bg-muted/50 p-4" : "text-primary-foreground/80",
        className,
      )}
    >
      <LifeBuoyIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className={cn("font-medium", variant === "footer" && "text-primary-foreground")}>{dict.title}</p>
        <p>{withPhoneLinks(dict.distress, dict.call)}</p>
        <p>{withPhoneLinks(dict.emergency, dict.call)}</p>
      </div>
    </aside>
  )
}
