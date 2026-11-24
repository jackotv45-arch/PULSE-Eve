import { Download } from "lucide-react";
import type { AdminEvent, AuditEntry } from "@/lib/admin/admin.functions";
import { delay } from "@/components/pulse/reveal";
import { ACTION_LABELS, REJECT_LABELS, downloadCsv, fmt } from "./useAdmin";

export default function Journal({ event, audit }: { event: AdminEvent; audit: AuditEntry[] }) {
  const reason = (a: AuditEntry) => (a.action === "scan.rejected" ? (REJECT_LABELS[String(a.details["reason"])] ?? "") : "");
  return (
    <>
      <div className="adm-toolbar">
        <p className="muted" style={{ fontSize: 11, marginRight: "auto" }}>Historique horodaté : inscriptions, modifications, annulations, scans acceptés et refusés.</p>
        <button
          className="adm-btn"
          onClick={() =>
            downloadCsv(`journal-${event.slug}.csv`, [
              ["Date", "Action", "Participant", "Agent", "Détail"],
              ...audit.map((a) => [fmt(a.createdAt), ACTION_LABELS[a.action] ?? a.action, a.participant, a.actor, reason(a)]),
            ])
          }
        >
          <Download size={14} /> Exporter
        </button>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Date & heure</th><th>Action</th><th>Participant</th><th>Agent</th></tr></thead>
          <tbody>
            {audit.map((a, i) => (
              <tr key={a.id} className="row-in" style={delay(Math.min(i, 15) * 30)}>
                <td className="muted">{fmt(a.createdAt)}</td>
                <td className={a.action === "scan.rejected" ? "adm-error" : a.action === "scan.accepted" ? "adm-ok" : ""}>
                  {ACTION_LABELS[a.action] ?? a.action} {reason(a) && `· ${reason(a)}`}
                </td>
                <td>{a.participant || "—"}</td>
                <td className="muted">{a.actor}</td>
              </tr>
            ))}
            {audit.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 40 }}>Journal vide.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
