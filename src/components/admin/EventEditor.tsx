import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { deleteEvent, saveEvent, type AdminEvent } from "@/lib/admin/admin.functions";
import { eventInputSchema, type EventInput } from "@/lib/admin/schemas";
import { errMsg } from "./useAdmin";

/** ISO → valeur d'un champ datetime-local à l'heure de Libreville (UTC+1). */
const toLocal = (iso: string) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? `${v}:00+01:00` : "");

export const blankEvent = (): EventInput => ({
  slug: "",
  title: "",
  tagline: "",
  description: "",
  startsAt: "",
  endsAt: "",
  venue: "Salle PULSE",
  address: "",
  capacity: 100,
  registrationsOpen: true,
  organizer: "PULSE Libreville",
  heroImage: "",
  isFeatured: false,
  programme: [],
  faq: [],
});

function move<T>(list: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const c = [...list];
  [c[i], c[j]] = [c[j] as T, c[i] as T];
  return c;
}

export default function EventEditor({
  event,
  isAdmin,
  onSaved,
}: {
  event: AdminEvent | null;
  isAdmin: boolean;
  onSaved: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const [v, setV] = useState<EventInput>(() =>
    event ? { ...event, startsAt: toLocal(event.startsAt), endsAt: toLocal(event.endsAt) } : blankEvent(),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof EventInput>(k: K, val: EventInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const save = useMutation({
    mutationFn: async () => {
      const parsed = eventInputSchema.safeParse({
        ...v,
        startsAt: fromLocal(v.startsAt),
        endsAt: fromLocal(v.endsAt),
        id: event?.id,
      });
      if (!parsed.success) {
        const i = parsed.error.issues[0];
        throw new Error(`${i?.path.join(" › ")} : ${i?.message}`);
      }
      return saveEvent({ data: parsed.data });
    },
    onSuccess: async (r) => {
      setMsg({ ok: true, text: "Enregistré — le site public est à jour." });
      await qc.invalidateQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["event"] });
      onSaved(r.id);
    },
    onError: (e) => setMsg({ ok: false, text: errMsg(e) }),
  });
  const del = useMutation({
    mutationFn: () => deleteEvent({ data: { id: event!.id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      onSaved(null);
    },
    onError: (e) => setMsg({ ok: false, text: errMsg(e) }),
  });

  const input = (k: "title" | "slug" | "tagline" | "venue" | "address" | "organizer" | "heroImage", label: string, full = false) => (
    <label className={`adm-field${full ? " full" : ""}`}>
      <span>{label}</span>
      <input className="adm-input" disabled={!isAdmin} value={v[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <div>
      <div className="adm-form">
        {input("title", "Titre de l’événement")}
        {input("slug", "Identifiant d’URL (ex. pulse-fit-day)")}
        {input("tagline", "Accroche (sous le titre)", true)}
        <label className="adm-field full">
          <span>Description</span>
          <textarea className="adm-textarea" disabled={!isAdmin} value={v.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <label className="adm-field">
          <span>Début</span>
          <input className="adm-input" type="datetime-local" disabled={!isAdmin} value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </label>
        <label className="adm-field">
          <span>Fin</span>
          <input className="adm-input" type="datetime-local" disabled={!isAdmin} value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </label>
        {input("venue", "Lieu")}
        {input("address", "Adresse")}
        <label className="adm-field">
          <span>Capacité maximale (vide = illimitée)</span>
          <input
            className="adm-input"
            type="number"
            min={1}
            disabled={!isAdmin}
            value={v.capacity ?? ""}
            onChange={(e) => set("capacity", e.target.value ? Number(e.target.value) : null)}
          />
        </label>
        {input("organizer", "Organisateur")}
        {input("heroImage", "Image principale (URL ou /images/hero.jpg)", true)}
        <label className="adm-check">
          <input type="checkbox" disabled={!isAdmin} checked={v.registrationsOpen} onChange={(e) => set("registrationsOpen", e.target.checked)} />
          Inscriptions ouvertes
        </label>
        <label className="adm-check">
          <input type="checkbox" disabled={!isAdmin} checked={v.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
          Afficher cet événement sur la page d’accueil
        </label>
      </div>

      <div className="adm-section-title">
        <h3>PROGRAMME</h3>
        {isAdmin && (
          <button type="button" className="adm-btn" onClick={() => set("programme", [...v.programme, { time: "", tag: "", title: "", text: "", img: "" }])}>
            <Plus size={14} /> Ajouter un temps fort
          </button>
        )}
      </div>
      {v.programme.map((p, i) => {
        const up = (k: keyof typeof p, val: string) => set("programme", v.programme.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
        return (
          <div className="adm-item" key={i}>
            <div className="adm-item-head">
              <b>{String(i + 1).padStart(2, "0")}</b>
              {isAdmin && (
                <div className="adm-actions">
                  <button type="button" className="adm-btn sm" onClick={() => set("programme", move(v.programme, i, -1))} aria-label="Monter"><ArrowUp size={12} /></button>
                  <button type="button" className="adm-btn sm" onClick={() => set("programme", move(v.programme, i, 1))} aria-label="Descendre"><ArrowDown size={12} /></button>
                  <button type="button" className="adm-btn sm danger" onClick={() => set("programme", v.programme.filter((_, j) => j !== i))} aria-label="Supprimer"><Trash2 size={12} /></button>
                </div>
              )}
            </div>
            <div className="adm-row3">
              <input className="adm-input" placeholder="08h00" disabled={!isAdmin} value={p.time} onChange={(e) => up("time", e.target.value)} />
              <input className="adm-input" placeholder="Titre" disabled={!isAdmin} value={p.title} onChange={(e) => up("title", e.target.value)} />
              <input className="adm-input" placeholder="Étiquette" disabled={!isAdmin} value={p.tag} onChange={(e) => up("tag", e.target.value)} />
            </div>
            <input className="adm-input" placeholder="Texte" disabled={!isAdmin} value={p.text} onChange={(e) => up("text", e.target.value)} />
            <input className="adm-input" placeholder="Image (URL ou /images/club.jpg)" disabled={!isAdmin} value={p.img} onChange={(e) => up("img", e.target.value)} />
          </div>
        );
      })}
      {v.programme.length === 0 && <p className="muted">Aucun temps fort : la section Programme sera masquée sur le site.</p>}

      <div className="adm-section-title">
        <h3>FAQ</h3>
        {isAdmin && (
          <button type="button" className="adm-btn" onClick={() => set("faq", [...v.faq, { q: "", a: "" }])}>
            <Plus size={14} /> Ajouter une question
          </button>
        )}
      </div>
      {v.faq.map((f, i) => {
        const up = (k: "q" | "a", val: string) => set("faq", v.faq.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
        return (
          <div className="adm-item" key={i}>
            <div className="adm-item-head">
              <b>Q{i + 1}</b>
              {isAdmin && (
                <div className="adm-actions">
                  <button type="button" className="adm-btn sm" onClick={() => set("faq", move(v.faq, i, -1))} aria-label="Monter"><ArrowUp size={12} /></button>
                  <button type="button" className="adm-btn sm" onClick={() => set("faq", move(v.faq, i, 1))} aria-label="Descendre"><ArrowDown size={12} /></button>
                  <button type="button" className="adm-btn sm danger" onClick={() => set("faq", v.faq.filter((_, j) => j !== i))} aria-label="Supprimer"><Trash2 size={12} /></button>
                </div>
              )}
            </div>
            <input className="adm-input" placeholder="Question" disabled={!isAdmin} value={f.q} onChange={(e) => up("q", e.target.value)} />
            <textarea className="adm-textarea" placeholder="Réponse" disabled={!isAdmin} value={f.a} onChange={(e) => up("a", e.target.value)} />
          </div>
        );
      })}

      {isAdmin && (
        <div className="adm-savebar">
          {msg && <p className={msg.ok ? "adm-ok" : "adm-error"} style={{ marginRight: "auto", alignSelf: "center" }}>{msg.text}</p>}
          {event && (
            <button
              type="button"
              className="adm-btn danger"
              disabled={del.isPending}
              onClick={() => confirm("Supprimer définitivement cet événement et toutes ses inscriptions ?") && del.mutate()}
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
          <button type="button" className="button" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Enregistrement…" : event ? "Enregistrer les modifications" : "Créer l’événement"} <ArrowUpRight size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
