import Link from "next/link"

import { Button } from "@/components/ui/button"
import { texts as dict } from "@/content/texts"

export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-start gap-6 rounded-2xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-12">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{dict.cta.title}</h2>
          <p className="max-w-xl text-primary-foreground/75">{dict.cta.text}</p>
        </div>
        <Button
          size="lg"
          variant="secondary"
          render={<Link href="/rendez-vous" />}
          nativeButton={false}
          className="h-11 px-5"
        >
          {dict.cta.button}
        </Button>
      </div>
    </section>
  )
}
