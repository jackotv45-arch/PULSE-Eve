import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { CalendarDays, CircleCheck, Download, MapPin, Smartphone, Zap } from "lucide-react";
import Header from "@/components/pulse/Header";
import { ticketQueryOptions } from "@/lib/event.queries";
import { qrPayload } from "@/lib/registration";
import { formatDateTime, formatTime } from "@/lib/format";

export const Route = createFileRoute("/billet/$token")({
  validateSearch: (s: Record<string, unknown>): { nouveau?: boolean } =>
    s["nouveau"] === true || s["nouveau"] === "true" ? { nouveau: true } : {},
  loader: ({ context, params }) => {
    if (!/^[a-f0-9]{64}$/.test(params.token)) return null;
    return context.queryClient.ensureQueryData(ticketQueryOptions(params.token));
  },
  head: () => ({
    meta: [
      { title: "Mon billet — PULSE FIT DAY" },
      { name: "description", content: "Votre QR code personnel d’entrée au PULSE FIT DAY." },
      { property: "og:title", content: "Mon billet — PULSE FIT DAY" },
      { property: "og:description", content: "Votre QR code personnel d’entrée au PULSE FIT DAY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { token } = Route.useParams();
  const valid = /^[a-f0-9]{64}$/.test(token);
  if (!valid) return <TicketNotFound />;
  return <TicketView token={token} />;
}

function TicketNotFound() {
  return (
    <>
      <Header simple />
      <main className="page-state">
        <div className="eyebrow green">BILLET</div>
        <h1>BILLET INTROUVABLE.</h1>
        <p>Ce lien ne correspond à aucune inscription. Vérifiez le lien ou inscrivez-vous.</p>
        <Link className="button" to="/" hash="inscription">
          Je réserve ma place
        </Link>
      </main>
    </>
  );
}

function TicketView({ token }: { token: string }) {
  const { data: ticket } = useSuspenseQuery(ticketQueryOptions(token));
  const { nouveau } = Route.useSearch();
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    QRCode.toDataURL(qrPayload(ticket.qrToken), {
      width: 520,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#101110", light: "#ffffff" },
    })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(""));
    return () => {
      cancelled = true;
    };
  }, [ticket]);

  if (!ticket) return <TicketNotFound />;
  const cancelled = ticket.status === "cancelled";

  return (
    <>
      <Header simple />
      <main className="ticket-page">
        <div>
          <div className="eyebrow green">
            <span className="dot" /> {nouveau ? "INSCRIPTION CONFIRMÉE" : "VOTRE BILLET"}
          </div>
          <h1>
            {nouveau ? "C’EST NOTÉ," : "À BIENTÔT,"}
            <br />
            <em>{ticket.firstName.toUpperCase()}.</em>
          </h1>
          <p>
            Votre place au {ticket.eventTitle} est réservée. Présentez ce QR code à l’entrée : il sera scanné une
            seule fois pour enregistrer votre présence et vous donner droit à votre attestation.
          </p>
          <div className="ticket-actions">
            <a
              className="button"
              href={qr || undefined}
              download={`billet-${ticket.reference}.png`}
              aria-disabled={!qr}
            >
              Télécharger mon QR code <Download aria-hidden size={18} />
            </a>
            <Link className="button outline" to="/">
              Retour à l’événement
            </Link>
          </div>
          <ul className="ticket-tips">
            <li>
              <Smartphone aria-hidden size={16} /> Gardez ce QR code sur votre téléphone ou imprimez-le. Ajoutez
              cette page à vos favoris pour la retrouver.
            </li>
            <li>
              <CircleCheck aria-hidden size={16} /> Ce code est personnel : une fois scanné, il ne peut plus être
              réutilisé.
            </li>
          </ul>
        </div>

        <div className="member-card">
          <div className="member-top">
            <span className="logo">PULSE</span>
            <span>{ticket.eventTitle}</span>
          </div>
          <h3>
            {ticket.firstName} {ticket.lastName}
          </h3>
          <div className="ticket-details">
            <span>
              <CalendarDays aria-hidden size={12} style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
              {formatDateTime(ticket.eventStartsAt)}
              {ticket.eventEndsAt ? ` – ${formatTime(ticket.eventEndsAt)}` : ""}
            </span>
            <span>
              <MapPin aria-hidden size={12} style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
              {ticket.eventVenue}
              {ticket.eventAddress ? ` · ${ticket.eventAddress}` : ""}
            </span>
          </div>
          <div className="qr-image">
            {qr && !cancelled && <img src={qr} alt={`QR code d’entrée de ${ticket.firstName} ${ticket.lastName}`} />}
          </div>
          <code>{ticket.reference}</code>
          <small>Billet nominatif · Valable pour une seule entrée</small>
          <div>
            {cancelled ? (
              <span className="ticket-status cancelled">INSCRIPTION ANNULÉE</span>
            ) : ticket.checkedInAt ? (
              <span className="ticket-status">
                <CircleCheck aria-hidden size={12} /> PRÉSENCE ENREGISTRÉE LE {formatDateTime(ticket.checkedInAt).toUpperCase()}
              </span>
            ) : (
              <span className="ticket-status">
                <Zap aria-hidden size={12} /> INSCRIPTION CONFIRMÉE
              </span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
