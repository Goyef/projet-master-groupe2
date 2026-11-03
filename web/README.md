# Synégo — application Next.js

Site de Youcef (Synégo), coach-thérapeute : coaching autour du vide émotionnel en priorité, séminaires en entreprise en offre secondaire. Objectif principal : obtenir des appels découverte (appels de vente), le devis étant simulé pendant l'appel.

Socle : **Next.js 16** (App Router, TypeScript), **Tailwind CSS 4**, **shadcn/ui** (Base UI), **Postgres** via **Drizzle ORM**.

## Démarrer

Prérequis : Node.js 20.9+, pnpm 10 (`corepack enable`), Docker Desktop.

```bash
pnpm install --frozen-lockfile
pnpm db:up            # Postgres local (docker-compose.yml)
cp .env.example .env.local
```

Dans `.env.local`, définir `ADMIN_EMAIL` et un `ADMIN_PASSWORD` unique d'au moins 12 caractères (ne jamais les commiter). Le compte gérant est créé au premier accès à l'API s'il n'existe pas encore.

```bash
pnpm dev              # http://localhost:3000
```

| Commande           | Rôle                                                   |
| ------------------ | ------------------------------------------------------ |
| `pnpm dev`         | Serveur de développement                               |
| `pnpm build`       | Build de production                                    |
| `pnpm start`       | Lance le build de production                           |
| `pnpm lint`        | Vérification ESLint                                    |
| `pnpm test`        | Test d'intégration (après `pnpm build`, Postgres lancé) |
| `pnpm db:up`       | Démarre le Postgres de développement                   |
| `pnpm db:generate` | Génère une migration après modification du schéma      |

## Fonctionnalités

- **Textes** : tous les textes du site sont dans `src/content/texts.ts` (français uniquement).
- **Réservation** (`/rendez-vous`) : appel découverte (45 min) ou audit séminaire (45 min), sans compte. Champs demandés : prénom, nom, e-mail, téléphone et intention (« ce qui vous amène »), plus l'accord sur l'utilisation des données. Confirmation immédiate à l'écran.
- **Format** : visioconférence uniquement pour l'instant. Le présentiel est à confirmer avec Youcef : ajouter `"presentiel"` à `meetingFormats` dans `src/config/site.ts` suffit à proposer le choix.
- **Annulation / déplacement** : un client connecté annule ou déplace lui-même son rendez-vous depuis son espace, jusqu'à 24 h avant (règle vérifiée côté serveur). Le créneau libéré redevient réservable ; le rendez-vous annulé reste dans l'historique. En deçà de 24 h, ou pour un rendez-vous pris sans compte, la personne prévient Youcef.
- **Comptes clients** (espace gérant, carte « Comptes clients ») : conformément au cahier des charges, c'est le gérant qui crée les comptes (nom, e-mail, téléphone) et peut les désactiver ou les réactiver. Il n'y a plus d'inscription libre sur `/connexion` : l'action `register` a été supprimée de l'API.
- **Mot de passe provisoire** : à la création, un mot de passe provisoire aléatoire est généré (format `XXXX-XXXX-XXXX-XXXX`, environ 80 bits, sans caractères ambigus). Il est affiché **une seule fois** au gérant, qui le transmet au client par le canal de son choix (aucun e-mail n'est envoyé) ; seul son hash est conservé. Tant que le client ne l'a pas remplacé, son espace l'invite à le faire (onglet « Mon profil ») et le gérant voit le badge « Mot de passe provisoire ». En cas de perte, le bouton « Nouveau mot de passe » en génère un autre et ferme les sessions du client. Ce choix a été préféré à un lien d'activation, qui demanderait une page et un jeton supplémentaires pour un bénéfice faible sans envoi d'e-mail.
- **Espace client** : prochain rendez-vous mis en avant ; rendez-vous à venir, passés et annulés, avec annulation et déplacement ; réservation des séances de suivi (1 h, à confirmer), avec le téléphone du compte prérempli ; documents partagés ; profil (nom, téléphone) et changement de mot de passe (dont le mot de passe provisoire), qui déconnecte les autres appareils.
- **Espace gérant** (`/connexion` avec le compte de `ADMIN_EMAIL`) : rendez-vous avec téléphone et intention, disponibilités, PDF partagés, création et gestion des comptes clients.
- **Disponibilités** : le gérant saisit une plage (ex. 9 h – 18 h, 14 h maximum) et choisit la durée des créneaux (1 h, valable pour tous les rendez-vous, ou 45 min, pour les appels découverte et audits). La plage est découpée automatiquement ; les créneaux déjà couverts par une disponibilité sont ignorés.
- Un créneau = un rendez-vous ; l'unicité en base empêche deux réservations concurrentes, et un verrou empêche deux disponibilités qui se chevauchent.

Hors périmètre (décision de l'équipe) : e-mails de confirmation et de rappel, paiement.

## Données

Schéma : `src/db/schema.ts`. Migrations SQL : `drizzle/`, appliquées automatiquement au premier accès à la base. Après une modification du schéma : `pnpm db:generate`, puis commiter le fichier généré.

En production, faire pointer `DATABASE_URL` vers la base Postgres du serveur (20 Go prévus). Les dates sont stockées avec fuseau et affichées en heure de Paris. Les PDF sont stockés en base (`bytea`) et servis après contrôle d'accès.

Sécurité : cookies de session HttpOnly, SameSite=Lax, Secure en production ; mots de passe hachés avec scrypt ; tentatives de connexion limitées ; contrôle d'origine sur les requêtes POST.

## Vérifier

```bash
pnpm build
pnpm test
```

Le test démarre un serveur de production sur le port 43127 avec une **base Postgres temporaire** (créée puis supprimée ; `TEST_DATABASE_URL` pour utiliser un autre serveur). Il vérifie les pages, la validation des champs de réservation, les réservations concurrentes, l'annulation et le déplacement par le client (délai de 24 h, créneau libéré, rendez-vous d'un autre client inaccessible), la création des comptes par le gérant (refusée à un client et à un visiteur, ancienne inscription refusée), le mot de passe provisoire et sa réinitialisation, le profil et le mot de passe, les accès gérant/client, les documents privés, la désactivation et la déconnexion.

## Structure

```
src/
├── app/
│   ├── layout.tsx            # Layout racine (polices, métadonnées)
│   ├── (site)/               # Pages publiques avec en-tête et pied de page
│   └── api/portal/route.ts   # API : réservation, connexion, espace gérant
├── components/
│   ├── account/              # Connexion, espace client, espace gérant
│   ├── booking/              # Formulaire de réservation, sélecteur de créneaux
│   ├── layout/               # En-tête, pied de page, logo, menu mobile
│   ├── legal/                # Pages légales
│   ├── sections/             # Blocs de page réutilisables
│   └── ui/                   # Composants shadcn
├── config/site.ts            # Nom, navigation, formats de rendez-vous
├── content/texts.ts          # Tous les textes du site
├── db/schema.ts              # Schéma Drizzle
└── lib/
    ├── format.ts             # Dates (heure de Paris) et gabarits de texte
    └── store.ts              # Accès aux données
```

## Identité visuelle

Palette dans `src/app/globals.css`, utilisable via les variables shadcn (`bg-primary`, `text-muted-foreground`…) ou directement (`bg-brand-navy`, `text-brand-sky`…).

| Couleur      | Hex       | Pantone       | Classe Tailwind   |
| ------------ | --------- | ------------- | ----------------- |
| Bleu profond | `#0A1D35` | 296 C         | `brand-navy`      |
| Ivoire       | `#F2E8DC` | Warm Gray 1 C | `brand-ivory`     |
| Bleu clair   | `#6CAED6` | 2905 C        | `brand-sky`       |
| Champagne    | `#D9C9B4` | 7500 C        | `brand-champagne` |
| Bleu diamant | `#D0E7F5` | 656 C         | `brand-diamond`   |

Polices : **Inter** (`font-sans`) et **Cormorant Garamond** (`font-heading`). Logo : `public/brand/`.

## À finaliser avec Youcef

- Textes (présentation, parcours, formations), tarifs et modalités.
- Format présentiel : oui ou non.
- Comptes clients : à quel moment Youcef crée le compte (après l'appel découverte, à la signature du devis ?) et par quel canal il transmet le mot de passe provisoire. Le recueil du consentement du client à la création de son compte se fait hors du site et reste à formaliser. Pas de « mot de passe oublié » en libre-service : le client demande un nouveau mot de passe provisoire à Youcef.
- Place exacte des séminaires par rapport au coaching.
- Pages légales et confidentialité (le champ « intention » peut contenir des informations sensibles).
- Hébergement : Postgres installé sur le serveur, sauvegardes et HTTPS.
