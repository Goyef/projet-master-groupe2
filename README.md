# Site web séminaires

Application du groupe dans [`web/`](web/README.md), avec Next.js, Tailwind et shadcn/ui.

```sh
cd web
pnpm install --frozen-lockfile
```

Copier `web/.env.example` vers `web/.env.local`, puis renseigner les identifiants du gérant avec un mot de passe unique de 12 caractères minimum.

```sh
pnpm dev
```

Ouvrir http://localhost:3000. Consulter `web/README.md` pour les parcours, le stockage et les limites avant déploiement. Utiliser des données de test tant que les informations légales et les règles métier ne sont pas finalisées.

## Branches, versions et tags

- `main` : versions publiées ; `develop` : intégration. Chaque évolution part de `develop` sur une branche `feature/…` (ou `fix/…`) et y revient par une pull request ; `develop` est ensuite fusionnée dans `main` par une pull request pour publier.
- Versions selon le [versionnage sémantique](https://semver.org/lang/fr/) : tant que le site n'est pas ouvert au public, `0.MINEUR.CORRECTIF` (`0.x.0` pour de nouvelles fonctionnalités, `0.x.y` pour des corrections). La version figure dans `web/package.json`.
- Chaque version publiée porte un **tag annoté** `vX.Y.Z` sur le commit de fusion dans `main`. `v0.1.0` marque la version de référence (état de `main` après la PR #31). Les changements sont décrits dans [CHANGELOG.md](CHANGELOG.md), la section « Non publié » listant ce que contient `develop`.

Publier une version, depuis `develop` à jour :
1. Passer `version` de `web/package.json` à `X.Y.Z` et renommer la section « Non publié » du CHANGELOG en `[X.Y.Z] - AAAA-MM-JJ`, dans la pull request `develop` → `main`.
2. Une fois la pull request fusionnée : `git switch main && git pull`, puis `git tag -a vX.Y.Z -m "vX.Y.Z — résumé"` et `git push origin vX.Y.Z`.
3. Créer la release GitHub correspondante : `gh release create vX.Y.Z --title "vX.Y.Z" --notes "…"` (notes reprises du CHANGELOG).

Ne jamais déplacer ni supprimer un tag déjà poussé : publier une nouvelle version corrective à la place.
