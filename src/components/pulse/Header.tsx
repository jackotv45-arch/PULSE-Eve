import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";

const LINKS = [
  ["#evenement", "L’événement"],
  ["#programme", "Programme"],
  ["#inscription", "Inscription"],
  ["#faq", "FAQ"],
] as const;

export function Logo() {
  return (
    <Link className="logo" to="/">
      UENERGY<span>®</span>
    </Link>
  );
}

/** Section actuellement à l'écran, pour surligner le lien du menu correspondant. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !("IntersectionObserver" in window)) return;
    const sections = LINKS.map(([href]) => document.querySelector<HTMLElement>(href)).filter(
      (s): s is HTMLElement => s != null,
    );
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
          else setActive((cur) => (cur === `#${e.target.id}` ? null : cur));
        }),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [enabled]);
  return active;
}

export default function Header({ simple = false }: { simple?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(!simple);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={scrolled ? "scrolled" : undefined}>
      <Logo />
      {!simple && (
        <nav className={open ? "open" : ""}>
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={active === href ? "active" : undefined}
              aria-current={active === href ? "true" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
      {simple ? (
        <Link className="button nav-cta" to="/">
          Voir l’événement <ArrowUpRight aria-hidden size={17} />
        </Link>
      ) : (
        <a className="button nav-cta" href="#inscription">
          Je réserve ma place <ArrowUpRight aria-hidden size={17} />
        </a>
      )}
      {!simple && (
        <button
          className="mobile-menu"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden size={24} /> : <Menu aria-hidden size={24} />}
        </button>
      )}
    </header>
  );
}
