import type { Metadata } from "next"
import Link from "next/link"
import { CheckIcon } from "lucide-react"

import { BookingForm } from "@/components/booking/booking-form"
import { bookingDictionary } from "@/components/booking/booking-dictionary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getTexts, canonicalUrl } from "@/lib/i18n-server"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.booking.metaTitle, alternates: canonicalUrl("/rendez-vous") }
}

export default async function BookingPage() {
  const dict = await getTexts()
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-6">
        <Badge variant="secondary">{dict.booking.badge}</Badge>
        <h1 className="text-5xl font-semibold">{dict.booking.title}</h1>
        <p className="text-lg text-muted-foreground">{dict.booking.intro}</p>
        <ul className="space-y-3">
          {dict.booking.facts.map((fact) => (
            <li key={fact} className="flex gap-3">
              <CheckIcon className="mt-1 size-4 shrink-0 text-brand-sky" aria-hidden />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
        <Button variant="outline" render={<Link href="/connexion" />} nativeButton={false}>
          {dict.booking.clientCta}
        </Button>
      </div>
      <div className="min-w-0">
        <BookingForm dict={bookingDictionary(dict)} />
      </div>
    </section>
  )
}
