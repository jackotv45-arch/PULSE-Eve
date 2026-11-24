import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase-browser";

/** Session admin côté navigateur (lue après hydratation). */
export function useAdminSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const sb = browserSupabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Une erreur est survenue");

export const ACTION_LABELS: Record<string, string> = {
  "registration.created": "Inscription",
  "registration.updated": "Inscription modifiée",
  "registration.cancelled": "Inscription annulée",
  "registration.restored": "Inscription rétablie",
  "scan.accepted": "Entrée validée",
  "scan.rejected": "Scan refusé",
  "checkin.undone": "Présence annulée",
  "event.created": "Événement créé",
  "event.updated": "Événement modifié",
};

export const REJECT_LABELS: Record<string, string> = {
  already: "déjà scanné",
  cancelled: "inscription annulée",
  unknown: "code inconnu",
  invalid: "code invalide",
};

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const fmt = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Libreville" }).format(new Date(iso))
    : "—";
