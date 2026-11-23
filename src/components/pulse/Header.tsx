import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu } from "lucide-react";

const LINKS = [
  ["#evenement", "L’événement"],
  ["#programme", "Programme"],
  ["#inscription", "Inscription"],
  ["#faq", "FAQ"],
] as const;

export function Logo() {
  return (
    <Link className="logo" to="/">
      PULSE<span>®</span>
    </Link>
  );
}

export default function Header({ simple = false }: { simple?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header>
      <Logo />
      {!simple && (
        <nav className={open ? "open" : ""}>
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
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
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Menu aria-hidden size={24} />
        </button>
      )}
    </header>
  );
}
