import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus, Trash2, ArrowUp, ArrowDown, Upload, X } from "lucide-react";
import { deleteEvent, saveEvent, type AdminEvent } from "@/lib/admin/admin.functions";
import { eventInputSchema, type EventInput } from "@/lib/admin/schemas";
import { browserSupabase } from "@/lib/supabase-browser";
import { errMsg } from "./useAdmin";

const IMAGE_BUCKET = "uenergy-event-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
type ImageTarget = "hero" | `programme:${number}`;

/** ISO → valeur d'un champ datetime-local à l'heure de Libreville (UTC+1). */
const toLocal = (iso: string) => {
  if (!iso) return "";
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "";
  const d = new Date(timestamp + 60 * 60 * 1000);
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
  venue: "Salle UENERGY",
  address: "",
  capacity: 1000,
  participantsTargetMin: 600,
  registrationsOpen: true,
  organizer: "UENERGY Libreville",
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
  const [uploadingTarget, setUploadingTarget] = useState<ImageTarget | null>(null);
  const set = <K extends keyof EventInput>(k: K, val: EventInput[K]) => setV((p) => ({ ...p, [k]: val }));

  async function uploadImage(file: File, target: ImageTarget, onUploaded: (url: string) => void) {
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : null;
    if (!extension) {
      setMsg({ ok: false, text: "Choisis une image au format JPG, PNG ou WebP." });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setMsg({ ok: false, text: "L’image doit faire 5 Mo maximum." });
      return;
    }

    setUploadingTarget(target);
    setMsg(null);
    try {
      const path = `${event?.id ?? "new"}/${target.replace(":", "-")}/${crypto.randomUUID()}.${extension}`;
      const storage = browserSupabase().storage.from(IMAGE_BUCKET);
      const { data, error } = await storage.upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      onUploaded(storage.getPublicUrl(data.path).data.publicUrl);
      setMsg({ ok: true, text: "Image envoyée. Enregistre les modifications pour l’afficher sur le site." });
    } catch (error) {
      setMsg({ ok: false, text: `Échec de l’envoi de l’image : ${errMsg(error)}` });
    } finally {
      setUploadingTarget(null);
    }
  }

  function imagePicker(label: string, value: string, target: ImageTarget, onChange: (url: string) => void) {
    const busy = uploadingTarget !== null;
    return (
      <div className="adm-image-control">
        <div className="adm-image-control-head">
          <span>{label}</span>
          <small>JPG, PNG ou WebP · 5 Mo maximum</small>
        </div>
        <div className="adm-image-control-actions">
          <label className={`adm-btn adm-file-label${!isAdmin || busy ? " disabled" : ""}`}>
            <Upload size={14} /> {uploadingTarget === target ? "Envoi en cours…" : value ? "Remplacer l’image" : "Choisir une image"}
            <input
              className="adm-image-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!isAdmin || busy}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) void uploadImage(file, target, onChange);
              }}
            />
          </label>
          {value && (
            <button type="button" className="adm-btn danger" disabled={!isAdmin || busy} onClick={() => onChange("")}>
              <X size={14} /> Retirer
            </button>
          )}
        </div>
        {value && <img className="adm-image-preview" src={value} alt={`Aperçu : ${label}`} />}
      </div>
    );
  }

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

  const input = (k: "title" | "slug" | "tagline" | "venue" | "address" | "organizer", label: string, full = false) => (
    <label className={`adm-field${full ? " full" : ""}`}>
      <span>{label}</span>
      <input className="adm-input" disabled={!isAdmin} value={v[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <div>
      <div className="adm-form">
        {input("title", "Titre de l’événement")}
        {input("slug", "Identifiant d’URL (ex. uenergy-fit-day)")}
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
        <label className="adm-field">
          <span>Nombre de participants attendu (minimum)</span>
          <input
            className="adm-input"
            type="number"
            min={1}
            disabled={!isAdmin}
            value={v.participantsTargetMin ?? ""}
            onChange={(e) => set("participantsTargetMin", e.target.value ? Number(e.target.value) : null)}
          />
        </label>
        {input("organizer", "Organisateur")}
        <div className="full">
          {imagePicker("Image principale", v.heroImage, "hero", (url) => set("heroImage", url))}
        </div>
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
            {imagePicker(`Image du temps fort ${i + 1}`, p.img, `programme:${i}`, (url) => up("img", url))}
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
              disabled={del.isPending || uploadingTarget !== null}
              onClick={() => confirm("Supprimer définitivement cet événement et toutes ses inscriptions ?") && del.mutate()}
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
          <button type="button" className="button" disabled={save.isPending || uploadingTarget !== null} onClick={() => save.mutate()}>
            {uploadingTarget !== null ? "Envoi de l’image…" : save.isPending ? "Enregistrement…" : event ? "Enregistrer les modifications" : "Créer l’événement"} <ArrowUpRight size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
