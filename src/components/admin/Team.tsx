import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, KeyRound, Trash2 } from "lucide-react";
import { SiteSelect } from "@/components/ui/site-select";
import { createStaff, listStaff, removeStaff, resetStaffPassword, updateStaffRole } from "@/lib/admin/admin.functions";
import { staffInputSchema, strongPassword } from "@/lib/admin/schemas";
import { delay } from "@/components/pulse/reveal";
import { errMsg, fmt } from "./useAdmin";

export default function Team({ meId }: { meId: string }) {
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["admin", "staff"], queryFn: () => listStaff() });
  const [v, setV] = useState({ email: "", fullName: "", password: "", role: "admin" as "admin" | "agent" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const done = (text: string) => async () => {
    setMsg({ ok: true, text });
    await qc.invalidateQueries({ queryKey: ["admin", "staff"] });
  };
  const fail = (e: unknown) => setMsg({ ok: false, text: errMsg(e) });

  const create = useMutation({
    mutationFn: async () => {
      const p = staffInputSchema.safeParse(v);
      if (!p.success) throw new Error(p.error.issues[0]?.message);
      return createStaff({ data: p.data });
    },
    onSuccess: async () => {
      await done(`Compte créé pour ${v.email}. Transmettez-lui son mot de passe en main propre.`)();
      setV({ email: "", fullName: "", password: "", role: "admin" });
    },
    onError: fail,
  });
  const action = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: done("Modification enregistrée."), onError: fail });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="adm-grid2" style={{ marginTop: 0, alignItems: "start" }}>
      <form className="adm-card" onSubmit={submit} data-reveal>
        <div className="eyebrow green">NOUVEAU COMPTE</div>
        <h3>AJOUTER UN MEMBRE</h3>
        <div className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
          <label className="adm-field"><span>Nom complet</span><input className="adm-input" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} /></label>
          <label className="adm-field"><span>E-mail</span><input className="adm-input" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
          <label className="adm-field">
            <span>Mot de passe provisoire</span>
            <input className="adm-input" type="text" required value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="new-password" />
            <small className="muted">10 caractères min., majuscule, minuscule et chiffre.</small>
          </label>
          <label className="adm-field">
            <span>Rôle</span>
            <SiteSelect
              className="adm-select"
              value={v.role}
              onValueChange={(value) => setV({ ...v, role: value as "admin" | "agent" })}
              placeholder="Choisir un rôle"
              options={[
                { value: "admin", label: "Administrateur — gère tout" },
                { value: "agent", label: "Agent de contrôle — scan et validation uniquement" },
              ]}
            />
          </label>
        </div>
        {msg && <p className={msg.ok ? "adm-ok" : "adm-error"} style={{ marginTop: 14 }}>{msg.text}</p>}
        <button className="button" style={{ marginTop: 20 }} disabled={create.isPending}>
          {create.isPending ? "Création…" : "Créer le compte"} <ArrowUpRight size={18} aria-hidden />
        </button>
      </form>
      <div className="adm-card" data-reveal style={delay(100)}>
        <div className="eyebrow green">ÉQUIPE</div>
        <h3>{staff.data?.length ?? 0} COMPTE(S)</h3>
        {staff.error && <p className="adm-error">{errMsg(staff.error)}</p>}
        {staff.data?.map((m) => (
          <div className="adm-item" key={m.userId}>
            <div className="adm-item-head">
              <div>
                <b style={{ fontSize: 18, color: "inherit" }}>{m.fullName || m.email}</b>
                <div className="muted" style={{ fontSize: 11 }}>{m.email} · depuis le {fmt(m.createdAt)}</div>
              </div>
              {m.userId === meId ? <span className="adm-badge">Vous</span> : <span className={`adm-badge${m.role === "agent" ? " muted" : ""}`}>{m.role === "admin" ? "Admin" : "Agent"}</span>}
            </div>
            {m.userId !== meId && (
              <div className="adm-actions" style={{ justifyContent: "flex-start" }}>
                <button className="adm-btn sm" onClick={() => action.mutate(() => updateStaffRole({ data: { userId: m.userId, role: m.role === "admin" ? "agent" : "admin" } }))}>
                  Passer {m.role === "admin" ? "agent" : "admin"}
                </button>
                <button
                  className="adm-btn sm"
                  onClick={() => {
                    const pwd = prompt("Nouveau mot de passe (10 car. min., majuscule, minuscule, chiffre) :");
                    if (!pwd) return;
                    const p = strongPassword.safeParse(pwd);
                    if (!p.success) return setMsg({ ok: false, text: p.error.issues[0]?.message ?? "Mot de passe trop faible" });
                    action.mutate(() => resetStaffPassword({ data: { userId: m.userId, password: pwd } }));
                  }}
                >
                  <KeyRound size={12} /> Mot de passe
                </button>
                <button className="adm-btn sm danger" onClick={() => confirm(`Supprimer le compte de ${m.email} ?`) && action.mutate(() => removeStaff({ data: { userId: m.userId } }))}>
                  <Trash2 size={12} /> Supprimer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
