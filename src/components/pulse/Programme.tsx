import { ArrowUpRight } from "lucide-react";
import { delay } from "./reveal";

const PROGRAMME = [
  { n: "01", time: "08h00", tag: "ACCUEIL & ÉCHAUFFEMENT", title: "WARM-UP GÉANT", text: "Scan du QR, café, et tout le monde en mouvement.", img: "/images/club.jpg" },
  { n: "02", time: "09h30", tag: "ÉNERGIE & ENDURANCE", title: "FUNCTIONAL CHALLENGE", text: "Des ateliers en équipe, à votre niveau.", img: "/images/training.jpg" },
  { n: "03", time: "11h30", tag: "MOUVEMENT & CONSEILS", title: "COURS & BILANS COACH", text: "Cours collectif final et bilans personnalisés.", img: "/images/hero.jpg" },
];

export default function Programme() {
  return (
    <section className="section activities" id="programme">
      <div className="section-heading" data-reveal>
        <div>
          <div className="eyebrow green">02 / LE PROGRAMME</div>
          <h2>
            TROIS TEMPS FORTS.
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
        {PROGRAMME.map((a, i) => (
          <a className="activity" href="#inscription" key={a.n} data-reveal style={delay(i * 120)}>
            <img src={a.img} alt={a.title} loading="lazy" />
            <span className="activity-number">{a.n}</span>
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
