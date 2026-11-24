import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/pulse/Header";
import { browserSupabase } from "@/lib/supabase-browser";
import { bootstrapFirstAdmin, getBootstrapStatus } from "@/lib/admin/admin.functions";
import { errMsg } from "./useAdmin";

export default function Login({ deniedMessage }: { deniedMessage?: string }) {
  const status = useQuery({ queryKey: ["admin", "bootstrap"], queryFn: () => getBootstrapStatus() });
  const setup = status.data?.needsSetup ?? false;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(deniedMessage ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (setup) await bootstrapFirstAdmin({ data: { email, password, fullName } });
      const { error: err } = await browserSupabase().auth.signInWithPassword({ email, password });
      if (err) throw new Error("E-mail ou mot de passe incorrect");
    } catch (er) {
      setError(errMsg(er));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <div className="adm-login-visual">
        <img src="/images/training.jpg" alt="" />
        <div className="adm-login-copy">
          <div className="eyebrow">
            <span className="dot" /> BACK-OFFICE PULSE
          </div>
          <h1>
            LES COULISSES.
            <br />
            <em>LE CONTRÔLE.</em>
          </h1>
        </div>
      </div>
      <form className="adm-login-form" onSubmit={submit}>
        <Logo />
        <div className="eyebrow green">{setup ? "PREMIÈRE CONFIGURATION" : "ESPACE ADMINISTRATEUR"}</div>
        <h2>{setup ? "CRÉEZ LE COMPTE ADMIN." : "CONNEXION."}</h2>
        {setup && (
          <label className="adm-field">
            <span>Nom complet</span>
            <input className="adm-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
        )}
        <label className="adm-field">
          <span>E-mail</span>
          <input className="adm-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="adm-field">
          <span>Mot de passe</span>
          <input
            className="adm-input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={setup ? "new-password" : "current-password"}
          />
          {setup && <small className="muted">10 caractères min., une majuscule, une minuscule, un chiffre.</small>}
        </label>
        {error && <p className="adm-error">{error}</p>}
        <button className="button" disabled={busy}>
          {busy ? "Patientez…" : setup ? "Créer et entrer" : "Se connecter"} <ArrowUpRight aria-hidden size={18} />
        </button>
      </form>
    </div>
  );
}
