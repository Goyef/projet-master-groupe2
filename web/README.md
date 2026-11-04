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
| `pnpm test:i18n`   | Traductions, routes et erreurs bilingues, après le build ; sans Postgres |
| `pnpm db:up`       | Démarre le Postgres de développement                   |
| `pnpm db:generate` | Génère une migration après modification du schéma      |

## Fonctionnalités

- **Langues** : français et anglais, avec un sélecteur à drapeaux dans l'en-tête. Textes français dans `src/content/texts.ts`, anglais dans `src/content/en.ts` ; le typage et les tests vérifient les clés et variables de traduction.
- **Réservation** (`/rendez-vous`) : appel découverte (45 min) ou audit séminaire (45 min), sans compte. Champs demandés : prénom, nom, e-mail, téléphone et intention (« ce qui vous amène »), plus l'accord sur l'utilisation des données. Confirmation immédiate à l'écran.
- **Format** : visioconférence uniquement pour l'instant. Le présentiel est à confirmer avec Youcef : ajouter `"presentiel"` à `meetingFormats` dans `src/config/site.ts` suffit à proposer le choix.
- **Annulation / déplacement** : un client connecté annule ou déplace lui-même son rendez-vous depuis son espace, jusqu'à 24 h avant (règle vérifiée côté serveur). Le créneau libéré redevient réservable ; le rendez-vous annulé reste dans l'historique. En deçà de 24 h, ou pour un rendez-vous pris sans compte, la personne prévient Youcef.
- **Comptes clients** : deux façons d'obtenir un compte. Le visiteur peut **s'inscrire lui-même** sur `/connexion` (onglet « Créer un compte » : nom, e-mail, téléphone, mot de passe de 12 caractères minimum, accord sur les données) et est connecté immédiatement. Le **gérant** peut aussi créer un compte depuis son espace (carte « Comptes clients ») avec un mot de passe provisoire. Dans les deux cas, le gérant peut désactiver ou réactiver le compte.
- **Mot de passe provisoire** : à la création, un mot de passe provisoire aléatoire est généré (format `XXXX-XXXX-XXXX-XXXX`, environ 80 bits, sans caractères ambigus). Il est affiché **une seule fois** au gérant, qui le transmet au client par le canal de son choix (aucun e-mail n'est envoyé) ; seul son hash est conservé. Tant que le client ne l'a pas remplacé, son espace l'invite à le faire (onglet « Mon profil ») et le gérant voit le badge « Mot de passe provisoire ». En cas de perte, le bouton « Nouveau mot de passe » en génère un autre et ferme les sessions du client. Ce choix a été préféré à un lien d'activation, qui demanderait une page et un jeton supplémentaires pour un bénéfice faible sans envoi d'e-mail.
- **Bouton d'accès de l'en-tête** : « Se connecter » pour un visiteur, « Espace client » pour un client connecté, « Espace gérant » pour le gérant (ordinateur et menu mobile). La session est lue côté serveur à chaque page ; après une connexion ou une déconnexion sur `/connexion`, l'en-tête se met à jour sans recharger la page.
- **Espace client** : prochain rendez-vous mis en avant ; rendez-vous à venir, passés et annulés, avec annulation et déplacement ; réservation des séances de suivi (1 h, à confirmer), avec le téléphone du compte prérempli ; documents partagés ; profil (nom, téléphone) et changement de mot de passe (dont le mot de passe provisoire), qui déconnecte les autres appareils.
- **Espace gérant** (`/connexion` avec le compte de `ADMIN_EMAIL`) : un tableau de bord avec des indicateurs (rendez-vous du jour, des 7 prochains jours, prochain rendez-vous, demandes de support ouvertes) et des onglets :
  - **Calendrier** : vue semaine (grille horaire, heure de Paris, ligne « maintenant », éléments qui se chevauchent côte à côte) et vue mois. Couleur par type de rendez-vous, rendez-vous annulés grisés, créneaux libres en pointillés (un clic propose de les retirer).
  - **Rendez-vous** : liste filtrable (à venir, passés, annulés, tous) avec recherche par nom, e-mail ou téléphone.
  - Un clic sur un rendez-vous ouvre son panneau : coordonnées cliquables, intention, statut, et les actions **déplacer** (vers n'importe quel créneau libre et à venir, sans délai de 24 h pour le gérant), **annuler** (le créneau est libéré), **supprimer** définitivement et **marquer réalisé**. Chaque action est confirmée ; « Prévenir le client par e-mail » est coché par défaut, et Google Agenda suit dans tous les cas.
  - **Disponibilités**, **Support**, **Clients**, **Documents** et **Synchronisation** (lien d'abonnement, synchronisation Google, démo Calendly) reprennent les cartes existantes.
- **Documents partagés** : le gérant partage un PDF avec **tous les clients** ou avec **plusieurs clients choisis** (liste avec recherche ; chaque client choisi apparaît en étiquette). Un client ne voit que les documents partagés avec tous ou avec lui, sans connaître les autres destinataires ; la liste du gérant indique les destinataires de chaque document. Tables `documents` (`all_clients`) et `document_recipients`.
- **Parcours client** : au partage d'un PDF, le gérant indique après combien de séances réalisées il devient accessible (0 = tout de suite, 50 au maximum). Une séance compte quand c'est un suivi confirmé que le gérant a marqué « réalisé ». Dans l'onglet « Documents », le client voit sa progression, ses documents débloqués et les suivants, verrouillés (« Disponible après la séance N »). Le serveur refuse le téléchargement d'un document verrouillé ; le gérant accède à tous les documents. Les types de rendez-vous qui comptent sont listés dans `SESSION_TYPES` (`src/lib/store.ts`).
- **Espace de tickets** (support) : depuis l'onglet « Support » de son espace, un client connecté dépose une demande (sujet et message) et suit son statut — ouverte, en cours, clôturée — ainsi que les réponses de Youcef. Il ne voit que ses propres demandes. Le gérant les retrouve toutes dans la carte « Demandes de support » : il répond (une demande ouverte passe alors en cours), change le statut et clôture ; une demande clôturée doit être rouverte avant toute nouvelle réponse. Tables `tickets` et `ticket_replies`.
- **Disponibilités** : le gérant saisit une plage (ex. 9 h – 18 h, 14 h maximum) et choisit la durée des créneaux (1 h, valable pour tous les rendez-vous, ou 45 min, pour les appels découverte et audits). La plage est découpée automatiquement ; les créneaux déjà couverts par une disponibilité sont ignorés.
- Un créneau = un rendez-vous ; l'unicité en base empêche deux réservations concurrentes, et un verrou empêche deux disponibilités qui se chevauchent. Une même demande reçue deux fois (double clic, réseau qui renvoie la requête) n'est pas refusée : si le créneau est déjà pris par la même personne (même compte, ou même e-mail dans les 10 dernières minutes pour une réservation sans compte), sa réservation lui est confirmée à nouveau. Le formulaire bloque aussi un second envoi tant que le premier est en cours.

- **Agendas** :
  - **Client** : après une réservation et dans l'espace client (prochain rendez-vous, rendez-vous à venir), le menu « Ajouter à mon agenda » propose **Google Agenda** (lien prérempli) ou un **fichier `.ics`** (Apple Calendar, Outlook…). Rien à configurer.
  - **Gérant, lien d'abonnement** : avec `CALENDAR_FEED_TOKEN`, l'espace gérant (carte « Agenda ») affiche un lien privé `/api/agenda/<jeton>` à ajouter une fois dans Google Agenda (« Autres agendas » → « + » → « À partir de l'URL »). Il contient les rendez-vous confirmés des 30 derniers jours et à venir ; Google le rafraîchit toutes les quelques heures.
  - **Gérant, synchronisation Google immédiate** : avec le compte Google de Youcef ou un compte de service (voir « Configurer Google Agenda »), chaque réservation, déplacement ou annulation est reporté tout de suite dans l'agenda de Youcef. Le report a lieu après la réponse : une panne de Google ne bloque jamais une réservation (l'erreur est journalisée).
  - **Lien Google Meet** : avec le compte Google de Youcef (OAuth), chaque rendez-vous en visio reçoit un lien Meet créé avec l'événement. Il figure dans l'e-mail de confirmation (envoyé après la synchronisation pour le contenir), dans l'e-mail de déplacement, dans l'espace client (« Rejoindre la visio ») et dans le panneau du rendez-vous côté gérant. Il reste le même quand le rendez-vous est déplacé et n'est plus affiché s'il est annulé. Le client n'est pas invité dans Google : il reçoit le lien par notre e-mail, et Youcef, organisateur, le fait entrer. Si Google ne répond pas, l'e-mail part sans lien et indique que Youcef l'enverra.
  - Dans les deux cas côté gérant, l'événement contient le type, le nom, l'e-mail et le téléphone, mais jamais « ce qui vous amène ». Calendly n'est pas utilisé : la prise de rendez-vous reste celle du site.

- **E-mails** (API [Resend](https://resend.com), expéditeur `noreply@abdu.fr`) : chaque e-mail a une version HTML (charte du site, tableaux et styles en ligne pour les messageries) et une version texte.
  - **Client ou prospect** : confirmation de rendez-vous (avec lien Google Agenda), déplacement, annulation, bienvenue après inscription, lien « choisir mon mot de passe » quand le gérant crée le compte (valable 7 jours), réponse du gérant à une demande de support.
  - **Gérant** (`MAIL_ADMIN_TO`, sinon `ADMIN_EMAIL`) : nouveau rendez-vous, déplacement, annulation, nouvelle demande de support. L'adresse e-mail du client figure dans la notification : pour lui répondre, écrivez-lui directement (pas de Reply-To vers son adresse).
  - Les e-mails partent **après la réponse** (`after`) : un retard ou une panne de Resend ne bloque jamais une réservation (l'erreur est journalisée, adresse masquée). Une même réservation reçue deux fois n'envoie qu'une confirmation.
  - Langue : celle de l'interface pour les actions du visiteur ; français pour les notifications du gérant et les e-mails déclenchés par lui. « Ce qui vous amène » n'est jamais repris dans un e-mail ; tout contenu saisi est échappé dans le HTML.
- **Mot de passe oublié** (`/mot-de-passe-oublie`, lien sous le champ mot de passe de `/connexion`) : un e-mail contient un lien valable **1 heure**, à usage unique (seul le hash du jeton est stocké, table `password_resets`). La réponse est la même que l'adresse ait un compte ou non, et 3 demandes au plus par quart d'heure partent pour une même adresse. Sur `/reinitialiser-mot-de-passe`, le nouveau mot de passe ferme les autres sessions et connecte directement le client.

Hors périmètre (décision de l'équipe) : rappels automatiques la veille du rendez-vous (nécessiteraient une tâche planifiée), paiement.

### Configurer l'envoi d'e-mails (Resend)

| Variable               | Rôle                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`       | Clé d'API Resend, `re_…` (**serveur uniquement**, jamais dans le navigateur ni dans une variable `NEXT_PUBLIC_`). Sans elle, aucun e-mail ne part ; en développement, le terminal indique ce qui aurait été envoyé. |
| `MAIL_FROM`            | Expéditeur (`noreply@abdu.fr` par défaut) : son domaine doit être **vérifié dans Resend**     |
| `MAIL_FROM_NAME`       | Nom affiché (`Youcef · Synégo` par défaut)                                                    |
| `MAIL_REPLY_TO`        | Facultatif : adresse de réponse (ex. `contact@abdu.fr`), **sur le même domaine que `MAIL_FROM`**, sinon ignorée (avertissement dans les journaux). Sans elle, aucun Reply-To n'est envoyé. |
| `MAIL_ADMIN_TO`        | Destinataire des notifications du gérant (sinon `ADMIN_EMAIL`)                               |
| `SITE_URL`             | Adresse publique du site, pour les liens et le logo des e-mails                               |

Mise en place, une fois :
1. Créer un compte sur [resend.com](https://resend.com), puis **Domains → Add Domain** : `abdu.fr` (région Europe, `eu-west-1`, de préférence).
2. Ajouter chez le registrar de `abdu.fr` les enregistrements DNS affichés par Resend : DKIM (`resend._domainkey`), et MX + SPF sur le sous-domaine `send` (adresse de retour). Attendre que le domaine passe « Verified ».
3. **API Keys → Create API Key** (permission « Sending access », limitée au domaine `abdu.fr`), puis renseigner `RESEND_API_KEY` dans `.env.local` et dans Vercel (Settings → Environment Variables), et redéployer.

À savoir : une clé refusée ou un domaine non vérifié est journalisé (`[mail] envoi refusé par Resend (403)…`) sans bloquer le site ; l'onglet **Emails** de Resend montre l'état de chaque message (remis, rebond, plainte). Offre gratuite : 100 e-mails par jour et 3 000 par mois. Un domaine neuf finit facilement dans les indésirables : d'où un vrai nom d'expéditeur, un contenu réaliste et une version texte dans chaque e-mail. Pas de pièce jointe envoyée (le lien Google Agenda remplace le fichier `.ics`).

## Langues

Les URL publiques restent identiques dans les deux langues (`/`, `/seminaires`, `/rendez-vous`…). Le serveur sélectionne la version française ou anglaise selon le cookie `synego-locale` (un an), sinon la langue du navigateur, avec le français par défaut. Le sélecteur conserve la page, ses paramètres, son ancre et l'apparence choisie. Les dates, formulaires et erreurs API suivent la langue affichée ; les horaires restent en heure de Paris. Les contenus saisis par les utilisateurs et les PDF ne sont pas traduits.

Côté serveur, `getTexts()` fournit le dictionnaire de la page ; côté client, `useLocalizedFetch()` transmet sa langue à l'API via `Accept-Language`. Les liens utilisent les chemins habituels, sans préfixe. Définir `NEXT_PUBLIC_SITE_URL` au build avec l'URL publique pour générer les liens canoniques. Une URL partagée affiche la langue du visiteur ; les deux langues n'ont pas d'URL distincte pour le référencement.

Les pages sont rendues côté serveur à chaque requête afin que les textes et `<html lang>` correspondent au cookie dès le premier affichage. Le cache partagé des pages est désactivé pour éviter de servir la langue d'un autre visiteur ; les fichiers statiques restent mis en cache.

### Configurer Google Agenda

Variables (toutes facultatives ; sans elles, la fonction correspondante est simplement désactivée) :

| Variable                        | Rôle                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `CALENDAR_FEED_TOKEN`           | Jeton secret du lien d'abonnement (32 caractères minimum, ex. `openssl rand -hex 24`)     |
| `GOOGLE_OAUTH_CLIENT_ID`        | Identifiant du client OAuth (`….apps.googleusercontent.com`)                              |
| `GOOGLE_OAUTH_CLIENT_SECRET`    | Code secret du client OAuth                                                               |
| `GOOGLE_OAUTH_REFRESH_TOKEN`    | Jeton de rafraîchissement du compte Google de Youcef (`1//…`)                             |
| `GOOGLE_CALENDAR_ID`            | Agenda à utiliser ; en OAuth, vide = agenda principal du compte (sinon, son identifiant)  |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`  | Compte de service, à la place d'OAuth (`…@….iam.gserviceaccount.com`) : pas de lien Meet  |
| `GOOGLE_PRIVATE_KEY`            | Clé privée du compte de service (champ `private_key` du fichier JSON, `\n` acceptés)     |
| `SITE_URL`                      | Adresse publique du site, reprise dans les événements (sinon, celle de la requête)        |

Si les trois variables OAuth sont renseignées, elles sont utilisées en priorité. Le compte de service reste possible, mais Google lui refuse la création de visioconférences (sauf Google Workspace avec délégation au niveau du domaine) : sans OAuth, pas de lien Meet.

Connexion du compte Google de Youcef (OAuth), une fois :
1. Dans [Google Cloud Console](https://console.cloud.google.com/), créer un projet et activer l'**API Google Calendar**.
2. **Google Auth Platform** → configurer l'écran de consentement : type « Externe », nom « Synégo », adresse de contact. Dans **Audience**, cliquer sur **« Publier l'application »** (état « En production ») : en état « Test », Google invalide le jeton de rafraîchissement au bout de 7 jours. L'application n'a pas besoin d'être validée par Google : Youcef verra seulement l'avertissement « Application non validée » (→ « Paramètres avancés » → « Accéder à Synégo »).
3. **Clients** → « Créer un client » → type **Application Web**, avec l'URI de redirection autorisée `https://developers.google.com/oauthplayground`. Noter l'identifiant et le code secret.
4. Ouvrir [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) → roue crantée → cocher « Use your own OAuth credentials » et coller l'identifiant et le secret. À l'étape 1, saisir le champ d'application `https://www.googleapis.com/auth/calendar.events`, cliquer sur « Authorize APIs » et se connecter **avec le compte Google de Youcef**. À l'étape 2, cliquer sur « Exchange authorization code for tokens » et copier le **Refresh token**.
5. Renseigner `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` et `GOOGLE_OAUTH_REFRESH_TOKEN` (dans `.env.local` en local, dans Vercel → Settings → Environment Variables en production), retirer les variables du compte de service, puis redéployer. La carte « Agenda » de l'espace gérant indique si la synchronisation et les liens Meet sont actifs.

Si Youcef retire l'accès (Compte Google → Sécurité → Applications tierces), le jeton ne fonctionne plus : les journaux affichent `jeton Google refusé (400) … invalid_grant`. Refaire l'étape 4.

Avec un compte de service à la place : créer le compte et une clé JSON, puis, dans Google Agenda, partager l'agenda de Youcef avec l'adresse du compte de service (droit **« Modifier les événements »**) et renseigner `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` et `GOOGLE_PRIVATE_KEY`.

## Données

Schéma : `src/db/schema.ts`. Migrations SQL : `drizzle/`, appliquées automatiquement au premier accès à la base. Après une modification du schéma : `pnpm db:generate`, puis commiter le fichier généré.

En production, faire pointer `DATABASE_URL` vers la base Postgres du serveur (20 Go prévus). Les dates sont stockées avec fuseau et affichées en heure de Paris. Les PDF sont stockés en base (`bytea`) et servis après contrôle d'accès.

Sécurité : cookies de session HttpOnly, SameSite=Lax, Secure en production ; mots de passe hachés avec scrypt ; tentatives de connexion limitées ; contrôle d'origine sur les requêtes POST.

## Vérifier

```bash
pnpm build
pnpm test:i18n
pnpm test
```

Le test démarre un serveur de production sur le port 43127 avec une **base Postgres temporaire** (créée puis supprimée ; `TEST_DATABASE_URL` pour utiliser un autre serveur). Il vérifie les pages, la validation des champs de réservation, les réservations concurrentes, la même réservation envoyée deux fois (confirmée, et toujours refusée à une autre personne), l'annulation et le déplacement par le client (délai de 24 h, créneau libéré, rendez-vous d'un autre client inaccessible), l'inscription libre (accord et mot de passe exigés, e-mail unique, session ouverte), la création des comptes par le gérant (refusée à un client et à un visiteur), le mot de passe provisoire et sa réinitialisation, le profil et le mot de passe, les accès gérant/client, le libellé du bouton d'accès de l'en-tête selon la session, la gestion des rendez-vous par le gérant (déplacement sans délai de 24 h avec e-mail au client, annulation avec ou sans e-mail, suppression définitive, événement Google mis à jour ou retiré, actions refusées à un client), les e-mails (contre un faux serveur Resend qui vérifie la clé et le format de l'expéditeur : confirmation, notification du gérant avec réponse au client, pas de doublon, déplacement, annulation, bienvenue, lien de création de compte, support, contenu échappé, version texte), le mot de passe oublié (réponse identique pour une adresse inconnue, 3 demandes au plus, lien à usage unique, sessions fermées, compte désactivé refusé), les documents privés, le partage avec plusieurs clients ou avec tous (destinataire obligatoire, client inconnu ou gérant refusé, doublons ignorés, autres destinataires masqués au client), le déblocage progressif des documents (refus avant la séance requise, accès une fois la séance marquée réalisée), les demandes de support (dépôt, isolation entre clients, réponse et clôture par le gérant), les agendas (lien d'abonnement secret sans l'intention ni les rendez-vous annulés ; synchronisation Google de la réservation, du déplacement et de l'annulation, et du lien Google Meet — créé une fois, même en différé, conservé au déplacement, présent dans les e-mails et l'espace client — contre un faux serveur Google qui vérifie le jeton OAuth), la désactivation et la déconnexion. `TEST_PORT` permet de changer le port si 43127 est occupé.

## Structure

```
src/
├── app/
│   ├── layout.tsx            # Layout racine, langue, polices et métadonnées
│   ├── (site)/               # Pages publiques en français et anglais
│   └── api/portal/route.ts   # API : réservation, connexion, support, espace gérant
├── components/
│   ├── account/              # Connexion, espace client, espace gérant, support
│   ├── booking/              # Formulaire de réservation, sélecteur de créneaux
│   ├── layout/               # En-tête, pied de page, logo, menu mobile
│   ├── i18n/                 # Langue, apparence, dates et requêtes API
│   ├── legal/                # Pages légales
│   ├── sections/             # Blocs de page réutilisables
│   └── ui/                   # Composants shadcn
├── config/site.ts            # Nom, navigation, formats de rendez-vous
├── content/                  # Dictionnaires français et anglais
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

Logo : `public/brand/`.

### Thèmes et mode sombre

Le bouton palette de l'en-tête ouvre un menu unique pour choisir le **thème** et le **mode** (clair ou sombre). Le choix est mémorisé dans le navigateur (`localStorage`) et appliqué avant l'affichage, sans flash.

| Thème                  | Couleurs                         | Polices (texte / titres)         | Arrondis |
| ---------------------- | -------------------------------- | -------------------------------- | -------- |
| Classique (par défaut) | Ivoire et bleu profond           | Inter / Cormorant Garamond       | Moyens   |
| Élégant                | Champagne et bleu profond        | Source Sans 3 / Playfair Display | Droits   |
| Moderne                | Blanc et bleu diamant            | Manrope / Manrope                | Arrondis |

Le thème est porté par l'attribut `data-theme` de `<html>`, le mode sombre par la classe `dark` ; les variables de chaque combinaison sont dans `src/app/globals.css`, la logique dans `src/lib/theme.ts` et le menu dans `src/components/layout/theme-menu.tsx`. Les composants n'ont rien à faire de particulier tant qu'ils utilisent les variables du thème (`bg-background`, `text-foreground`, `bg-primary`…) ; la variante `dark:` reste disponible pour les rares cas où un élément doit changer en mode sombre (logo posé sur une pastille claire, par exemple).

## À finaliser avec Youcef

- Textes (présentation, parcours, formations), tarifs et modalités.
- Format présentiel : oui ou non.
- Support : faut-il permettre au client de répondre à son tour dans une demande, et prévenir par e-mail d'une nouvelle demande ou réponse (hors périmètre pour l'instant) ?
- Inscription libre : tout inscrit peut réserver une séance de suivi, alors que le cahier des charges réserve le suivi aux clients signés. À valider avec Youcef (garder l'inscription, ou la limiter, par exemple avec une validation du compte par le gérant).
- Comptes clients : à quel moment Youcef crée le compte (après l'appel découverte, à la signature du devis ?) et par quel canal il transmet le mot de passe provisoire. Le recueil du consentement du client à la création de son compte se fait hors du site et reste à formaliser. Pas de « mot de passe oublié » en libre-service : le client demande un nouveau mot de passe provisoire à Youcef.
- Place exacte des séminaires par rapport au coaching.
- Pages légales et confidentialité (le champ « intention » peut contenir des informations sensibles).
- Hébergement : Postgres installé sur le serveur, sauvegardes et HTTPS.
