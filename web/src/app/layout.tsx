import type { Metadata } from "next"
import { Cormorant_Garamond, Inter, Manrope, Playfair_Display, Source_Sans_3 } from "next/font/google"

import { siteConfig } from "@/config/site"
import { LocaleProvider } from "@/components/i18n/locale-provider"
import { ThemeScript } from "@/components/layout/theme-script"
import { getLocale, getTexts } from "@/lib/i18n-server"
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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const texts = await getTexts()
  return {
    title: {
      default: siteConfig.name,
      template: `%s · ${siteConfig.name}`,
    },
    description: texts.meta.description,
    // Ajout à l'écran d'accueil depuis Safari : nom sous l'icône et ouverture en plein écran.
    appleWebApp: {
      title: siteConfig.name,
      capable: true,
      statusBarStyle: "default",
    },
    openGraph: {
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_GB",
      alternateLocale: locale === "fr" ? "en_GB" : "fr_FR",
      siteName: siteConfig.name,
    },
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale()
  return (
    // Le script ci-dessous applique le thème enregistré avant l'affichage : les attributs
    // de <html> peuvent donc différer du rendu serveur.
    <html lang={locale} data-theme="classique" className={`${fonts} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  )
}
