# Site web séminaires — application Next.js

Socle technique du site : **Next.js 16** (App Router, TypeScript), **Tailwind CSS 4** et **shadcn/ui** (Base UI). Seule la landing page (accueil) est en place : les autres pages et fonctionnalités sont à construire par l'équipe.

## Démarrer

```bash
pnpm install
pnpm dev
```

Puis ouvrir http://localhost:3000.

| Commande     | Rôle                         |
| ------------ | ---------------------------- |
| `pnpm dev`   | Serveur de développement     |
| `pnpm build` | Build de production          |
| `pnpm start` | Lance le build de production |
| `pnpm lint`  | Vérification ESLint          |

## Ajouter un composant shadcn

Sont installés : `Button`, `Badge`, `Card`, `Sheet`. Ajouter les autres au besoin :

```bash
pnpm dlx shadcn@latest add card input label
```

Les composants arrivent dans `src/components/ui/`. Catalogue : https://ui.shadcn.com/docs/components

## Structure

```
src/
├── app/
│   ├── layout.tsx          # Layout racine (polices, métadonnées)
│   ├── globals.css         # Thème : palette du gérant
│   └── (site)/             # Pages publiques, avec en-tête et pied de page
│       ├── layout.tsx
│       └── page.tsx        # Landing page (accueil)
├── components/
│   ├── layout/             # En-tête, pied de page, logo, menu mobile
│   ├── sections/           # Blocs de page réutilisables
│   └── ui/                 # Composants shadcn
├── config/site.ts          # Nom du site, liens de navigation, thématiques
└── lib/utils.ts            # Helper cn()
public/brand/               # Logo du gérant
```

Une page = un dossier dans `src/app/(site)/` contenant un `page.tsx` (ex. `src/app/(site)/seminaires/page.tsx` → `/seminaires`). Elle hérite automatiquement de l'en-tête et du pied de page.

### Pages à créer

Les liens de l'en-tête et du pied de page (`src/config/site.ts`) pointent déjà vers ces adresses, qui renvoient une 404 tant que la page n'existe pas :

| Adresse             | Contenu attendu                                |
| ------------------- | ---------------------------------------------- |
| `/seminaires`       | Offre d'organisation de séminaires             |
| `/rendez-vous`      | Prise de rendez-vous prospects                 |
| `/connexion`        | Connexion des clients signés et du gérant      |
| `/mentions-legales` | Mentions légales                               |
| `/confidentialite`  | Politique de confidentialité (RGPD)            |

Les textes de la landing page sont des propositions à faire valider par le gérant, et le nom « Cabinet Séminaires » est provisoire.

## Identité visuelle

La palette est déclarée dans `src/app/globals.css`. Les variables shadcn (`bg-primary`, `bg-background`, `text-muted-foreground`…) l'utilisent déjà, et chaque couleur est aussi disponible directement (`bg-brand-navy`, `text-brand-sky`…).

| Couleur      | Hex       | Pantone       | Classe Tailwind    |
| ------------ | --------- | ------------- | ------------------ |
| Bleu profond | `#0A1D35` | 296 C         | `brand-navy`       |
| Ivoire       | `#F2E8DC` | Warm Gray 1 C | `brand-ivory`      |
| Bleu clair   | `#6CAED6` | 2905 C        | `brand-sky`        |
| Champagne    | `#D9C9B4` | 7500 C        | `brand-champagne`  |
| Bleu diamant | `#D0E7F5` | 656 C         | `brand-diamond`    |

Polices : **Inter** pour le texte (`font-sans`), **Cormorant Garamond** pour les titres (`font-heading`, appliquée par défaut aux `h1`–`h3`).

Logo : `public/brand/logo.png` (fond blanc) et `public/brand/logo-transparent.png`.
