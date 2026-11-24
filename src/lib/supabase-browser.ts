import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Client navigateur : sert uniquement à la connexion des administrateurs (session). */
export function browserSupabase() {
  if (client) return client;
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!url || !key) {
    throw new Error("Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans le fichier .env.");
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "pulse-admin-auth" },
  });
  return client;
}
