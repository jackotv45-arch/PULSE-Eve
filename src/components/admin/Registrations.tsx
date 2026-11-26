import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Printer, RotateCcw, Trash2, UserCheck, X } from "lucide-react";
import { SiteSelect } from "@/components/ui/site-select";
import { AGE_RANGE_OPTIONS, GENDER_OPTIONS } from "@/lib/registration";
import {
  checkIn,
  resetEventRegistrations,
  setRegistrationStatus,
  undoCheckIn,
  updateRegistration,
  type AdminEvent,
  type AdminRegistration,
} from "@/lib/admin/admin.functions";
import { delay } from "@/components/pulse/reveal";
import { downloadCsv, errMsg, fmt } from "./useAdmin";

export default function Registrations({ event, regs, isAdmin }: { event: AdminEvent; regs: AdminRegistration[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "present" | "absent" | "cancelled">("all");
  const [edit, setEdit] = useState<AdminRegistration | null>(null);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "data", event.id] });
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      setError("");
      setResetSuccess("");
      await refresh();
      await qc.invalidateQueries({ queryKey: ["event"] });
    },
    onError: (e) => setError(errMsg(e)),
  });
  const reset = useMutation({
    mutationFn: () => resetEventRegistrations({ data: { eventId: event.id, confirmation: resetConfirmation } }),
    onSuccess: async ({ registrations, journalEntries }) => {
      setResetOpen(false);
      setResetConfirmation("");
      setResetError("");
      setResetSuccess(
        `${registrations} inscription${registrations === 1 ? "" : "s"} supprimée${registrations === 1 ? "" : "s"} et ${journalEntries} mouvement${journalEntries === 1 ? "" : "s"} de test effacé${journalEntries === 1 ? "" : "s"}.`,
      );
      await refresh();
      await qc.invalidateQueries({ queryKey: ["event"] });
    },
    onError: (e) => setResetError(errMsg(e)),
  });
  const resetConfirmationMatches = resetConfirmation.trim() === event.title.trim();

  function openReset() {
    setResetConfirmation("");
    setResetError("");
    setResetSuccess("");
    setResetOpen(true);
  }

  function closeReset() {
    if (reset.isPending) return;
    setResetOpen(false);
    setResetConfirmation("");
    setResetError("");
  }

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelected(new Set(list.map((r) => r.id)));
    else setSelected(new Set());
  };
  const isSelected = (id: string) => selected.has(id);
  const bulkCancel = async () => {
    await run.mutate(async () => {
      await Promise.all(
        [...selected].map((id) =>
          setRegistrationStatus({ data: { id, status: "cancelled" } })
        ),
      );
      setSelected(new Set());
      await refresh();
    });
  };
  const bulkRestore = async () => {
    await run.mutate(async () => {
      await Promise.all(
        [...selected].map((id) =>
          setRegistrationStatus({ data: { id, status: "confirmed" } })
        ),
      );
      setSelected(new Set());
      await refresh();
    });
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return regs.filter((r) => {
      if (filter === "present" && !(r.status === "confirmed" && r.checkedInAt)) return false;
      if (filter === "absent" && !(r.status === "confirmed" && !r.checkedInAt)) return false;
      if (filter === "cancelled" && r.status !== "cancelled") return false;
      if (!s) return true;
      return [r.participantName, r.gender, r.ageRange, r.email, r.phone, r.reference, r.profession].join(" ").toLowerCase().includes(s);
    });
  }, [regs, q, filter]);

  function exportCsv() {
    downloadCsv(`inscrits-${event.slug}.csv`, [
      ["Référence", "Nom ou prénom ou pseudo", "Sexe", "Tranche d’âge", "E-mail", "Téléphone", "Profession / fonction", "Informations UEnergy", "Statut", "Présence", "Inscrit le"],
      ...list.map((r) => [
        r.reference, r.participantName, r.gender, r.ageRange, r.email, r.phone, r.profession, r.receiveUpdates ? "Oui" : "Non",
        r.status === "cancelled" ? "Annulé" : "Confirmé", r.checkedInAt ? fmt(r.checkedInAt) : "Absent", fmt(r.createdAt),
      ]),
    ]);
  }

  function exportAttestationRecipients() {
    const present = regs.filter((r) => r.status === "confirmed" && r.checkedInAt);
    downloadCsv(`attestations-${event.slug}.csv`, [
      ["Participant", "E-mail", "Événement", "Référence", "Présence validée le"],
      ...present.map((r) => [r.participantName, r.email, event.title, r.reference, fmt(r.checkedInAt)]),
    ]);
  }
  const presentCount = regs.filter((r) => r.status === "confirmed" && r.checkedInAt).length;

  return (
    <>
      <div className="adm-toolbar">
        <input className="adm-input" placeholder="Rechercher : nom, e-mail, téléphone, référence…" value={q} onChange={(e) => setQ(e.target.value)} />
        <SiteSelect
          className="adm-select"
          style={{ minWidth: 160 }}
          value={filter}
          onValueChange={(value) => setFilter(value as typeof filter)}
          placeholder="Filtrer les inscrits"
          options={[
            { value: "all", label: `Tous (${regs.length})` },
            { value: "present", label: "Présents" },
            { value: "absent", label: "Absents" },
            { value: "cancelled", label: "Annulés" },
          ]}
        />
        <button className="adm-btn" onClick={exportCsv}><Download size={14} /> Inscriptions (CSV)</button>
        <button className="adm-btn" onClick={exportAttestationRecipients} disabled={presentCount === 0}>
          <Download size={14} /> Attestations des présents ({presentCount})
        </button>
        <button className="adm-btn" onClick={() => window.print()}><Printer size={14} /> PDF</button>
        {isAdmin && (
          <button className="adm-btn danger" onClick={openReset} disabled={event.registrationsOpen || reset.isPending}>
            <Trash2 size={14} /> Réinitialiser ({regs.length})
          </button>
        )}
      </div>
      {resetSuccess && <p className="adm-ok" role="status" style={{ margin: "0 0 12px", fontSize: 12 }}>{resetSuccess}</p>}
      {isAdmin && event.registrationsOpen && (
        <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 12 }}>
          Fermez d’abord les inscriptions dans « Événement & site » pour activer la remise à zéro.
        </p>
      )}
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.7, marginBottom: 16 }}>
        Les attestations sont préparées et envoyées manuellement après validation de la présence. L’export dédié contient uniquement les participants présents.
      </p>
      {error && <p className="adm-error" style={{ marginBottom: 12 }}>{error}</p>}
      {selected.size > 0 && (
        <div className="adm-toolbar" style={{ marginBottom: 12, paddingTop: 10, borderTop: "1px solid #333", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="muted">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <button className="adm-btn danger" onClick={bulkCancel} disabled={run.isPending}>
            Annuler la sélection
          </button>
          <button className="adm-btn" onClick={bulkRestore} disabled={run.isPending}>
            Rétablir la sélection
          </button>
          <button className="adm-btn" onClick={() => setSelected(new Set())} disabled={run.isPending}>
            Désélectionner
          </button>
        </div>
      )}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input
                  type="checkbox"
                  checked={list.length > 0 && selected.size === list.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  aria-label="Tout sélectionner"
                />
              </th>
              <th>Réf.</th><th>Participant</th><th>Contact</th><th>Profession</th><th>Statut</th><th>Présence</th><th />
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.id} className="row-in" style={{ ...delay(Math.min(i, 15) * 30), backgroundColor: isSelected(r.id) ? "rgba(255,255,255,0.06)" : undefined }}>
                <td style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    checked={isSelected(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    aria-label={`Sélectionner ${r.reference}`}
                  />
                </td>
                <td className="muted">{r.reference}</td>
                <td><b>{r.participantName}</b><br /><span className="muted">{r.gender || "—"} · {r.ageRange || "—"}</span></td>
                <td>{r.email}<br /><span className="muted">{r.phone}</span></td>
                <td>{r.profession}<br /><span className="muted">Infos UEnergy : {r.receiveUpdates ? "oui" : "non"}</span></td>
                <td>{r.status === "cancelled" ? <span className="adm-badge red">Annulé</span> : <span className="adm-badge">Confirmé</span>}</td>
                <td>{r.checkedInAt ? <span className="adm-ok">✓ {fmt(r.checkedInAt)}</span> : <span className="muted">—</span>}</td>
                <td>
                  <div className="adm-actions">
                    {r.status === "confirmed" && !r.checkedInAt && (
                      <button className="adm-btn sm" disabled={run.isPending} onClick={() => run.mutate(() => checkIn({ data: { eventId: event.id, registrationId: r.id } }))}>
                        <UserCheck size={12} /> Valider
                      </button>
                    )}
                    {isAdmin && r.checkedInAt && (
                      <button className="adm-btn sm" disabled={run.isPending} onClick={() => confirm("Annuler la présence ?") && run.mutate(() => undoCheckIn({ data: { id: r.id } }))}>
                        <RotateCcw size={12} />
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button className="adm-btn sm" onClick={() => setEdit(r)} aria-label="Modifier"><Pencil size={12} /></button>
                        {r.status === "confirmed" ? (
                          <button className="adm-btn sm danger" onClick={() => confirm(`Annuler l’inscription de ${r.participantName} ?`) && run.mutate(() => setRegistrationStatus({ data: { id: r.id, status: "cancelled" } }))}>
                            <X size={12} /> Annuler
                          </button>
                        ) : (
                          <button className="adm-btn sm" onClick={() => run.mutate(() => setRegistrationStatus({ data: { id: r.id, status: "confirmed" } }))}>
                            Rétablir
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 40 }}>Aucun inscrit ne correspond.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {resetOpen && (
        <div className="adm-modal-back" onClick={closeReset}>
          <div
            className="adm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-registrations-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adm-error" style={{ fontSize: 10, letterSpacing: 1.6, fontWeight: 700 }}>ACTION IRRÉVERSIBLE</div>
            <h3 id="reset-registrations-title">RÉINITIALISER LES INSCRIPTIONS ?</h3>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
              Toutes les inscriptions de « {event.title} » seront supprimées, y compris les inscriptions annulées et les présences validées.
              Les mouvements d’inscription et de scan associés seront aussi retirés du journal. Les réglages de l’événement seront conservés.
            </p>
            <label className="adm-field full" style={{ marginTop: 20 }}>
              <span>Saisissez le nom exact de l’événement : <b style={{ color: "#f5f5f5" }}>{event.title}</b></span>
              <input className="adm-input" value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} autoFocus />
            </label>
            {resetError && <p className="adm-error" role="alert" style={{ marginTop: 12 }}>{resetError}</p>}
            <div className="adm-savebar">
              <button className="adm-btn" onClick={closeReset} disabled={reset.isPending}>Garder les données</button>
              <button
                className="adm-btn danger"
                onClick={() => reset.mutate()}
                disabled={reset.isPending || !resetConfirmationMatches || event.registrationsOpen}
              >
                <Trash2 size={13} /> {reset.isPending ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
      {edit && <EditModal reg={edit} onClose={() => setEdit(null)} onSaved={refresh} />}
    </>
  );
}

function EditModal({ reg, onClose, onSaved }: { reg: AdminRegistration; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ ...reg });
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () =>
      updateRegistration({
        data: {
          id: reg.id, participantName: v.participantName, gender: v.gender as "Homme" | "Femme", ageRange: v.ageRange as (typeof AGE_RANGE_OPTIONS)[number], email: v.email,
          phone: v.phone, profession: v.profession, receiveUpdates: v.receiveUpdates,
        },
      }),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(errMsg(e)),
  });
  const f = (k: "participantName" | "email" | "phone" | "profession", l: string) => (
    <label className="adm-field">
      <span>{l}</span>
      <input className="adm-input" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="adm-modal-back" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow green">{reg.reference}</div>
        <h3>CORRIGER L’INSCRIPTION</h3>
        <div className="adm-form">
          {f("participantName", "Nom ou prénom ou pseudo")}
          <label className="adm-field"><span>Sexe</span><SiteSelect className="adm-select" value={v.gender} onValueChange={(gender) => setV({ ...v, gender })} placeholder="Choisir…" options={GENDER_OPTIONS.map((x) => ({ value: x, label: x }))} /></label>
          <label className="adm-field"><span>Âge</span><SiteSelect className="adm-select" value={v.ageRange} onValueChange={(ageRange) => setV({ ...v, ageRange })} placeholder="Choisir…" options={AGE_RANGE_OPTIONS.map((x) => ({ value: x, label: x }))} /></label>
          {f("phone", "Téléphone")}{f("email", "E-mail")}{f("profession", "Profession / fonction")}
          <label className="adm-field"><span>Recevoir les informations UEnergy</span><SiteSelect className="adm-select" value={v.receiveUpdates ? "yes" : "no"} onValueChange={(value) => setV({ ...v, receiveUpdates: value === "yes" })} placeholder="Choisir…" options={[{ value: "yes", label: "Oui" }, { value: "no", label: "Non" }]} /></label>
        </div>
        {error && <p className="adm-error" style={{ marginTop: 14 }}>{error}</p>}
        <div className="adm-savebar">
          <button className="adm-btn" onClick={onClose}>Fermer</button>
          <button className="button" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
