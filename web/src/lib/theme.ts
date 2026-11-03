// Apparence du site : un thème (couleurs, polices, arrondis) et un mode clair ou sombre.
// Le thème est porté par l'attribut `data-theme` de <html>, le mode sombre par la classe `dark`
// (variantes déclarées dans `src/app/globals.css`).

export const THEMES = ["classique", "elegant", "moderne"] as const
export const MODES = ["light", "dark"] as const
export type Theme = (typeof THEMES)[number]
export type Mode = (typeof MODES)[number]

export const DEFAULT_THEME: Theme = "classique"
export const DEFAULT_MODE: Mode = "light"

const THEME_KEY = "synego-theme"
const MODE_KEY = "synego-mode"
let lastAppearance: { theme: Theme; mode: Mode } | undefined

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme)
const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode)

// Exécuté dans <head> avant l'affichage : évite un flash de l'apparence par défaut.
export const themeScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_KEY}");var m=localStorage.getItem("${MODE_KEY}");if(${JSON.stringify(THEMES)}.indexOf(t)>-1)d.dataset.theme=t;var dark=m==="dark";d.classList.toggle("dark",dark);d.style.colorScheme=dark?"dark":"light"}catch(e){}})()`

// Apparence actuellement appliquée (lue sur <html>).
export function readAppearance(): { theme: Theme; mode: Mode } {
  if (typeof document === "undefined") return { theme: DEFAULT_THEME, mode: DEFAULT_MODE }
  const root = document.documentElement
  return {
    theme: isTheme(root.dataset.theme) ? root.dataset.theme : DEFAULT_THEME,
    mode: root.classList.contains("dark") ? "dark" : "light",
  }
}

// Le layout peut être recréé lors d'un changement de langue. La mémoire garde aussi
// le choix courant si le navigateur refuse l'accès au stockage.
export function readSavedAppearance(): { theme: Theme; mode: Mode } {
  const fallback = lastAppearance ?? readAppearance()
  try {
    const theme = localStorage.getItem(THEME_KEY)
    const mode = localStorage.getItem(MODE_KEY)
    return {
      theme: isTheme(theme) ? theme : fallback.theme,
      mode: isMode(mode) ? mode : fallback.mode,
    }
  } catch {
    return fallback
  }
}

export function restoreAppearance() {
  const { theme, mode } = readSavedAppearance()
  applyAppearance(theme, mode)
}

// Applique l'apparence et la mémorise dans le navigateur.
export function applyAppearance(theme: Theme, mode: Mode) {
  lastAppearance = { theme, mode }
  const root = document.documentElement
  root.dataset.theme = isTheme(theme) ? theme : DEFAULT_THEME
  root.classList.toggle("dark", mode === "dark")
  root.style.colorScheme = isMode(mode) ? mode : DEFAULT_MODE
  try {
    localStorage.setItem(THEME_KEY, theme)
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour la page en cours.
  }
}
