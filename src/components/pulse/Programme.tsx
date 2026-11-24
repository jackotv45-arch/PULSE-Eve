import { ArrowUpRight } from "lucide-react";
import type { PublicEvent } from "@/lib/event.functions";
import { delay } from "./reveal";

export default function Programme({ items }: { items: PublicEvent["programme"] }) {
  return (
    <section className="section activities" id="programme">
      <div className="section-heading" data-reveal>
        <div>
          <div className="eyebrow green">02 / LE PROGRAMME</div>
          <h2>
            {items.length > 1 ? `${["","UN","DEUX","TROIS","QUATRE","CINQ","SIX"][items.length] ?? items.length} TEMPS FORTS.` : "UN TEMPS FORT."}
            <br />
            <em>ZÉRO EXCUSE.</em>
          </h2>
        </div>
        <p>
          À fond ou en douceur. Solo ou en équipe.
          <br />
          Chaque participant présent repart avec son attestation.
        </p>
      </div>
      <div className="activity-grid">
        {items.map((a, i) => (
          <a className="activity" href="#inscription" key={i} data-reveal style={delay(i * 120)}>
            <img src={a.img || "/images/training.jpg"} alt={a.title} loading="lazy" />
            <span className="activity-number">{String(i + 1).padStart(2, "0")}</span>
            <span className="activity-time">{a.time}</span>
            <div>
              <small>{a.tag}</small>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </div>
            <ArrowUpRight aria-hidden className="activity-arrow" size={24} />
          </a>
        ))}
      </div>
    </section>
  );
}
