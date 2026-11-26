import { Fragment, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, CalendarDays, Clock, MapPin, Zap } from "lucide-react";
import type { PublicEvent } from "@/lib/event.functions";
import { formatDay, formatShortDay, formatTime } from "@/lib/format";

function useCountdown(target: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function Hero({ event }: { event: PublicEvent }) {
  const left = useCountdown(event.startsAt);
  const spotsLeft = event.capacity != null ? Math.max(0, event.capacity - event.registeredCount) : null;
  const filled = event.capacity ? Math.min(1, event.registeredCount / event.capacity) : 0;
  const parts =
    left == null
      ? null
      : [
          [Math.floor(left / 86400000), "JOURS"],
          [Math.floor(left / 3600000) % 24, "HEURES"],
          [Math.floor(left / 60000) % 60, "MIN"],
          [Math.floor(left / 1000) % 60, "SEC"],
        ];
  const ticker = [
    "INSCRIPTION GRATUITE",
    formatShortDay(event.startsAt).replaceAll("/", "."),
    "PLACES LIMITÉES",
    "ATTESTATION DE PARTICIPATION",
  ];

  return (
    <>
      <section className="hero">
        <img className="hero-image" src={event.heroImage || "/images/hero.jpg"} alt="Espace de l’événement UENERGY" />
        <div className="hero-content">
          <div className="eyebrow">
            <span className="dot" /> ÉVÉNEMENT · {event.organizer?.toUpperCase() ?? "UENERGY"}
          </div>
          <h1>
            {event.title.split(" ").slice(0, -1).join(" ")}
            <br />
            <em>{event.title.split(" ").slice(-1)[0]}.</em>
          </h1>
          <p>
            {event.tagline}
            <br />
            Gratuit, tous niveaux. Réservez votre place, on s’occupe du reste.
          </p>
          <div className="hero-meta">
            <span>
              <CalendarDays aria-hidden size={15} /> {formatDay(event.startsAt)}
            </span>
            <span>
              <Clock aria-hidden size={15} /> {formatTime(event.startsAt)}
              {event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
            </span>
            <span>
              <MapPin aria-hidden size={15} /> {event.venue}
              {event.address ? ` · ${event.address.split(",")[0]}` : ""}
            </span>
          </div>
          <div className="hero-actions">
            <a className="button" href="#inscription">
              Je réserve ma place <ArrowUpRight aria-hidden size={21} />
            </a>
            <a className="text-link" href="#programme">
              Voir le programme <ArrowRight aria-hidden size={18} />
            </a>
            <Link className="text-link" to="/recup-billet">
              Récupérer mon billet <ArrowRight aria-hidden size={18} />
            </Link>
          </div>
          {left !== 0 && (
            <div className="countdown" aria-label="Temps restant avant l’événement">
              {(parts ?? [[null, "JOURS"], [null, "HEURES"], [null, "MIN"], [null, "SEC"]]).map(([v, l]) => (
                <div key={l}>
                  <strong>{v == null ? "--" : pad(v as number)}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          )}
          {spotsLeft != null && (
            <div className="spots">
              <div className="spots-label">
                <span>{event.registeredCount >= 20 ? `${event.registeredCount} INSCRITS` : `${event.capacity} PLACES · ENTRÉE GRATUITE`}</span>
                <strong>
                  {spotsLeft <= 0 ? "COMPLET" : event.registeredCount >= 20 ? `PLUS QUE ${spotsLeft} PLACES` : "PLACES LIMITÉES"}
                </strong>
              </div>
              <div className="spots-bar">
                <span style={{ width: `${Math.max(filled * 100, 3)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="hero-side">MOVE YOUR BODY. CHANGE YOUR MIND.</div>
        <a className="scroll-note" href="#evenement">
          SCROLL POUR DÉCOUVRIR <span>↓</span>
        </a>
        <div className="hero-stamp">
          <Zap aria-hidden size={24} fill="currentColor" />
          <span>
            FIND
            <br />
            YOUR UENERGY.
          </span>
        </div>
      </section>
      <div className="ticker">
        <div className="ticker-track">
          {[0, 1, 2, 3].map((g) => (
            <div className="ticker-group" key={g} aria-hidden={g > 0 ? true : undefined}>
              {ticker.map((t) => (
                <Fragment key={t}>
                  <span>{t}</span>
                  <Zap aria-hidden size={24} />
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
