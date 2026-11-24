import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { browserSupabase } from "@/lib/supabase-browser";

export type StaffRole = "admin" | "agent";

/** Joint le jeton de session de l'admin à chaque appel serveur. */
export const attachToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await browserSupabase().auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

async function resolveStaff() {
  const auth = getRequestHeader("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Non connecté");
  const { adminDb } = await import("./admin-client.server");
  const db = adminDb();
  const { data: u, error } = await db.auth.getUser(token);
  if (error || !u.user) throw new Error("Session expirée, reconnectez-vous");
  const { data: staff } = await db.from("staff").select("role,email,full_name").eq("user_id", u.user.id).maybeSingle();
  if (!staff) throw new Error("Accès refusé : ce compte n’est pas autorisé");
  return { db, userId: u.user.id, role: staff.role as StaffRole, email: staff.email as string };
}

/** Admin ou agent de contrôle. */
export const requireStaff = createMiddleware({ type: "function" })
  .middleware([attachToken])
  .server(async ({ next }) => next({ context: await resolveStaff() }));

/** Administrateur uniquement. */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([attachToken])
  .server(async ({ next }) => {
    const ctx = await resolveStaff();
    if (ctx.role !== "admin") throw new Error("Réservé aux administrateurs");
    return next({ context: ctx });
  });
