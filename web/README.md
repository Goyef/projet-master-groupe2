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
- **Comptes clients** (`/connexion`, onglet « Créer un compte ») : chaque client crée lui-même son compte (nom, e-mail, téléphone, mot de passe de 12 caractères minimum) et est connecté immédiatement. Le gérant ne crée pas de compte ; il voit la liste des clients et peut désactiver ou réactiver un compte.
- **Espace client** : prochain rendez-vous mis en avant ; rendez-vous à venir, passés et annulés, avec annulation et déplacement ; réservation des séances de suivi (1 h, à confirmer), avec le téléphone du compte prérempli ; documents partagés ; demandes de support ; profil (nom, téléphone) et changement de mot de passe, qui déconnecte les autres appareils.
- **Espace gérant** (`/connexion` avec le compte de `ADMIN_EMAIL`) : rendez-vous avec téléphone et intention, demandes de support, disponibilités, PDF partagés, liste des comptes clients.
- **Espace de tickets** (support) : depuis l'onglet « Support » de son espace, un client connecté dépose une demande (sujet et message) et suit son statut — ouverte, en cours, clôturée — ainsi que les réponses de Youcef. Il ne voit que ses propres demandes. Le gérant les retrouve toutes dans la carte « Demandes de support » : il répond (une demande ouverte passe alors en cours), change le statut et clôture ; une demande clôturée doit être rouverte avant toute nouvelle réponse. Tables `tickets` et `ticket_replies`.
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

Le test démarre un serveur de production sur le port 43127 avec une **base Postgres temporaire** (créée puis supprimée ; `TEST_DATABASE_URL` pour utiliser un autre serveur). Il vérifie les pages, la validation des champs de réservation, les réservations concurrentes, l'annulation et le déplacement par le client (délai de 24 h, créneau libéré, rendez-vous d'un autre client inaccessible), le profil et le mot de passe, les accès gérant/client, les documents privés, les demandes de support (dépôt, isolation entre clients, réponse et clôture par le gérant), la désactivation et la déconnexion. `TEST_PORT` permet de changer le port si 43127 est occupé.

## Structure

```
src/
├── app/
│   ├── layout.tsx            # Layout racine (polices, métadonnées)
│   ├── (site)/               # Pages publiques avec en-tête et pied de page
│   └── api/portal/route.ts   # API : réservation, connexion, support, espace gérant
├── components/
│   ├── account/              # Connexion, espace client, espace gérant, support
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
- Support : faut-il permettre au client de répondre à son tour dans une demande, et prévenir par e-mail d'une nouvelle demande ou réponse (hors périmètre pour l'instant) ?
- Inscription libre : tout inscrit peut réserver une séance de suivi. Prévoir, si besoin, une limitation (anti-spam) et le parcours « mot de passe oublié ».
- Place exacte des séminaires par rapport au coaching.
- Pages légales et confidentialité (le champ « intention » peut contenir des informations sensibles).
- Hébergement : Postgres installé sur le serveur, sauvegardes et HTTPS.
