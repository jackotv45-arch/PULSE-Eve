import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCog, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Plus, ScanLine, ScrollText, Users } from "lucide-react";
import { Logo } from "@/components/pulse/Header";
import { useReveal } from "@/components/pulse/reveal";
import Login from "@/components/admin/Login";
import Dashboard from "@/components/admin/Dashboard";
import EventEditor from "@/components/admin/EventEditor";
import Registrations from "@/components/admin/Registrations";
import Scanner from "@/components/admin/Scanner";
import Journal from "@/components/admin/Journal";
import Team from "@/components/admin/Team";
import { errMsg, useAdminSession } from "@/components/admin/useAdmin";
import { browserSupabase } from "@/lib/supabase-browser";
import { getEventData, getMe, listEvents } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — UENERGY Libreville" },
      { name: "description", content: "Back-office UENERGY : événements, inscrits, contrôle des entrées et équipe." },
      { property: "og:title", content: "Administration — UENERGY Libreville" },
      { property: "og:description", content: "Back-office UENERGY : événements, inscrits, contrôle des entrées et équipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: AdminPage,
});

type Tab = "dashboard" | "event" | "registrations" | "scan" | "journal" | "team" | "new";

const TABS: { id: Tab; label: string; icon: typeof Users; adminOnly?: boolean; eyebrow: string; title: [string, string] }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, eyebrow: "01 / EN TEMPS RÉEL", title: ["LE POULS", "DE L’ÉVÉNEMENT."] },
  { id: "event", label: "Événement & site", icon: CalendarCog, eyebrow: "02 / CONTENU DU SITE", title: ["CE QUE VOIT", "LE PUBLIC."] },
  { id: "registrations", label: "Inscrits", icon: ClipboardList, eyebrow: "03 / PARTICIPANTS", title: ["TOUS LES", "INSCRITS."] },
  { id: "scan", label: "Contrôle d’entrée", icon: ScanLine, eyebrow: "04 / JOUR J", title: ["SCAN.", "VALIDÉ."] },
  { id: "journal", label: "Journal", icon: ScrollText, eyebrow: "05 / TRAÇABILITÉ", title: ["CHAQUE ACTION", "TRACÉE."] },
  { id: "team", label: "Équipe & admins", icon: Users, adminOnly: true, eyebrow: "06 / ACCÈS", title: ["QUI GÈRE", "UENERGY."] },
];

function AdminPage() {
  const session = useAdminSession();
  if (session === undefined) return <div className="adm-loading"><Logo /></div>;
  if (!session) return <Login />;
  return <Authed key={session.user.id} />;
}

function Authed() {
  const me = useQuery({ queryKey: ["admin", "me"], queryFn: () => getMe(), retry: false });
  if (me.isPending) return <div className="adm-loading"><Logo /></div>;
  if (me.error) {
    void browserSupabase().auth.signOut();
    return <Login deniedMessage={errMsg(me.error)} />;
  }
  return <Shell me={me.data} />;
}

function Shell({ me }: { me: { userId: string; role: "admin" | "agent"; email: string } }) {
  const isAdmin = me.role === "admin";
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(isAdmin ? "dashboard" : "scan");
  const events = useQuery({ queryKey: ["admin", "events"], queryFn: () => listEvents() });
  const [eventId, setEventId] = useState<string | null>(null);
  const list = events.data ?? [];
  const current = list.find((e) => e.id === eventId) ?? list.find((e) => e.isFeatured) ?? list[0] ?? null;
  const data = useQuery({
    queryKey: ["admin", "data", current?.id],
    queryFn: () => getEventData({ data: { eventId: current!.id } }),
    enabled: !!current,
    refetchInterval: 10_000, // tableau de bord « temps réel »
  });
  useReveal();
  useEffect(() => window.scrollTo({ top: 0, behavior: "smooth" }), [tab]);

  const regs = data.data?.registrations ?? [];
  const active = regs.filter((r) => r.status === "confirmed");
  const present = active.filter((r) => r.checkedInAt).length;
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const meta = tab === "new" ? { eyebrow: "NOUVEL ÉVÉNEMENT", title: ["UN NOUVEAU", "RENDEZ-VOUS."] as [string, string] } : TABS.find((t) => t.id === tab)!;

  const nav = (cls: string) => (
    <div className={cls}>
      {tabs.map((t) => (
        <button key={t.id} className={tab === t.id ? "active" : undefined} onClick={() => setTab(t.id)}>
          <t.icon size={16} aria-hidden /> {t.label}
        </button>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (events.error) body = <p className="adm-error">{errMsg(events.error)}</p>;
  else if (tab === "team") body = <Team meId={me.userId} />;
  else if (tab === "new") body = <EventEditor event={null} isAdmin={isAdmin} onSaved={(id) => { setEventId(id); setTab("event"); }} />;
  else if (!current) body = <p className="muted">Aucun événement. {isAdmin && "Créez-en un avec « Nouvel événement »."}</p>;
  else if (tab === "event") body = <EventEditor key={current.id + current.title} event={current} isAdmin={isAdmin} onSaved={(id) => setEventId(id)} />;
  else if (data.isPending) body = <p className="muted">Chargement…</p>;
  else if (data.error) body = <p className="adm-error">{errMsg(data.error)}</p>;
  else if (tab === "dashboard") body = <Dashboard event={current} regs={regs} audit={data.data.audit} />;
  else if (tab === "registrations") body = <Registrations event={current} regs={regs} isAdmin={isAdmin} />;
  else if (tab === "scan") body = <Scanner event={current} present={present} total={active.length} />;
  else body = <Journal event={current} audit={data.data.audit} />;

  return (
    <div className="adm">
      <aside className="adm-side">
        <div>
          <Logo />
          <small className="adm-badge">{isAdmin ? "Administrateur" : "Agent de contrôle"}</small>
        </div>
        {nav("adm-nav")}
        <div className="adm-side-foot">
          <span>{me.email}</span>
          <Link to="/" target="_blank"><ExternalLink size={13} /> Voir le site</Link>
          <button onClick={async () => { await browserSupabase().auth.signOut(); qc.clear(); }}>
            <LogOut size={13} /> Se déconnecter
          </button>
        </div>
      </aside>
      {nav("adm-mobile-nav")}
      <main className="adm-main">
        <div className="adm-top">
          <div key={tab}>
            <div className="eyebrow green"><span className="dot" /> {meta.eyebrow}</div>
            <h1>{meta.title[0]}<br /><em>{meta.title[1]}</em></h1>
          </div>
          {tab !== "team" && tab !== "new" && list.length > 0 && (
            <div className="adm-toolbar" style={{ marginBottom: 0 }}>
              <select className="adm-select" value={current?.id ?? ""} onChange={(e) => setEventId(e.target.value)} aria-label="Événement">
                {list.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}{e.isFeatured ? " ★ en ligne" : ""}</option>
                ))}
              </select>
              {isAdmin && <button className="adm-btn" onClick={() => setTab("new")}><Plus size={14} /> Nouvel événement</button>}
            </div>
          )}
          {tab !== "new" && list.length === 0 && isAdmin && !events.isPending && (
            <button className="adm-btn" onClick={() => setTab("new")}><Plus size={14} /> Nouvel événement</button>
          )}
        </div>
        {body}
      </main>
    </div>
  );
}
