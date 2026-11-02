<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Règles du projet

## Interface : shadcn/ui en priorité

Toute interface se construit d'abord avec les composants **shadcn/ui** (style `base-nova`, basé sur **Base UI**, pas Radix). Avant d'écrire un composant à la main :

1. **Chercher le composant shadcn** correspondant dans `src/components/ui/` (installés : `Button`, `Badge`, `Card`, `Sheet`), puis dans le catalogue : https://ui.shadcn.com/docs/components
2. **S'il n'est pas installé, l'ajouter** avec la CLI plutôt que de le recoder :
   ```bash
   pnpm dlx shadcn@latest add <composant>
   ```
   Correspondances courantes : formulaire → `field` + `input` + `label` + `textarea` + `select` ; tableau → `table` ; onglets → `tabs` ; FAQ / accordéon → `accordion` ; modale → `dialog` / `alert-dialog` ; menu → `dropdown-menu` / `navigation-menu` ; date → `calendar` + `popover` ; notification → `sonner` ; séparateur → `separator` ; chargement → `skeleton` ; alerte → `alert`.
3. **Composer** les composants shadcn dans `src/components/sections/` ou `src/components/<domaine>/` plutôt que de créer des éléments HTML stylés (`<button>`, `<table>`, `<dialog>`, `<details>`…) à la main.
4. N'écrire un composant sur mesure que si aucun composant shadcn ne convient, et le construire alors à partir des primitives shadcn existantes.

### Conventions Base UI

- Pas de `asChild` : utiliser la prop `render`. Pour un lien qui a l'apparence d'un bouton :
  ```tsx
  <Button render={<Link href="/rendez-vous" />} nativeButton={false}>Prendre rendez-vous</Button>
  ```
- Les icônes viennent de `lucide-react` ; dans un bouton, utiliser `data-icon="inline-start"` ou `data-icon="inline-end"`.
- Ne pas modifier les fichiers de `src/components/ui/` pour un besoin ponctuel : passer par `className` ou les variantes (`variant`, `size`). Une modification de fond d'un composant ui doit rester générique et réutilisable.

### Style

- Utiliser les variables du thème (`bg-primary`, `bg-background`, `bg-card`, `text-muted-foreground`, `bg-accent`…) et les couleurs de la marque (`brand-navy`, `brand-ivory`, `brand-sky`, `brand-champagne`, `brand-diamond`) déclarées dans `src/app/globals.css`. Pas de couleurs hexadécimales en dur dans les composants.
- Fusionner les classes avec `cn()` (`@/lib/utils`).
- Titres : `font-heading` (appliquée par défaut aux `h1`–`h3`).

### Langue

Textes de l'interface, commentaires et messages de commit en français.
