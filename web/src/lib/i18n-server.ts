import "server-only"

import { cache } from "react"
import { cookies, headers } from "next/headers"
import type { Metadata } from "next"

import { getDictionary } from "@/content/dictionaries"
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "@/lib/i18n"

export const getLocale = cache(async () => {
  const preference = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(preference)) return preference
  return negotiateLocale((await headers()).get("accept-language"))
})

export async function getTexts() {
  return getDictionary(await getLocale())
}

// Un domaine explicite évite de publier des URL de référencement pointant vers localhost.
export function canonicalUrl(path: string): Metadata["alternates"] {
  if (!process.env.NEXT_PUBLIC_SITE_URL) return undefined
  const base = new URL(process.env.NEXT_PUBLIC_SITE_URL)
  return { canonical: new URL(path, base).toString() }
}
