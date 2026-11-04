import type { Metadata } from "next"
import { cookies } from "next/headers"
import Link from "next/link"
import { CheckIcon } from "lucide-react"

import { BookingForm } from "@/components/booking/booking-form"
import { bookingDictionary } from "@/components/booking/booking-dictionary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getTexts, canonicalUrl } from "@/lib/i18n-server"
import { currentUser } from "@/lib/store"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.booking.metaTitle, alternates: canonicalUrl("/rendez-vous") }
}

// Compte connecté, pour préremplir la liste d'attente. Le cookie est lu hors du try (signal de
// rendu dynamique de Next.js) ; une base indisponible ne doit pas casser la page.
async function signedInUser() {
  const token = (await cookies()).get("session")?.value
  if (!token) return null
  try {
    return await currentUser(token)
  } catch (error) {
    console.error("[rendez-vous] session illisible :", error)
    return null
  }
}

export default async function BookingPage() {
  const [dict, user] = await Promise.all([getTexts(), signedInUser()])
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
        <BookingForm
          dict={bookingDictionary(dict)}
          waitlist={user ? { email: user.email, client: user.role === "client" } : undefined}
        />
      </div>
    </section>
  )
}
