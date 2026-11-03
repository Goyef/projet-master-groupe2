"use client"

import { useState } from "react"
import { MoonIcon, PaletteIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Texts } from "@/content/texts"
import { applyAppearance, MODES, readSavedAppearance, THEMES, type Mode, type Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"

// Pastilles de couleur et police de titre de chaque thème, pour les reconnaître dans le menu.
const previews: Record<Theme, { swatches: string[]; font: string }> = {
  classique: { swatches: ["bg-brand-ivory", "bg-brand-navy"], font: "font-(family-name:--font-cormorant) text-base" },
  elegant: { swatches: ["bg-brand-champagne", "bg-brand-navy"], font: "font-(family-name:--font-playfair)" },
  moderne: { swatches: ["bg-brand-diamond", "bg-brand-sky"], font: "font-(family-name:--font-manrope) font-semibold" },
}

const modeIcons: Record<Mode, typeof SunIcon> = { light: SunIcon, dark: MoonIcon }

// Menu d'apparence : thème (couleurs, polices) et mode clair ou sombre, dans un seul menu.
export function ThemeMenu({ dict }: { dict: Texts["theme"] }) {
  const [appearance, setAppearance] = useState(readSavedAppearance)

  function change(next: Partial<typeof appearance>) {
    const value = { ...appearance, ...next }
    applyAppearance(value.theme, value.mode)
    setAppearance(value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={dict.open} title={dict.open} />}>
        <PaletteIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{dict.themeLegend}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={appearance.theme} onValueChange={(theme) => change({ theme: theme as Theme })}>
            {THEMES.map((theme) => (
              <DropdownMenuRadioItem key={theme} value={theme} className="gap-3 py-2">
                <span className="flex -space-x-1.5" aria-hidden="true">
                  {previews[theme].swatches.map((swatch) => (
                    <span key={swatch} className={cn("size-4 rounded-full border border-foreground/20 ring-2 ring-popover", swatch)} />
                  ))}
                </span>
                <span className="flex flex-col">
                  <span className={previews[theme].font}>{dict.themes[theme].name}</span>
                  <span className="text-xs text-muted-foreground">{dict.themes[theme].description}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{dict.modeLegend}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={appearance.mode} onValueChange={(mode) => change({ mode: mode as Mode })}>
            {MODES.map((mode) => {
              const Icon = modeIcons[mode]
              return (
                <DropdownMenuRadioItem key={mode} value={mode}>
                  <Icon />
                  {dict.modes[mode]}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
