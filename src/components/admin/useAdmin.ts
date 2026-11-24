import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase-browser";

export type AdminSessionState =
  | { status: "loading" }
  | { status: "ready"; session: Session | null }
  | { status: "error"; message: string };

/** Session admin côté navigateur (lue après hydratation). */
export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    try {
      const sb = browserSupabase();
      const { data } = sb.auth.onAuthStateChange((_e, session) => {
        if (active) setState({ status: "ready", session });
      });
      void sb.auth
        .getSession()
        .then(({ data: sessionData, error }) => {
          if (!active) return;
          if (error) setState({ status: "error", message: error.message });
          else setState({ status: "ready", session: sessionData.session });
        })
        .catch((error: unknown) => {
          if (active) setState({ status: "error", message: errorMessage(error) });
        });
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
      return undefined;
    }
  }, []);
  return state;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "La connexion à Supabase a échoué.";
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
