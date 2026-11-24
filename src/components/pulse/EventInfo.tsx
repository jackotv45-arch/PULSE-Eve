import { ArrowUpRight, MoveUpRight } from "lucide-react";
import type { PublicEvent } from "@/lib/event.functions";
import { formatTime } from "@/lib/format";
import { delay } from "./reveal";

export default function EventInfo({ event }: { event: PublicEvent }) {
  const participantRange =
    event.participantsTargetMin != null && event.capacity != null
      ? `${new Intl.NumberFormat("fr-FR").format(event.participantsTargetMin)}–${new Intl.NumberFormat("fr-FR").format(event.capacity)}`
      : event.capacity != null
        ? new Intl.NumberFormat("fr-FR").format(event.capacity)
        : "∞";
  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Libreville" })
    .format(new Date(event.startsAt))
    .replace(".", "")
    .toUpperCase();
  return (
    <section className="section club" id="evenement">
      <div className="club-copy" data-reveal>
        <div className="eyebrow green">01 / L’ÉVÉNEMENT</div>
        <h2>
          UNE MATINÉE.
          <br />
          TOUTE UNE <em>ÉNERGIE.</em>
        </h2>
        <p>{event.description}</p>
        <p>
          Pas besoin d’être pro, ni d’être membre : venez comme vous êtes, avec votre tenue de sport et votre
          QR code. Le reste, nos coachs s’en chargent.
        </p>
        <a className="text-link" href="#inscription">
          Je réserve ma place gratuitement <ArrowUpRight aria-hidden size={20} />
        </a>
        <div className="club-stats">
          <div>
            <strong>{day}</strong>
            <span>Le grand jour</span>
          </div>
          <div>
            <strong>
              {formatTime(event.startsAt).replace("h00", "h")}–{event.endsAt ? formatTime(event.endsAt).replace("h00", "h") : ""}
            </strong>
            <span>Au programme</span>
          </div>
          <div>
            <strong>{participantRange}</strong>
            <span>{event.participantsTargetMin != null ? "Participants attendus" : "Places disponibles"}</span>
          </div>
        </div>
      </div>
      <div className="club-photo" data-reveal style={delay(150)}>
        <img src={"/images/club.jpg"} alt="Équipements du site UENERGY" loading="lazy" />
        <div className="photo-label">
          <span>{event.venue.toUpperCase()} · {event.address?.toUpperCase()}</span>
          <MoveUpRight aria-hidden size={24} />
        </div>
      </div>
    </section>
  );
}
