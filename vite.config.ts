import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Rend les variables du fichier .env (y compris les clés serveur) disponibles via process.env.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      // src/server.ts enveloppe le rendu serveur pour afficher une page d'erreur propre.
      tanstackStart({ server: { entry: "server" } }),
      nitro(),
      viteReact(),
    ],
  };
});
