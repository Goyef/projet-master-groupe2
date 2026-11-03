import { texts } from "./texts"
import { english } from "./en"
import type { Locale } from "../lib/i18n"

export function getDictionary(locale: Locale) {
  return locale === "en" ? english : texts
}
