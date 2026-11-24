import { delay } from "./reveal";


export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="section faq" id="faq">
      <div data-reveal>
        <div className="eyebrow green">04 / ON VOUS RÉPOND</div>
        <h2>
          ON LÈVE
          <br />
          <em>LES DOUTES.</em>
        </h2>
        <p>
          Le plus dur, c’est de s’inscrire.
          <br />
          Le reste, on vous l’explique.
        </p>
      </div>
      <div className="questions">
        {items.map((f, i) => (
          <details key={i} data-reveal style={delay(i * 70)}>
            <summary>
              {f.q}
              <span>+</span>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
