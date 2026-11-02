# Site web séminaires

Branche `feature/site-seminaires`, créée depuis `develop` au commit `8e6b77a`.

Application Next.js 16, React et TypeScript. La charte et le logo sont conservés ; le site est recentré sur les séminaires conformément au cahier des charges et aux réponses du client.

## Démarrer

Node.js 24.15 ou supérieur est requis pour le module SQLite natif.

```sh
npm ci
```

Copier `.env.example` vers `.env.local`, puis définir `ADMIN_EMAIL` et un `ADMIN_PASSWORD` unique d’au moins 12 caractères. Ne jamais commiter ces valeurs. Au premier accès à l’API, le compte gérant est créé si aucun gérant n’existe. Modifier ensuite la variable ne change pas le mot de passe du compte déjà créé.

```sh
npm run dev
```

Ouvrir http://localhost:3000. Le gérant se connecte sur `/espace-client`, ajoute les disponibilités, crée les comptes clients et partage les documents. Aucun créneau ou compte client fictif n’est préchargé.

```sh
npm run build
npm start
```

Si le stockage de configuration de télémétrie Next.js pose problème sous Windows, définir `NEXT_TELEMETRY_DISABLED=1` dans l’environnement du processus.

## Fonctionnement

- `/` : présentation, offre et réservation prospects sans compte.
- `/seminaires` : offre détaillée et thèmes transmis par le client.
- Appel de vente et audit : 45 minutes. L’audit est accessible aux prospects et aux clients connectés.
- Suivi réservé aux clients actifs connectés. La durée d’une heure reprend celle des séances individuelles ; l’équivalence avec le suivi reste à valider.
- Chaque disponibilité correspond à un seul rendez-vous. Les disponibilités ne peuvent pas se chevaucher. La transaction de réservation empêche deux réservations concurrentes d’un même créneau.
- Confirmation immédiate à l’écran, sans validation manuelle. Les e-mails et rappels ne sont pas implémentés car non définis dans le cahier des charges.
- `/espace-client` : connexion, rendez-vous personnels et documents autorisés. Le gérant y dispose d’une vue et d’actions supplémentaires.
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

Le dossier `dist/` et `preview.cjs` sont l’ancienne maquette statique conservée sur develop ; l’application actuelle utilise `app/`, `components/`, `lib/` et `public/`.
