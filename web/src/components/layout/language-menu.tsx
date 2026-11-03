"use client"

import Image from "next/image"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { useLocale } from "@/components/i18n/locale-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Texts } from "@/content/texts"
import { isLocale, languageNames, LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n"

function Flag({ locale }: { locale: Locale }) {
  return <Image src={`/flags/${locale}.svg`} alt="" width={24} height={16} className="h-4 w-6 rounded-xs ring-1 ring-foreground/15" />
}

export function LanguageMenu({ dict }: { dict: Texts["language"] }) {
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function change(value: unknown) {
    if (!isLocale(value)) return
    document.cookie = `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`
    setOpen(false)
    if (value === locale) return
    startTransition(() => router.refresh())
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="gap-2 px-2" disabled={pending} aria-label={`${dict.open} · ${languageNames[locale]}`} title={dict.open} />}
      >
        <Flag locale={locale} />
        <span aria-hidden="true" className="text-xs font-semibold uppercase">{locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{dict.label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={change}>
            {LOCALES.map((language) => (
              <DropdownMenuRadioItem key={language} value={language} lang={language} className="gap-3 py-2.5">
                <Flag locale={language} />
                {languageNames[language]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
