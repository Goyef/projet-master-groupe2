import type { Metadata } from "next"

import { WaitlistUnsubscribe } from "@/components/booking/waitlist-unsubscribe"
import { getTexts } from "@/lib/i18n-server"

// Le jeton est dans l'adresse : la page n'est pas indexée et ne transmet pas son adresse
// (référent) aux liens qu'elle contient.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.waitlist.metaTitle, robots: { index: false }, referrer: "no-referrer" }
}

export default async function WaitlistUnsubscribePage({ searchParams }: PageProps<"/liste-attente/desinscription">) {
  const [dict, params] = await Promise.all([getTexts(), searchParams])
  const token = typeof params.token === "string" ? params.token : ""
  return (
    <section className="mx-auto flex max-w-6xl justify-center px-4 py-16 sm:px-6">
      <WaitlistUnsubscribe dict={dict.waitlist} networkError={dict.errors.network} token={token} />
    </section>
  )
}
