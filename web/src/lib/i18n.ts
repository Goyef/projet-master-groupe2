export const LOCALES = ["fr", "en"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "fr"
export const LOCALE_COOKIE = "synego-locale"

export const languageNames: Record<Locale, string> = { fr: "Français", en: "English" }
export const intlLocales: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" }

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en"
}

// Respecte les priorités du navigateur, y compris les variantes en-GB, en-US et fr-CA.
export function negotiateLocale(header: string | null): Locale {
  const preferences = (header ?? "").split(",").map((entry) => {
    const [tag, ...parameters] = entry.trim().toLowerCase().split(";")
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="))
    return { locale: tag.split("-")[0], quality: quality ? Number(quality.trim().slice(2)) : 1 }
  })
  preferences.sort((a, b) => b.quality - a.quality)
  const preferred = preferences.find((item) => isLocale(item.locale) && item.quality > 0 && item.quality <= 1)
  return preferred && isLocale(preferred.locale) ? preferred.locale : DEFAULT_LOCALE
}
