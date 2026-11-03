"use client"

import { useSyncExternalStore } from "react"
import { themeScript } from "@/lib/theme"

const subscribe = () => () => {}
const clientSnapshot = () => false
const serverSnapshot = () => true

// Le script s'exécute dans le HTML initial, avant l'affichage. Il n'est pas
// réinséré lors des navigations : LocaleProvider restaure alors l'apparence.
export function ThemeScript() {
  const initialDocument = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  return initialDocument ? <script dangerouslySetInnerHTML={{ __html: themeScript }} /> : null
}
