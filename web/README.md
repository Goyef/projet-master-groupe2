# Site web séminaires — application Next.js

Socle technique du site : **Next.js 16** (App Router, TypeScript), **Tailwind CSS 4** et **shadcn/ui** (Base UI). Le site comprend les pages publiques, la réservation et les espaces client et gérant.

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

### Pages disponibles

Les liens de navigation donnent accès aux pages suivantes :

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


## Fonctionnalités du cahier des charges

# Site web séminaires

Branche `feature/seminaires-cahier-des-charges`, créée depuis `develop` au commit `ab268a2`.

Application Next.js 16, React et TypeScript. La charte et le logo sont conservés ; le site est recentré sur les séminaires conformément au cahier des charges et aux réponses du client.

## Démarrer

Node.js 24.15 ou supérieur est requis pour le module SQLite natif.

```sh
pnpm install --frozen-lockfile
```

Copier `.env.example` vers `.env.local`, puis définir `ADMIN_EMAIL` et un `ADMIN_PASSWORD` unique d’au moins 12 caractères. Ne jamais commiter ces valeurs. Au premier accès à l’API, le compte gérant est créé si aucun gérant n’existe. Modifier ensuite la variable ne change pas le mot de passe du compte déjà créé.

```sh
pnpm dev
```

Ouvrir http://localhost:3000. Le gérant se connecte sur `/connexion`, ajoute les disponibilités, crée les comptes clients et partage les documents. Aucun créneau ou compte client fictif n’est préchargé.

```sh
pnpm build
pnpm start
```

Si le stockage de configuration de télémétrie Next.js pose problème sous Windows, définir `NEXT_TELEMETRY_DISABLED=1` dans l’environnement du processus.

## Fonctionnement

- `/` : accueil selon le design shadcn du groupe.
- `/rendez-vous` : réservation prospects sans compte.
- `/seminaires` : offre détaillée et thèmes transmis par le client.
- Appel de vente et audit : 45 minutes. L’audit est accessible aux prospects et aux clients connectés.
- Suivi réservé aux clients actifs connectés. La durée d’une heure reprend celle des séances individuelles ; l’équivalence avec le suivi reste à valider.
- Chaque disponibilité correspond à un seul rendez-vous. Les disponibilités ne peuvent pas se chevaucher. La transaction de réservation empêche deux réservations concurrentes d’un même créneau.
- Confirmation immédiate à l’écran, sans validation manuelle. Les e-mails et rappels ne sont pas implémentés car non définis dans le cahier des charges.
- `/connexion` : connexion, rendez-vous personnels et documents autorisés. Le gérant y dispose d’une vue et d’actions supplémentaires.
- Le gérant crée et désactive les comptes, consulte les rendez-vous et gère les disponibilités non réservées. Une désactivation invalide immédiatement les sessions du client.
- PDF de 5 Mo maximum, partagés avec tous les clients ou un client désigné. Les fichiers sont servis après contrôle d’accès, pas depuis le répertoire public.
- Le gérant peut marquer une séance passée comme réalisée et corriger ce statut. Une réservation n’est jamais comptée automatiquement comme une séance réalisée.

Les textes restent des propositions à valider. Le paiement et l’application mobile sont hors périmètre.

## Données et hébergement

SQLite stocke les comptes, sessions, réservations et PDF dans `.data/seminaires.sqlite`, ignoré par Git. `DATA_DIRECTORY` permet de choisir un autre répertoire privé et persistant. Les dates sont stockées en timestamps ; les rendez-vous sont affichés en heure de Paris. La saisie des disponibilités utilise le fuseau de l’appareil du gérant.

Ce stockage convient à un serveur Node avec disque persistant, sauvegardes et HTTPS. Cette version ne se déploie pas telle quelle sur un hébergement serverless à disque éphémère comme Vercel : migrer la base et les documents vers des services persistants avant un tel déploiement. Les cookies de session sont HttpOnly, SameSite=Lax et Secure en production ; les mots de passe utilisent scrypt avec un sel aléatoire. Les tentatives de connexion sont limitées par adresse de compte.

## Vérifier

Après compilation :

```sh
node --test tests/portal.test.mjs
```

Le test démarre un serveur de production sur le port 43127 avec une base temporaire indépendante. Il vérifie les routes, le contrôle d’origine, les accès gérant/client, les réservations concurrentes, les documents privés, la désactivation et la déconnexion. Aucun identifiant réel n’est utilisé.

## Points à finaliser avant ouverture au public

- Validation des textes, du nom commercial, des tarifs, des modalités et des conditions d’annulation.
- Compléter les pages légales et de confidentialité avec les informations réelles, les durées de conservation et le contact pour les demandes.
- Définir le parcours d’invitation, le changement et la récupération de mot de passe ; cette version utilise un mot de passe initial créé par le gérant.
- Définir les règles de déblocage progressif des documents : seuils, séances éligibles, absences, corrections et dérogations. Aucun seuil arbitraire n’a été codé ; le partage est manuel.
- Confirmer la durée des suivis et les règles de disponibilité.
- Préparer l’hébergement persistant, les sauvegardes et HTTPS. Utiliser des données de test tant que ces points ne sont pas finalisés.

Le projet est entièrement dans web/. Le design et les composants shadcn de develop sont conservés.