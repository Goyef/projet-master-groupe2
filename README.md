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
