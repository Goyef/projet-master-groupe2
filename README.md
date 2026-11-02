# Site vitrine — cabinet de psychologie

Maquette scolaire responsive réalisée avec **Next.js** (App Router, TypeScript), suivant la palette et le logo fournis par le client. Déployable directement sur Vercel.

## Lancer le projet

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de production
npm start       # sert le build
```

## Déployer sur Vercel

Importer le dépôt sur [vercel.com/new](https://vercel.com/new) : le framework Next.js est détecté automatiquement, aucune configuration n’est nécessaire.

## Structure

```
app/
  layout.tsx        Métadonnées, langue, styles globaux
  page.tsx          Assemblage des sections
  globals.css       Styles (palette client en variables CSS)
components/
  Header, Hero, Values, Approach, Services,
  Booking, BookingPanel (client), Faq, Closing, Footer (client, modale)
public/
  logo.png
dist/               Ancienne version statique HTML/CSS/JS (conservée pour référence)
```

## Palette

| Nom | Hex | Pantone |
| --- | --- | --- |
| Bleu profond | `#0A1D35` | 296 C |
| Ivoire / Blanc cassé | `#F2E8DC` | Warm Gray 1 C |
| Bleu clair | `#6CAED6` | 2905 C |
| Champagne / doré pâle | `#D9C9B4` | 7500 C |
| Bleu diamant | `#D0E7F5` | 656 C |

## Contenu

Accueil, approche, accompagnements, FAQ et parcours de rendez-vous simulé. Le calendrier ne réserve aucun créneau et ne collecte aucune donnée personnelle.

Le nom du praticien, ses qualifications, ses coordonnées, ses tarifs et les textes définitifs restent à valider avec le client.
