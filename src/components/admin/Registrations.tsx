import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Printer, RotateCcw, UserCheck, X } from "lucide-react";
import { AGE_RANGE_OPTIONS, GENDER_OPTIONS } from "@/lib/registration";
import {
  checkIn,
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
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "data", event.id] });
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      setError("");
      await refresh();
      await qc.invalidateQueries({ queryKey: ["event"] });
    },
    onError: (e) => setError(errMsg(e)),
  });

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
        <select className="adm-select" style={{ minWidth: 160 }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Tous ({regs.length})</option>
          <option value="present">Présents</option>
          <option value="absent">Absents</option>
          <option value="cancelled">Annulés</option>
        </select>
        <button className="adm-btn" onClick={exportCsv}><Download size={14} /> Inscriptions (CSV)</button>
        <button className="adm-btn" onClick={exportAttestationRecipients} disabled={presentCount === 0}>
          <Download size={14} /> Attestations des présents ({presentCount})
        </button>
        <button className="adm-btn" onClick={() => window.print()}><Printer size={14} /> PDF</button>
      </div>
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.7, marginBottom: 16 }}>
        Les attestations sont préparées et envoyées manuellement après validation de la présence. L’export dédié contient uniquement les participants présents.
      </p>
      {error && <p className="adm-error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Réf.</th><th>Participant</th><th>Contact</th><th>Profession</th><th>Statut</th><th>Présence</th><th />
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.id} className="row-in" style={delay(Math.min(i, 15) * 30)}>
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
          <label className="adm-field"><span>Sexe</span><select className="adm-select" value={v.gender} onChange={(e) => setV({ ...v, gender: e.target.value })}><option value="" disabled>Choisir…</option>{GENDER_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="adm-field"><span>Âge</span><select className="adm-select" value={v.ageRange} onChange={(e) => setV({ ...v, ageRange: e.target.value })}><option value="" disabled>Choisir…</option>{AGE_RANGE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
          {f("phone", "Téléphone")}{f("email", "E-mail")}{f("profession", "Profession / fonction")}
          <label className="adm-field"><span>Recevoir les informations UEnergy</span><select className="adm-select" value={v.receiveUpdates ? "yes" : "no"} onChange={(e) => setV({ ...v, receiveUpdates: e.target.value === "yes" })}><option value="yes">Oui</option><option value="no">Non</option></select></label>
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
