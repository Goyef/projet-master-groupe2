import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations : connexion directe Neon si disponible (pas de PgBouncer), sinon l'URL de l'application.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgres://synego:synego@localhost:5432/synego",
  },
});
