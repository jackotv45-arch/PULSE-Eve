import { ArrowUpRight, Zap } from "lucide-react";
import { Logo } from "./Header";
import { delay } from "./reveal";

export function FinalCta({ full = false }: { full?: boolean }) {
  return (
    <section className="final-cta">
      <span className="eyebrow">LES PLACES PARTENT VITE.</span>
      <h2 data-reveal>
        MOINS DE « DEMAIN ».
        <br />
        PLUS DE <span>MAINTENANT.</span>
      </h2>
      {!full && (
        <a className="button dark-button" href="#inscription" data-reveal style={delay(150)}>
          Je réserve ma place <ArrowUpRight aria-hidden size={18} />
        </a>
      )}
      <Zap aria-hidden className="big-zap" />
    </section>
  );
}

export default function Footer({ venue, address }: { venue?: string; address?: string | null } = {}) {
  const location = venue && address ? `${venue} · ${address}` : venue || address || "Quartier Louis · Libreville · Gabon";
  return (
    <footer>
      <div className="footer-top">
        <Logo />
        <p>{location}</p>
        <a href="#">Retour en haut ↑</a>
      </div>
      <div className="footer-bottom">
        <span>© 2026 UENERGY Libreville.</span>
        <span>Vos données servent uniquement à la gestion de l’événement et ne sont jamais revendues.</span>
      </div>
    </footer>
  );
}
