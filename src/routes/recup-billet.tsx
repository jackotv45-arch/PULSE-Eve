import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import Header from "@/components/pulse/Header";
import { getTicketByEmail } from "@/lib/event.functions";

export const Route = createFileRoute("/recup-billet")({
  component: RecupBillet,
});

function RecupBillet() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "notfound" | "error">("idle");
  const [ticket, setTicket] = useState<{
    token: string;
    reference: string;
    eventTitle: string;
    eventStartsAt: string;
  } | null>(null);
  const getTicket = useServerFn(getTicketByEmail);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const r = await getTicket({ data: { email, eventSlug: "pulse-fit-day" } });
      if (r) {
        setTicket(r);
        setStatus("found");
      } else {
        setStatus("notfound");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <Header simple />
      <main className="page-state">
        <div className="eyebrow green">BILLET</div>
        <h1>RÉCUPÉRER MON BILLET</h1>
        <p>
          Saisissez l’adresse e-mail utilisée lors de votre inscription pour retrouver votre lien de billet.
        </p>
        <form onSubmit={onSubmit} className="register-form" noValidate>
          <div className="field full">
            <label htmlFor="f-email">Adresse e-mail</label>
            <input
              id="f-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="button submit" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Recherche…" : "Chercher mon billet"}
          </button>
          {status === "error" && (
            <p className="field-error">Une erreur est survenue. Réessayez plus tard.</p>
          )}
          {status === "notfound" && (
            <p className="field-error">
              Aucun billet confirmé trouvé pour cette adresse e-mail.
            </p>
          )}
        </form>
        {status === "found" && ticket && (
          <div className="qr-result accepted" role="status">
            <h2>Voici votre billet</h2>
            <p>
              Référence <strong>{ticket.reference}</strong> pour{" "}
              <em>{ticket.eventTitle}</em>.
            </p>
            <Link className="button" to="/billet/$token" params={{ token: ticket.token }}>
              Afficher mon billet et mon QR code
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
