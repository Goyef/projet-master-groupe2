"use client"

import { createContext, useCallback, useContext, useLayoutEffect } from "react"

import { formatDateTime } from "@/lib/format"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n"
import { restoreAppearance } from "@/lib/theme"

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  // Réapplique le choix avant l'affichage lorsque le layout change de langue.
  useLayoutEffect(restoreAppearance, [locale])
  return <LocaleContext value={locale}>{children}</LocaleContext>
}

export function useLocale() {
  return useContext(LocaleContext)
}

export function useDateFormatter() {
  const locale = useLocale()
  return useCallback((value: number | Date) => formatDateTime(value, locale), [locale])
}

// La langue affichée prime sur celle du navigateur pour les messages de l'API.
export function useLocalizedFetch() {
  const locale = useLocale()
  return useCallback((input: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set("Accept-Language", locale)
    return fetch(input, { ...init, headers })
  }, [locale])
}
