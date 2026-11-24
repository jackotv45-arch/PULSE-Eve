import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Printer, RotateCcw, UserCheck, X } from "lucide-react";
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
      return [r.firstName, r.lastName, r.email, r.phone, r.reference, r.organization].join(" ").toLowerCase().includes(s);
    });
  }, [regs, q, filter]);

  function exportCsv() {
    downloadCsv(`inscrits-${event.slug}.csv`, [
      ["Référence", "Nom", "Prénom", "Âge", "E-mail", "Téléphone", "Profession", "Organisation", "Statut", "Présence", "Inscrit le"],
      ...list.map((r) => [
        r.reference, r.lastName, r.firstName, r.age, r.email, r.phone, r.profession, r.organization,
        r.status === "cancelled" ? "Annulé" : "Confirmé", r.checkedInAt ? fmt(r.checkedInAt) : "Absent", fmt(r.createdAt),
      ]),
    ]);
  }

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
        <button className="adm-btn" onClick={exportCsv}><Download size={14} /> Excel (CSV)</button>
        <button className="adm-btn" onClick={() => window.print()}><Printer size={14} /> PDF</button>
      </div>
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
                <td><b>{r.firstName} {r.lastName}</b><br /><span className="muted">{r.age} ans</span></td>
                <td>{r.email}<br /><span className="muted">{r.phone}</span></td>
                <td>{r.profession}<br /><span className="muted">{r.organization}</span></td>
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
                          <button className="adm-btn sm danger" onClick={() => confirm(`Annuler l’inscription de ${r.firstName} ?`) && run.mutate(() => setRegistrationStatus({ data: { id: r.id, status: "cancelled" } }))}>
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
  const [v, setV] = useState({ ...reg, age: String(reg.age) });
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () =>
      updateRegistration({
        data: {
          id: reg.id, lastName: v.lastName, firstName: v.firstName, age: Number(v.age), email: v.email,
          phone: v.phone, profession: v.profession, organization: v.organization,
        },
      }),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(errMsg(e)),
  });
  const f = (k: "lastName" | "firstName" | "age" | "email" | "phone" | "profession" | "organization", l: string) => (
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
          {f("lastName", "Nom")}{f("firstName", "Prénom")}{f("age", "Âge")}{f("phone", "Téléphone")}
          {f("email", "E-mail")}{f("profession", "Profession")}{f("organization", "Organisation")}
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
