import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La langue dépend du cookie de chaque requête, y compris dans <html lang>.
  // Le rendu serveur dynamique évite de partager une page mise en cache entre langues.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
