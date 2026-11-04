import type { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"
import { texts } from "@/content/texts"

// Manifeste de l'application web : nom et icônes quand le site est ajouté à l'écran d'accueil
// (Android, ordinateur). Sur iPhone, Safari utilise l'icône `apple-icon.png` du même dossier.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: texts.meta.description,
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a1d35",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
