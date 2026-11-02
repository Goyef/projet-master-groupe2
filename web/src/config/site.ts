export const siteConfig = {
  // Nom provisoire : à remplacer par le nom commercial du gérant.
  name: "Cabinet Séminaires",
  description:
    "Organisation et animation de séminaires sur mesure : cohésion d'équipe, gestion des conflits, communication et développement personnel.",
  locale: "fr_FR",
}

export const mainNav = [
  { title: "Accueil", href: "/" },
  { title: "Séminaires", href: "/seminaires" },
  { title: "Rendez-vous", href: "/rendez-vous" },
] as const

export const legalNav = [
  { title: "Mentions légales", href: "/mentions-legales" },
  { title: "Confidentialité", href: "/confidentialite" },
] as const

// Domaines d'intervention communiqués par le gérant.
export const seminarTopics = [
  { title: "PNL", description: "Mieux communiquer et faire évoluer ses schémas de pensée." },
  { title: "MBTI", description: "Comprendre les préférences de chacun pour mieux travailler ensemble." },
  { title: "Ennéagramme", description: "Explorer ses motivations profondes et celles de son équipe." },
  { title: "Team building", description: "Renforcer la cohésion et la confiance au sein du groupe." },
  { title: "Gestion de conflit", description: "Désamorcer les tensions et retrouver un dialogue constructif." },
  { title: "Process Communication", description: "Adapter sa communication à chaque interlocuteur." },
  { title: "Gestion mentale", description: "Apprendre à apprendre et mobiliser ses ressources." },
  { title: "Estime de soi", description: "Prendre conscience de sa valeur et oser s'affirmer." },
  { title: "Déconstruction de la confiance en soi", description: "Explorer les représentations et les questionnements autour de la confiance en soi." },
] as const
