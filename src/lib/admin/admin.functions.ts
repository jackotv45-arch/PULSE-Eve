import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireStaff } from "./auth-middleware";
import {
  eventInputSchema,
  registrationEditSchema,
  staffInputSchema,
  strongPassword,
  type FaqItem,
  type ProgrammeItem,
} from "./schemas";
import { normalizePhone } from "@/lib/registration";

const uuid = z.string().uuid();

export type AdminEvent = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  capacity: number | null;
  participantsTargetMin: number | null;
  registrationsOpen: boolean;
  organizer: string;
  heroImage: string;
  isFeatured: boolean;
  programme: ProgrammeItem[];
  faq: FaqItem[];
};

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

function mapProgramme(value: unknown): ProgrammeItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ProgrammeItem[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Row;
    return [{ time: s(row["time"]), tag: s(row["tag"]), title: s(row["title"]), text: s(row["text"]), img: s(row["img"]) }];
  });
}

function mapFaq(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): FaqItem[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Row;
    return [{ q: s(row["q"]), a: s(row["a"]) }];
  });
}

function mapEvent(e: Row): AdminEvent {
  return {
    id: s(e["id"]),
    slug: s(e["slug"]),
    title: s(e["title"]),
    tagline: s(e["tagline"]),
    description: s(e["description"]),
    startsAt: s(e["starts_at"]),
    endsAt: s(e["ends_at"]),
    venue: s(e["venue"]),
    address: s(e["address"]),
    capacity: (e["capacity"] as number | null) ?? null,
    participantsTargetMin: (e["participants_target_min"] as number | null) ?? null,
    registrationsOpen: Boolean(e["registrations_open"]),
    organizer: s(e["organizer"]),
    heroImage: s(e["hero_image"]),
    isFeatured: Boolean(e["is_featured"]),
    programme: mapProgramme(e["programme"]),
    faq: mapFaq(e["faq"]),
  };
}

/* ---------- Session / premier compte ---------- */

export const getBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { adminDb } = await import("./admin-client.server");
  const { count, error } = await adminDb().from("staff").select("user_id", { count: "exact", head: true });
  if (error) throw new Error(`Impossible de vérifier les comptes administrateurs : ${error.message}`);
  return { needsSetup: (count ?? 0) === 0 };
});

/** Crée le tout premier administrateur. Refusé dès qu'un compte existe. */
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .validator((i: unknown) =>
    z.object({ email: z.string().trim().email(), password: strongPassword, fullName: z.string().trim().max(120) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { adminDb } = await import("./admin-client.server");
    const db = adminDb();
    const { count } = await db.from("staff").select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Un administrateur existe déjà");
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Création impossible");
    const { error: staffError } = await db.from("staff").insert({ user_id: created.user.id, email: data.email, full_name: data.fullName, role: "admin" });
    if (staffError) throw new Error(`Compte créé, mais son accès administrateur n’a pas pu être enregistré : ${staffError.message}`);
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireStaff])
  .handler(async ({ context }) => ({ userId: context.userId, role: context.role, email: context.email }));

/* ---------- Événements ---------- */

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireStaff])
  .handler(async ({ context }) => {
    const { data, error } = await context.db.from("events").select("*").order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Row[]).map(mapEvent);
  });

export const saveEvent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => eventInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const row = {
      slug: data.slug,
      title: data.title,
      tagline: data.tagline || null,
      description: data.description || null,
      starts_at: new Date(data.startsAt).toISOString(),
      ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : null,
      venue: data.venue,
      address: data.address || null,
      capacity: data.capacity,
      participants_target_min: data.participantsTargetMin,
      registrations_open: data.registrationsOpen,
      organizer: data.organizer || null,
      hero_image: data.heroImage || null,
      programme: data.programme,
      faq: data.faq,
      updated_at: new Date().toISOString(),
    };
    const db = context.db;
    if (data.isFeatured) await db.from("events").update({ is_featured: false }).neq("slug", data.slug);
    const q = data.id
      ? db.from("events").update({ ...row, is_featured: data.isFeatured }).eq("id", data.id).select("id").single()
      : db.from("events").insert({ ...row, is_featured: data.isFeatured }).select("id").single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.code === "23505" ? "Cet identifiant d’URL est déjà utilisé" : error.message);
    await db.from("audit_log").insert({
      event_id: saved.id,
      action: data.id ? "event.updated" : "event.created",
      actor_id: context.userId,
      details: { title: data.title },
    });
    return { id: saved.id as string };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Tableau de bord / inscrits ---------- */

export type AdminRegistration = {
  id: string;
  reference: string;
  participantName: string;
  gender: string;
  ageRange: string;
  email: string;
  phone: string;
  profession: string;
  receiveUpdates: boolean;
  status: "confirmed" | "cancelled";
  checkedInAt: string | null;
  createdAt: string;
};

export type AuditEntry = { id: string; action: string; createdAt: string; actor: string; participant: string; details: Record<string, string | number | boolean | null> };

export const getEventData = createServerFn({ method: "GET" })
  .middleware([requireStaff])
  .validator((i: { eventId: string }) => z.object({ eventId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const [regs, logs, staff] = await Promise.all([
      db.from("registrations").select("*").eq("event_id", data.eventId).order("created_at", { ascending: false }),
      db.from("audit_log").select("*").eq("event_id", data.eventId).order("created_at", { ascending: false }).limit(300),
      db.from("staff").select("user_id,email,full_name"),
    ]);
    if (regs.error) throw new Error(regs.error.message);
    const registrations: AdminRegistration[] = (regs.data as Row[]).map((r) => ({
      id: s(r["id"]),
      reference: s(r["reference"]),
      participantName: s(r["participant_name"]) || [r["first_name"], r["last_name"]].filter(Boolean).map(s).join(" "),
      gender: s(r["gender"]),
      ageRange: s(r["age_range"]) || (r["age"] == null ? "" : `${s(r["age"])} ans`),
      email: s(r["email"]),
      phone: s(r["phone"]),
      profession: s(r["profession"]),
      receiveUpdates: Boolean(r["receive_updates"]),
      status: r["status"] as AdminRegistration["status"],
      checkedInAt: (r["checked_in_at"] as string | null) ?? null,
      createdAt: s(r["created_at"]),
    }));
    const names = new Map((staff.data as Row[] | null)?.map((x) => [s(x["user_id"]), s(x["full_name"]) || s(x["email"])]));
    const regName = new Map(registrations.map((r) => [r.id, r.participantName]));
    const audit: AuditEntry[] = ((logs.data as Row[] | null) ?? []).map((l) => ({
      id: s(l["id"]),
      action: s(l["action"]),
      createdAt: s(l["created_at"]),
      actor: l["actor_id"] ? (names.get(s(l["actor_id"])) ?? "Compte supprimé") : "Participant",
      participant: regName.get(s(l["registration_id"])) ?? "",
      details: (l["details"] as AuditEntry["details"]) ?? {},
    }));
    return { registrations, audit };
  });

export const updateRegistration = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => registrationEditSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.db
      .from("registrations")
      .update({
        participant_name: data.participantName,
        gender: data.gender,
        age_range: data.ageRange,
        email: data.email,
        email_normalized: data.email.toLowerCase(),
        phone: data.phone,
        phone_normalized: normalizePhone(data.phone),
        profession: data.profession,
        receive_updates: data.receiveUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("event_id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "E-mail ou téléphone déjà utilisé pour cet événement" : error.message);
    await context.db.from("audit_log").insert({
      event_id: r.event_id,
      registration_id: data.id,
      action: "registration.updated",
      actor_id: context.userId,
    });
    return { ok: true };
  });

export const setRegistrationStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => z.object({ id: uuid, status: z.enum(["confirmed", "cancelled"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.db
      .from("registrations")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("event_id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "Une autre inscription active utilise déjà cet e-mail ou ce téléphone" : error.message);
    await context.db.from("audit_log").insert({
      event_id: r.event_id,
      registration_id: data.id,
      action: data.status === "cancelled" ? "registration.cancelled" : "registration.restored",
      actor_id: context.userId,
    });
    return { ok: true };
  });

export const undoCheckIn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.db
      .from("registrations")
      .update({ checked_in_at: null, checked_in_by: null, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("event_id")
      .single();
    if (error) throw new Error(error.message);
    await context.db.from("audit_log").insert({
      event_id: r.event_id,
      registration_id: data.id,
      action: "checkin.undone",
      actor_id: context.userId,
    });
    return { ok: true };
  });

export type CheckInResult =
  | { status: "ok"; name: string; reference: string }
  | { status: "already"; name: string; at: string }
  | { status: "cancelled"; name: string }
  | { status: "unknown" };

/** Scan QR (jeton) ou validation manuelle (id) — opération atomique côté base. */
export const checkIn = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .validator((i: unknown) =>
    z.object({ eventId: uuid, code: z.string().max(200).optional(), registrationId: uuid.optional() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<CheckInResult> => {
    const token = data.code ? data.code.trim().replace(/^PULSE-EVT:/, "") : null;
    if (token !== null && !/^[a-f0-9]{64}$/.test(token)) {
      await context.db.from("audit_log").insert({
        event_id: data.eventId,
        action: "scan.rejected",
        actor_id: context.userId,
        details: { reason: "invalid" },
      });
      return { status: "unknown" };
    }
    const { data: res, error } = await context.db.rpc("check_in_participant", {
      p_event_id: data.eventId,
      p_token: token,
      p_registration_id: data.registrationId ?? null,
      p_actor: context.userId,
    });
    if (error) throw new Error(error.message);
    return res as CheckInResult;
  });

/* ---------- Comptes admin / agents ---------- */

export type StaffMember = { userId: string; email: string; fullName: string; role: "admin" | "agent"; createdAt: string };

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }): Promise<StaffMember[]> => {
    const { data, error } = await context.db.from("staff").select("*").order("created_at");
    if (error) throw new Error(error.message);
    return (data as Row[]).map((x) => ({
      userId: s(x["user_id"]),
      email: s(x["email"]),
      fullName: s(x["full_name"]),
      role: x["role"] as StaffMember["role"],
      createdAt: s(x["created_at"]),
    }));
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => staffInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(/already/i.test(error?.message ?? "") ? "Un compte existe déjà avec cet e-mail" : (error?.message ?? "Création impossible"));
    }
    const { error: e2 } = await db.from("staff").insert({
      user_id: created.user.id,
      email: data.email,
      full_name: data.fullName || null,
      role: data.role,
      created_by: context.userId,
    });
    if (e2) throw new Error(e2.message);
    await db.from("audit_log").insert({ action: "staff.created", actor_id: context.userId, details: { email: data.email, role: data.role } });
    return { ok: true };
  });

export const updateStaffRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => z.object({ userId: uuid, role: z.enum(["admin", "agent"]) }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Vous ne pouvez pas changer votre propre rôle");
    const { error } = await context.db.from("staff").update({ role: data.role }).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => z.object({ userId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    const { error } = await context.db.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await context.db.from("audit_log").insert({ action: "staff.removed", actor_id: context.userId, details: { user: data.userId } });
    return { ok: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((i: unknown) => z.object({ userId: uuid, password: strongPassword }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
