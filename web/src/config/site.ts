import type { Texts } from "@/content/texts"

export const siteConfig = {
  name: "Synégo",
  // Formats de rendez-vous proposés à la réservation. Le présentiel reste à confirmer avec Youcef :
  // l'ajouter ici (["visio", "presentiel"]) suffit à l'afficher dans le formulaire.
  meetingFormats: ["visio"] as const satisfies readonly ("visio" | "presentiel")[],
}

export type NavKey = keyof Texts["nav"]

export const mainNav = [
  { key: "home", href: "/" },
  { key: "seminars", href: "/seminaires" },
  { key: "booking", href: "/rendez-vous" },
] as const satisfies readonly { key: NavKey; href: string }[]

export const legalNav = [
  { key: "legalNotice", href: "/mentions-legales" },
  { key: "privacy", href: "/confidentialite" },
] as const satisfies readonly { key: keyof Texts["footer"]; href: string }[]
