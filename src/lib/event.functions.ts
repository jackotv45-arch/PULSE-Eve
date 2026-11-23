import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  MIN_FILL_MS,
  normalizePhone,
  registrationRequestSchema,
  type RegisterResult,
} from "./registration";

export type PublicEvent = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  venue: string;
  address: string | null;
  capacity: number | null;
  registrationsOpen: boolean;
  organizer: string | null;
  registeredCount: number;
};

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "Supabase absent : copiez .env.example vers .env et renseignez SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getPublicEvent = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicEvent | null> => {
    const { data: rows, error } = await publicClient().rpc("get_public_event", {
      p_slug: data.slug,
    });
    if (error) {
      console.error("get_public_event failed", error);
      throw new Error("Événement indisponible");
    }
    const e = rows?.[0];
    if (!e) return null;
    return {
      slug: e.slug,
      title: e.title,
      tagline: e.tagline,
      description: e.description,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      venue: e.venue,
      address: e.address,
      capacity: e.capacity,
      registrationsOpen: e.registrations_open,
      organizer: e.organizer,
      registeredCount: e.registered_count,
    };
  });

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const registerParticipant = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    registrationRequestSchema.extend({ eventSlug: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data }): Promise<RegisterResult> => {
    // Robots : champ piège rempli ou formulaire envoyé trop vite → on fait semblant d'échouer.
    if (data.website || data.elapsedMs < MIN_FILL_MS) return { status: "error" };

    const ip =
      getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "unknown";
    const clientKey = await sha256(`${ip}|${getRequestHeader("user-agent") ?? ""}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("register_participant", {
      p_event_slug: data.eventSlug,
      p_last_name: data.lastName,
      p_first_name: data.firstName,
      p_age: data.age,
      p_email: data.email,
      p_phone: data.phone,
      p_phone_normalized: normalizePhone(data.phone),
      p_profession: data.profession,
      p_organization: data.organization ?? "",
      p_client_key: clientKey,
    });
    if (error || !result) {
      console.error("register_participant failed", error);
      return { status: "error" };
    }
    return result as RegisterResult;
  });

export type Ticket = {
  firstName: string;
  lastName: string;
  reference: string;
  status: "confirmed" | "cancelled";
  checkedInAt: string | null;
  qrToken: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string | null;
  eventVenue: string;
  eventAddress: string | null;
};

export const getTicket = createServerFn({ method: "GET" })
  .validator((input: { token: string }) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<Ticket | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error } = await supabaseAdmin.rpc("get_ticket", { p_token: data.token });
    if (error) {
      console.error("get_ticket failed", error);
      throw new Error("Billet indisponible");
    }
    if (!t) return null;
    const r = t as Record<string, string | null>;
    return {
      firstName: r["first_name"] ?? "",
      lastName: r["last_name"] ?? "",
      reference: r["reference"] ?? "",
      status: (r["status"] as Ticket["status"]) ?? "confirmed",
      checkedInAt: r["checked_in_at"] ?? null,
      qrToken: r["qr_token"] ?? "",
      eventTitle: r["event_title"] ?? "",
      eventStartsAt: r["event_starts_at"] ?? "",
      eventEndsAt: r["event_ends_at"] ?? null,
      eventVenue: r["event_venue"] ?? "",
      eventAddress: r["event_address"] ?? null,
    };
  });
