import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Rend les variables du fichier .env disponibles côté serveur.
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  // Ces deux valeurs sont publiques. La clé service-role reste strictement côté serveur.
  const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"] || env["NEXT_PUBLIC_SUPABASE_URL"] || "";
  const supabasePublishableKey =
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    env["SUPABASE_PUBLISHABLE_KEY"] ||
    env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ||
    "";

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
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
