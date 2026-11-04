import type { Metadata } from "next"

import { ResetPasswordForm } from "@/components/account/password-reset-forms"
import { getTexts } from "@/lib/i18n-server"

// Le jeton est dans l'adresse : la page n'est pas indexée et ne transmet pas son adresse
// (référent) aux liens qu'elle contient.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.passwordReset.resetMetaTitle, robots: { index: false }, referrer: "no-referrer" }
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reinitialiser-mot-de-passe">) {
  const [dict, params] = await Promise.all([getTexts(), searchParams])
  const token = typeof params.token === "string" ? params.token : ""
  return (
    <section className="mx-auto flex max-w-6xl justify-center px-4 py-16 sm:px-6">
      <ResetPasswordForm
        dict={dict.passwordReset}
        labels={dict.portal}
        networkError={dict.errors.network}
        token={token}
      />
    </section>
  )
}
