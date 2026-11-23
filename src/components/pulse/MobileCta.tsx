import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

/**
 * Bouton d'inscription collé en bas de l'écran sur mobile :
 * apparaît après le haut de page, disparaît quand le formulaire est à l'écran.
 */
export default function MobileCta({ spotsLeft }: { spotsLeft: number | null }) {
  const [pastHero, setPastHero] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const target = document.querySelector("#inscription");
    let io: IntersectionObserver | undefined;
    if (target && "IntersectionObserver" in window) {
      io = new IntersectionObserver(([e]) => setFormVisible(Boolean(e?.isIntersecting)), { threshold: 0.05 });
      io.observe(target);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  const show = pastHero && !formVisible;
  return (
    <div className={`mobile-cta${show ? " show" : ""}`} aria-hidden={!show}>
      <div>
        <strong>INSCRIPTION GRATUITE</strong>
        <span>{spotsLeft != null && spotsLeft > 0 ? `${spotsLeft} places disponibles` : "Places limitées"}</span>
      </div>
      <a className="button" href="#inscription" tabIndex={show ? 0 : -1}>
        Je réserve <ArrowUpRight aria-hidden size={17} />
      </a>
    </div>
  );
}
