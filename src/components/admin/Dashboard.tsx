import type { AdminEvent, AdminRegistration, AuditEntry } from "@/lib/admin/admin.functions";
import { participationRate } from "@/lib/admin/schemas";
import { delay } from "@/components/pulse/reveal";
import { ACTION_LABELS, fmt } from "./useAdmin";

function breakdown(list: string[]) {
  const m = new Map<string, number>();
  list.forEach((k) => m.set(k || "Non renseigné", (m.get(k || "Non renseigné") ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
}

export default function Dashboard({ event, regs, audit }: { event: AdminEvent; regs: AdminRegistration[]; audit: AuditEntry[] }) {
  const active = regs.filter((r) => r.status === "confirmed");
  const present = active.filter((r) => r.checkedInAt).length;
  const rate = participationRate(present, active.length);
  const fill = event.capacity ? Math.min(100, (active.length / event.capacity) * 100) : 0;
  const prof = breakdown(active.map((r) => r.profession.trim()));
  const ageRanges = breakdown(active.map((r) => r.ageRange.trim()));
  const max = (l: [string, number][]) => Math.max(1, ...l.map((x) => x[1]));
  const stats = [
    ["Inscrits", active.length, false],
    ["Présents", present, true],
    ["Absents", active.length - present, false],
    ["Taux de participation", `${rate}%`, true],
  ] as const;

  return (
    <>
      <div className="adm-stats">
        {stats.map(([l, v, a], i) => (
          <div className={`adm-stat${a ? " accent" : ""}`} key={l} data-reveal style={delay(i * 90)}>
            <strong>{v}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <div className="adm-grid2">
        <div className="adm-card" data-reveal>
          <div className="eyebrow green">REMPLISSAGE</div>
          <h3>
            {active.length} / {event.capacity ?? "∞"} PLACES
          </h3>
          <div className="adm-gauge">
            <i style={{ width: `${fill}%` }} />
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            Inscriptions {event.registrationsOpen ? "ouvertes" : "fermées"} · {regs.length - active.length} annulée(s)
          </p>
          {event.participantsTargetMin != null && event.capacity != null && (
            <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Objectif : {new Intl.NumberFormat("fr-FR").format(event.participantsTargetMin)} à {new Intl.NumberFormat("fr-FR").format(event.capacity)} participants
            </p>
          )}
        </div>
        <div className="adm-card" data-reveal style={delay(100)}>
          <div className="eyebrow green">DERNIERS MOUVEMENTS</div>
          <h3>EN DIRECT</h3>
          <div className="adm-bars">
            {audit.slice(0, 6).map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, gap: 10 }}>
                <span>
                  <b className={a.action === "scan.rejected" ? "adm-error" : a.action === "scan.accepted" ? "adm-ok" : ""}>
                    {ACTION_LABELS[a.action] ?? a.action}
                  </b>{" "}
                  {a.participant}
                </span>
                <span className="muted">{fmt(a.createdAt)}</span>
              </div>
            ))}
            {audit.length === 0 && <p className="muted">Rien pour l’instant.</p>}
          </div>
        </div>
        {[
          ["PAR PROFESSION", prof],
          ["PAR TRANCHE D’ÂGE", ageRanges],
        ].map(([title, list], k) => (
          <div className="adm-card" key={title as string} data-reveal style={delay(k * 100)}>
            <div className="eyebrow green">RÉPARTITION</div>
            <h3>{title as string}</h3>
            <div className="adm-bars">
              {(list as [string, number][]).map(([name, n], i) => (
                <div className="adm-bar" key={name}>
                  <span>{name}</span>
                  <div>
                    <i style={{ width: `${(n / max(list as [string, number][])) * 100}%`, animationDelay: `${i * 80}ms` }} />
                  </div>
                  <b>{n}</b>
                </div>
              ))}
              {(list as [string, number][]).length === 0 && <p className="muted">Aucun inscrit.</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
