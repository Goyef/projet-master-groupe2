# Journal des modifications

Les évolutions notables du site sont consignées ici. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon le [versionnage sémantique](https://semver.org/lang/fr/) ; chaque version publiée porte un tag `vX.Y.Z` sur `main` (procédure dans le [README](README.md#branches-versions-et-tags)).

## [Non publié]

### Ajouté

- **Assistant IA « Une question ? »** sur toutes les pages, incarné par une mascotte aux couleurs de Synégo et propulsé par `gpt-6.1-terra` (OpenAI, API Responses en flux) : réponses fondées sur tout le contenu et le fonctionnement du site, générés à partir des dictionnaires et des règles métier ; créneaux disponibles lus en direct ; carte de réservation qui préremplit le type de rendez-vous et, au choix, « Ce qui vous amène » ; encart des numéros d'urgence en cas de détresse ; français et anglais ; conversation conservée dans l'onglet ; limites de débit et plafond quotidien ; désactivé sans `OPENAI_API_KEY`.
- Auto-évaluation « Où en êtes-vous ? », liste d'attente, rappels la veille, journal d'humeur, préparation et comptes rendus de séance (PR #33).
- Lien Google Meet pour chaque rendez-vous en visio (PR #33).
- Icône d'écran d'accueil iPhone et manifeste d'application web (PR #32).

### Modifié

- Formulaire de réservation : un préremplissage déposé pendant que le formulaire est affiché est appliqué aussitôt (événement `synego:booking-prefill`).
- Page Confidentialité : OpenAI déclaré comme sous-traitant de l'assistant, données traitées et durées de conservation.

## [0.1.0] - 2026-11-04

Première version taguée, état de `main` après la PR #31 : site bilingue français / anglais avec thèmes et mode sombre ; réservation sans compte (appel découverte, audit séminaire) ; espace client (rendez-vous annulables ou déplaçables jusqu'à 24 h avant, documents débloqués au fil des séances, demandes de support, profil et mot de passe) ; espace gérant (tableau de bord, calendrier, disponibilités, comptes clients) ; agendas (Google Agenda, fichier .ics, lien d'abonnement) ; e-mails transactionnels (Resend) et mot de passe oublié.

[Non publié]: https://github.com/Goyef/projet-master-groupe2/compare/v0.1.0...develop
[0.1.0]: https://github.com/Goyef/projet-master-groupe2/tree/v0.1.0
