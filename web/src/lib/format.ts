import { intlLocales, type Locale } from "./i18n"

export const TIME_ZONE = "Europe/Paris"

export function formatDateTime(value: number | Date, locale: Locale = "fr") {
  return new Date(value).toLocaleString(intlLocales[locale], {
    timeZone: TIME_ZONE,
    dateStyle: "full",
    timeStyle: "short",
  })
}

// Remplace les {variables} d'un texte : format("Bonjour {name}", { name: "Youcef" }).
export function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}
