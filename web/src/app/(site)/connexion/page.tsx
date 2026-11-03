import type { Metadata } from "next"

import { ClientArea } from "@/components/account/client-area"
import { bookingDictionary } from "@/components/booking/booking-dictionary"
import { getTexts, canonicalUrl } from "@/lib/i18n-server"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.portal.metaTitle, alternates: canonicalUrl("/connexion") }
}

export default async function LoginPage() {
  const dict = await getTexts()
  return (
    <ClientArea
      dict={dict.portal}
      bookingDict={bookingDictionary(dict)}
      types={dict.types}
      formats={dict.formats}
      networkError={dict.errors.network}
    />
  )
}
