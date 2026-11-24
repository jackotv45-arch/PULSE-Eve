import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Client navigateur : sert uniquement à la connexion des administrateurs (session). */
export function browserSupabase() {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) {
    throw new Error("Configuration Supabase publique absente. Vérifiez SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sur Vercel, puis redéployez.");
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "pulse-admin-auth" },
  });
  return client;
}
