import Link from "next/link"

import { Button } from "@/components/ui/button"

export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-start gap-6 rounded-2xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-12">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">Parlons de votre projet de séminaire</h2>
          <p className="max-w-xl text-primary-foreground/75">
            Réservez un créneau en ligne : votre rendez-vous est confirmé immédiatement.
          </p>
        </div>
        <Button
          size="lg"
          variant="secondary"
          render={<Link href="/rendez-vous" />}
          nativeButton={false}
          className="h-11 px-5"
        >
          Prendre rendez-vous
        </Button>
      </div>
    </section>
  )
}
