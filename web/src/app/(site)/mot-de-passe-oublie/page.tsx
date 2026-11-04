import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/account/password-reset-forms"
import { canonicalUrl, getTexts } from "@/lib/i18n-server"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.passwordReset.forgotMetaTitle, alternates: canonicalUrl("/mot-de-passe-oublie") }
}

export default async function ForgotPasswordPage() {
  const dict = await getTexts()
  return (
    <section className="mx-auto flex max-w-6xl justify-center px-4 py-16 sm:px-6">
      <ForgotPasswordForm dict={dict.passwordReset} labels={dict.portal} networkError={dict.errors.network} />
    </section>
  )
}
