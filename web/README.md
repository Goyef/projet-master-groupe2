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
| `pnpm test`        | Tests d'intégration (après `pnpm build`, Postgres lancé) |
| `pnpm test:i18n`   | Traductions, routes et erreurs bilingues, questionnaire, témoignages, après le build ; sans Postgres |
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
  - **Client ou prospect** : confirmation de rendez-vous (avec lien Google Agenda), déplacement, annulation, bienvenue après inscription, lien « choisir mon mot de passe » quand le gérant crée le compte (valable 7 jours), réponse du gérant à une demande de support, rappel la veille du rendez-vous, alerte de liste d'attente, compte rendu de séance disponible (sans son contenu).
  - **Gérant** (`MAIL_ADMIN_TO`, sinon `ADMIN_EMAIL`) : nouveau rendez-vous, déplacement, annulation, nouvelle demande de support. L'adresse e-mail du client figure dans la notification : pour lui répondre, écrivez-lui directement (pas de Reply-To vers son adresse).
  - Les e-mails partent **après la réponse** (`after`) : un retard ou une panne de Resend ne bloque jamais une réservation (l'erreur est journalisée, adresse masquée). Une même réservation reçue deux fois n'envoie qu'une confirmation.
  - Langue : celle de l'interface pour les actions du visiteur ; français pour les notifications du gérant et les e-mails déclenchés par lui, sauf le rappel de la veille et l'e-mail de compte rendu, qui partent dans la langue enregistrée avec le rendez-vous (colonne `locale`, renseignée à la réservation et au déplacement par le client). « Ce qui vous amène » n'est jamais repris dans un e-mail ; tout contenu saisi est échappé dans le HTML.
- **Mot de passe oublié** (`/mot-de-passe-oublie`, lien sous le champ mot de passe de `/connexion`) : un e-mail contient un lien valable **1 heure**, à usage unique (seul le hash du jeton est stocké, table `password_resets`). La réponse est la même que l'adresse ait un compte ou non, et 3 demandes au plus par quart d'heure partent pour une même adresse. Sur `/reinitialiser-mot-de-passe`, le nouveau mot de passe ferme les autres sessions et connecte directement le client.

### Accompagner entre les séances et convertir les visiteurs

- **Vidéo de présentation** (accueil, juste sous l'accroche, « Synégo en un coup d'œil ») : motion design de 30 secondes, sans son, dans la langue de la page : `public/video/synego-promo.mp4` en français, `public/video/synego-promo-en.mp4` en anglais (1080p, 2 Mo, H.264, chacune avec son affiche `-poster.webp` ; au changement de langue, la vidéo repart du début dans la nouvelle langue). Elle est affichée en grand et sans cadre : pleine largeur jusqu'à 1 536 px, fond ivoire identique à celui du site et bords en fondu, si bien que l'animation se joue directement sur la page. Elle se lance seule, muette et en boucle, dès qu'elle est visible à l'écran (même si le système demande moins d'animations, à la demande de l'équipe), et se met en pause quand elle en sort ; l'affiche reste visible le temps du chargement. Un petit bouton lecture / pause reste toujours disponible (exigence d'accessibilité pour une vidéo qui démarre seule : clavier, lecteurs d'écran, clic sur l'image), et une pause demandée n'est pas annulée par le défilement ; si le navigateur refuse la lecture automatique (mode économie d'énergie), un grand bouton de lecture apparaît. Un texte décrit la vidéo pour les lecteurs d'écran. Composant : `src/components/sections/promo-video.tsx`, textes `home.video*`.
- **Auto-évaluation** (`/auto-evaluation`, dans la navigation et depuis la section « Vous reconnaissez-vous ? » de l'accueil) : questionnaire « Où en êtes-vous ? » de 10 questions (jamais / parfois / souvent / presque toujours), une question par écran avec barre de progression et retour arrière, utilisable au clavier. Le résultat tient en trois paliers formulés avec douceur, sans score ni diagnostic (« Ce questionnaire n'est pas un outil médical… »), et chacun propose de réserver un appel découverte. Rien n'est envoyé au serveur ni enregistré : tout reste dans le navigateur. Si la personne coche « Joindre un résumé de mes réponses » (décochée par défaut), un résumé court est repris dans le champ « Ce qui vous amène » de `/rendez-vous`, où elle peut le modifier avant d'envoyer. Logique dans `src/lib/quiz.ts`, textes dans la section `quiz` des dictionnaires.
- **Ressources d'urgence** : le pied de page de toutes les pages et le résultat du questionnaire affichent un encart sobre : 3114 (numéro national de prévention du suicide, gratuit, 24 h/24, 7 j/7), 15 ou 112 en cas d'urgence vitale, avec liens `tel:`. En anglais, les numéros restent les numéros français et le texte précise « in France ». Composant : `src/components/sections/crisis-resources.tsx`.
- **Configurateur de séminaire** (`/seminaires#configurateur`) : en quatre étapes (taille de l'équipe, thèmes, format, objectif facultatif), l'entreprise esquisse son séminaire et voit un récapitulatif, sans prix (le devis se construit pendant l'audit). Le bouton « Réserver un audit · 45 minutes » préremplit la demande d'audit sur `/rendez-vous`. Rien n'est envoyé au serveur à cette étape.
- **Préremplissage de la réservation** : le questionnaire et le configurateur écrivent dans `sessionStorage` la clé `synego:booking-prefill`, au format JSON `{ "type"?: "vente" | "audit", "intention": string }` (jamais dans l'URL : le texte peut être sensible). Au montage, le formulaire lit cette valeur une seule fois puis l'efface : il présélectionne le type, remplit l'intention (coupée à 1 000 caractères, la limite du serveur) et l'indique par un court message. Fonctions dans `src/lib/booking-prefill.ts`.
- **Témoignages** : section réutilisable (`src/components/sections/testimonials.tsx`) sur l'accueil (accompagnement) et sur `/seminaires` (entreprises), alimentée par `testimonials.coaching` et `testimonials.companies` dans `texts.ts` et `en.ts` (citation, prénom ou initiales, contexte facultatif). Les listes sont vides et la section est masquée tant qu'elles le restent : n'y ajouter que des témoignages réels, avec l'accord écrit des personnes, dans le même ordre en français et en anglais.
- **Liste d'attente** (« Prévenez-moi si un créneau se libère ») : sous le choix du créneau de `/rendez-vous` et de l'onglet « Réserver » de l'espace client, un petit formulaire (e-mail, rendez-vous concerné, accord sur les données) inscrit le visiteur, avec ou sans compte (le suivi est réservé aux clients connectés) ; il est mis en avant quand aucun créneau n'est disponible pour le type choisi. Une inscription vaut pour **une alerte** et expire après **30 jours** (table `waitlist_entries`, une ligne par adresse et par type : se réinscrire met l'inscription à jour, avec une réponse identique dans tous les cas, et 5 demandes au plus par quart d'heure pour une même adresse). Quand un créneau redevient réservable (annulation ou déplacement par le client ou le gérant, suppression d'un rendez-vous, ajout de disponibilités), les inscrits de ce type encore en attente reçoivent après la réponse un e-mail « Un créneau vient de se libérer » dans la langue de l'inscription, avec les créneaux (heure de Paris), le lien de réservation et la règle « premier arrivé, premier servi », puis sont marqués prévenus. Seuls les créneaux encore libres qui commencent dans plus de 2 heures comptent. Chaque e-mail contient un lien de désinscription à usage unique (seul le hash du jeton est stocké ; le lien du dernier e-mail fait foi) vers `/liste-attente/desinscription`, où la personne confirme d'un clic. Le tableau de bord du gérant affiche le nombre de personnes en attente par type.
- **Rappel la veille** : chaque jour vers 16 h UTC (tâche planifiée Vercel déclarée dans `vercel.json`, une fois par jour sur l'offre Hobby), `GET /api/cron/rappels` envoie un rappel à chaque rendez-vous confirmé dont le début tombe le lendemain (date de Paris) : date et heure de Paris, durée, type, lien Google Meet s'il existe, bouton « Ajouter à Google Agenda » et règle d'annulation (24 h), jamais « ce qui vous amène ». La route exige `Authorization: Bearer <CRON_SECRET>` : définir `CRON_SECRET` dans Vercel suffit, Vercel l'envoie de lui-même à la tâche ; sans cette variable, la route est désactivée (503). Un même rendez-vous n'est rappelé qu'une fois, même si la tâche est appelée deux fois (`reminder_sent_at`), et un déplacement permet un nouveau rappel. Un envoi refusé par Resend est journalisé (adresse masquée) et réessayé au prochain appel du jour ; un appel manqué n'est pas rattrapé. La réponse ne contient que des compteurs (`sent`, `skipped`, `failed`). Déclenchement à la main : `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/rappels`.
- **Journal d'humeur** (« météo intérieure ») : depuis l'onglet « Journal » de son espace, le client note chaque jour sa météo intérieure sur cinq niveaux (orage, pluie, nuageux, éclaircies, soleil), avec une note facultative de 500 caractères. Une seule entrée par jour (date de Paris) : enregistrer à nouveau remplace celle du jour. Il voit les 30 derniers jours en barres et la liste de ses entrées, qu'il peut modifier ou supprimer. Le gérant retrouve les 14 derniers jours d'un client (barres et dernières notes) dans le panneau d'un rendez-vous rattaché à un compte, et via le bouton « Journal » de la carte « Comptes clients ». Seuls le client et le gérant y ont accès ; le journal n'est jamais repris dans un e-mail ni dans Google Agenda. Table `mood_entries` (unique par client et par jour, supprimée avec le compte).
- **Préparation et compte rendu de séance** : pour chacun de ses rendez-vous confirmés à venir, le client connecté note « Ce que j'aimerais aborder » (1 000 caractères au plus), modifiable jusqu'à l'heure de début (règle vérifiée côté serveur). Le gérant la lit dans le panneau du rendez-vous. Une fois la séance marquée « réalisée », il y rédige un compte rendu (3 000 caractères au plus) et jusqu'à 5 actions à faire d'ici la prochaine séance, modifiables ensuite (une action conservée garde son état). Le client lit le compte rendu depuis le rendez-vous passé et coche ses actions ; le gérant voit l'état des cases, et les actions encore ouvertes de la dernière séance sont mises en avant dans le tableau de bord du client. À la première publication, le client reçoit l'e-mail « Votre compte rendu de séance est disponible », avec un lien vers son espace mais sans le contenu. Un rendez-vous pris sans compte n'a pas cette fonction. Colonne `appointments.preparation`, tables `session_notes` et `session_actions` (supprimées avec le rendez-vous).

### Assistant IA (« Une question ? »)

- **Mascotte et bouton flottant** en bas à droite de toutes les pages : la mascotte de l'assistant (visuels dans `public/brand/assistant/` : personnage entier, avatar et visage, composant `assistant-avatar.tsx`) salue à l'arrivée, avec la bulle « Une question ? » sur ordinateur. Elle ouvre un panneau de conversation (plein écran sur mobile) : en-tête aux couleurs du thème, accueil illustré par la mascotte et quatre questions fréquentes, avatar à côté de chaque réponse, indicateur de frappe animé (animations désactivées si le système demande moins de mouvements). Les réponses s'affichent au fil de l'eau, en Markdown simple et sûr (gras, listes, liens vers les pages du site, qui referment le panneau ; aucun HTML interprété). La conversation suit la navigation et reste dans l'onglet (`sessionStorage`, clé `synego:assistant`) ; « Nouvelle conversation » l'efface. Bouton pour arrêter une réponse, nouvel essai en cas d'erreur, message de 1 000 caractères au plus (Entrée envoie, Maj + Entrée passe à la ligne).
- **Modèle** : `gpt-6.1-terra` d'OpenAI, par l'API Responses en flux (`stream: true`), sans SDK (`fetch`, comme Resend et Google Agenda), raisonnement `low` pour répondre vite. Route `POST /api/assistant` ; réponse en NDJSON, une ligne JSON par événement (texte, état d'un outil, carte, fin, erreur) : contrat dans `src/lib/assistant/protocol.ts`.
- **Tout le contexte du site** : la base de connaissances (`src/lib/assistant/knowledge.ts`) est générée à partir des dictionnaires, de la configuration et des constantes métier : consignes, présentation de Synégo, plan du site, fonctionnement détaillé (réservation, liste d'attente, compte, espace client, espace gérant, e-mails, confidentialité) et **tous les textes de l'interface** dans la langue affichée, pour citer les libellés exacts. Elle ne promet que ce qui est actif sur le serveur (e-mails, liens Meet, rappels). Un texte, une durée ou un délai modifié sur le site est donc repris sans toucher à l'assistant. Chaque question est accompagnée de l'heure de Paris, de la page consultée (sans paramètres d'URL, qui peuvent contenir un jeton), de la langue et du type de visiteur (visiteur, client, gérant).
- **Outils** (appels de fonctions aux schémas stricts, `src/lib/assistant/tool-definitions.ts`) :
  - `get_available_slots` : créneaux réellement libres en base, par type de rendez-vous et à partir d'une date, regroupés par jour en heure de Paris. Le suivi reste réservé aux clients connectés, comme dans l'API de réservation ; sans créneau, l'assistant propose la liste d'attente.
  - `propose_booking` : carte « Réserver : Appel découverte » (ou audit) sous la réponse. « Continuer avec ce résumé » ou « Continuer sans le résumé » ouvre `/rendez-vous` avec le type présélectionné et, au choix de la personne, un résumé de sa demande dans « Ce qui vous amène », par le contrat de préremplissage existant (sessionStorage, jamais dans l'URL ; événement `synego:booking-prefill` quand le formulaire est déjà affiché). Rien n'est réservé ni envoyé à Youcef à cette étape.
  - `show_crisis_resources` : encart des numéros d'urgence (3114, 15, 112).
- **Sécurité et bien-être** : consignes strictes (ni diagnostic ni conseil médical, aucune invention de tarif, de coordonnées ou de parcours non publiés, sujets hors périmètre déclinés, tentatives de détournement ignorées, jamais au nom de Youcef). Un repérage sans IA des messages qui évoquent une détresse (`src/lib/assistant/safety.ts`, français et anglais) affiche l'encart d'urgence avant même la réponse et en avertit le modèle.
- **Données personnelles** : le modèle ne reçoit jamais le nom, l'e-mail, le téléphone, les rendez-vous, les documents ni le journal, et n'a accès à aucun compte. `store: false` : OpenAI ne conserve pas les réponses pour les relire. Le site n'enregistre aucune conversation. La page Confidentialité déclare OpenAI comme sous-traitant.
- **Coût et abus** : 20 messages par quart d'heure et par connexion (empreinte de l'adresse IP dans `login_attempts`, jamais l'adresse elle-même ; compteur en mémoire si la base ne répond pas), plafond quotidien pour tout le site (`ASSISTANT_DAILY_LIMIT`, 500 par défaut), 20 derniers messages transmis, 6 000 jetons de sortie au plus (raisonnement compris), contrôle d'origine comme `/api/portal`. La base de connaissances (environ 22 000 jetons) ouvre chaque requête et porte un point de cache : relue depuis le cache d'OpenAI, elle coûte 0,05 $ par million de jetons au lieu de 1 $. Ordre de grandeur : quelques dixièmes de centime par message une fois le cache chaud, environ 3 centimes quand il faut l'écrire. Si OpenAI refuse un paramètre facultatif (cache explicite, verbosité), la requête repart sans lui et l'assistant reste disponible. Les journaux indiquent les jetons consommés (entrée, cache, sortie), jamais le contenu.
- **Sans `OPENAI_API_KEY`**, l'assistant est désactivé : pas de bouton, et `/api/assistant` répond 503.

Hors périmètre (décision de l'équipe) : paiement.

### Configurer l'envoi d'e-mails (Resend)

| Variable               | Rôle                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`       | Clé d'API Resend, `re_…` (**serveur uniquement**, jamais dans le navigateur ni dans une variable `NEXT_PUBLIC_`). Sans elle, aucun e-mail ne part ; en développement, le terminal indique ce qui aurait été envoyé. |
| `MAIL_FROM`            | Expéditeur (`noreply@abdu.fr` par défaut) : son domaine doit être **vérifié dans Resend**     |
| `MAIL_FROM_NAME`       | Nom affiché (`Youcef · Synégo` par défaut)                                                    |
| `MAIL_REPLY_TO`        | Facultatif : adresse de réponse (ex. `contact@abdu.fr`), **sur le même domaine que `MAIL_FROM`**, sinon ignorée (avertissement dans les journaux). Sans elle, aucun Reply-To n'est envoyé. |
| `MAIL_ADMIN_TO`        | Destinataire des notifications du gérant (sinon `ADMIN_EMAIL`)                               |
| `CRON_SECRET`          | Secret de la tâche planifiée des rappels de la veille (`openssl rand -hex 24`), envoyé automatiquement par Vercel ; vide = rappels désactivés |
| `SITE_URL`             | Adresse publique du site, pour les liens et le logo des e-mails                               |

Mise en place, une fois :
1. Créer un compte sur [resend.com](https://resend.com), puis **Domains → Add Domain** : `abdu.fr` (région Europe, `eu-west-1`, de préférence).
2. Ajouter chez le registrar de `abdu.fr` les enregistrements DNS affichés par Resend : DKIM (`resend._domainkey`), et MX + SPF sur le sous-domaine `send` (adresse de retour). Attendre que le domaine passe « Verified ».
3. **API Keys → Create API Key** (permission « Sending access », limitée au domaine `abdu.fr`), puis renseigner `RESEND_API_KEY` dans `.env.local` et dans Vercel (Settings → Environment Variables), et redéployer.

À savoir : une clé refusée ou un domaine non vérifié est journalisé (`[mail] envoi refusé par Resend (403)…`) sans bloquer le site ; l'onglet **Emails** de Resend montre l'état de chaque message (remis, rebond, plainte). Offre gratuite : 100 e-mails par jour et 3 000 par mois. Un domaine neuf finit facilement dans les indésirables : d'où un vrai nom d'expéditeur, un contenu réaliste et une version texte dans chaque e-mail. Pas de pièce jointe envoyée (le lien Google Agenda remplace le fichier `.ics`).

### Configurer l'assistant IA (OpenAI)

| Variable                  | Rôle                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`          | Clé d'API OpenAI, `sk-…` (**serveur uniquement**, jamais dans une variable `NEXT_PUBLIC_`). Sans elle, l'assistant est désactivé. |
| `OPENAI_MODEL`            | Modèle, `gpt-6.1-terra` par défaut                                                            |
| `OPENAI_REASONING_EFFORT` | Effort de raisonnement : `none`, `low` (par défaut), `medium`, `high`, `xhigh` ou `max`        |
| `ASSISTANT_DAILY_LIMIT`   | Messages acceptés par jour pour tout le site (500 par défaut)                                 |
| `OPENAI_API_URL`          | Adresse de l'API Responses (`https://api.openai.com/v1/responses` par défaut ; faux serveur dans les tests) |

Mise en place, une fois :
1. Sur [platform.openai.com](https://platform.openai.com), créer un projet « Synégo » et une clé d'API propre à ce projet ; fixer un budget mensuel et des alertes de facturation.
2. Renseigner `OPENAI_API_KEY` dans `.env.local` et dans Vercel (Settings → Environment Variables), puis redéployer : le bouton « Une question ? » apparaît.
3. Contrôler les journaux : `[assistant] gpt-6.1-terra completed · entrée … (cache …) · sortie …` à chaque réponse. Une clé ou un modèle refusé donne `[assistant] OpenAI indisponible : 401 …` ; le visiteur voit alors « L'assistant n'a pas pu répondre ».

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

`pnpm test` lance aussi, l'un après l'autre et chacun avec sa base temporaire :
- `tests/journal.test.mjs` : journal d'humeur (entrée du jour remplacée, validation, isolation entre clients, lecture par le gérant sans écriture, refus pour un visiteur, suppression en cascade avec le compte) ;
- `tests/seances.test.mjs` : préparation (refusée après le début et aux autres comptes), compte rendu réservé au gérant sur une séance réalisée, actions cochées par le bon client seulement, e-mail unique et sans contenu ;
- `tests/liste-attente.test.mjs` : inscription, alertes à l'annulation et à l'ajout de créneaux, pas de double alerte, règle des 2 heures, limite de débit, désinscription ;
- `tests/rappels.test.mjs` : jeton exigé, rappel du lendemain seulement, idempotence sur double appel, nouveau rappel après déplacement, langue, échec Resend réessayé ;
- `tests/assistant-creneaux.test.mjs` : assistant avec une vraie base et un faux OpenAI : créneaux réels lus par l'outil (regroupés par jour, heure de Paris, filtre par date), suivi refusé au visiteur et proposé au client connecté, aucune donnée personnelle envoyée à OpenAI, compteur de débit en base sous forme d'empreinte (20 messages, puis 429).

`pnpm test:i18n` lance aussi `tests/self-assessment.test.mjs` (paliers du questionnaire, résumé, contrat de préremplissage, numéros d'urgence dans les deux langues), `tests/sections.test.mjs` (témoignages masqués sans données, récapitulatif du configurateur) et `tests/assistant.test.mjs` : Markdown sûr, repérage de la détresse, validation des requêtes, schémas d'outils stricts, puis l'API de l'assistant contre un faux serveur OpenAI, sans base (flux, base de connaissances et contexte envoyés, jeton d'URL jamais transmis, outils et rejeu du raisonnement chiffré, encart d'urgence, réponse coupée, erreurs traduites, nouvel essai sans paramètre facultatif refusé, limites par visiteur et par jour). `I18N_TEST_PORT` et `ASSISTANT_TEST_PORT` changent le port du serveur de ces tests. Sans `OPENAI_API_KEY`, `tests/i18n.test.mjs` vérifie que l'assistant est absent des pages et que son API répond 503.

## Structure

```
src/
├── app/
│   ├── layout.tsx            # Layout racine, langue, polices et métadonnées
│   ├── (site)/               # Pages publiques en français et anglais
│   ├── api/portal/route.ts   # API : réservation, connexion, support, espace gérant
│   ├── api/assistant/        # API de l'assistant IA (réponse en flux)
│   └── api/cron/rappels/     # Tâche planifiée : rappels de la veille
├── components/
│   ├── account/              # Connexion, espace client, espace gérant, support
│   ├── assistant/            # Bouton et panneau de conversation de l'assistant IA
│   ├── booking/              # Formulaire de réservation, sélecteur de créneaux, liste d'attente
│   ├── quiz/                 # Questionnaire d'auto-évaluation
│   ├── seminars/             # Configurateur de séminaire
│   ├── layout/               # En-tête, pied de page, logo, menu mobile
│   ├── i18n/                 # Langue, apparence, dates et requêtes API
│   ├── legal/                # Pages légales
│   ├── sections/             # Blocs de page réutilisables
│   └── ui/                   # Composants shadcn
├── config/site.ts            # Nom, navigation, formats de rendez-vous
├── content/                  # Dictionnaires français et anglais
├── db/schema.ts              # Schéma Drizzle
└── lib/
    ├── assistant/            # Assistant IA : base de connaissances, client OpenAI, outils, limites
    ├── booking-prefill.ts    # Préremplissage du formulaire de réservation
    ├── format.ts             # Dates (heure de Paris) et gabarits de texte
    ├── quiz.ts               # Paliers et résumé du questionnaire
    ├── waitlist.ts           # Liste d'attente
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
- Questionnaire d'auto-évaluation : formulation des questions et des paliers, à relire par Youcef.
- Témoignages : en recueillir avec l'accord écrit des personnes avant de les publier.
- Rappels de la veille : définir `CRON_SECRET` dans Vercel pour les activer.
- Assistant IA : créer le projet OpenAI (clé, budget), accepter l'avenant sur le traitement des données (DPA) d'OpenAI et vérifier ses conditions de conservation pour la page Confidentialité ; relire avec Youcef les réponses aux questions fréquentes. Tant que tarifs, parcours et coordonnées ne sont pas publiés, l'assistant répond qu'ils ne le sont pas encore.
- Pages légales et confidentialité (le champ « intention » peut contenir des informations sensibles).
- Hébergement : Postgres installé sur le serveur, sauvegardes et HTTPS.
