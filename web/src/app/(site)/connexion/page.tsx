import type { Metadata } from "next"

import { ClientArea } from "@/components/account/client-area"
import { bookingDictionary } from "@/components/booking/booking-dictionary"
import { texts as dict } from "@/content/texts"

export const metadata: Metadata = { title: dict.portal.metaTitle }

export default function LoginPage() {
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
