import type { Metadata } from "next"
import { Cormorant_Garamond, Inter, Manrope, Playfair_Display, Source_Sans_3 } from "next/font/google"

import { siteConfig } from "@/config/site"
import { texts } from "@/content/texts"
import { themeScript } from "@/lib/theme"
import "./globals.css"

// Thème « Classique » (par défaut).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

// Polices des thèmes « Élégant » et « Moderne » : chargées seulement quand le thème est choisi.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  preload: false,
})

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  preload: false,
})

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  preload: false,
})

const fonts = [inter, cormorant, playfair, sourceSans, manrope].map((font) => font.variable).join(" ")

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: texts.meta.description,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: siteConfig.name,
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Le script ci-dessous applique le thème enregistré avant l'affichage : les attributs
    // de <html> peuvent donc différer du rendu serveur.
    <html lang="fr" data-theme="classique" className={`${fonts} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
