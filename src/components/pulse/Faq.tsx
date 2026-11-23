import { delay } from "./reveal";

const FAQ = [
  {
    q: "L’inscription est-elle payante ?",
    a: "Non, la participation est entièrement gratuite. Les places sont limitées : seule l’inscription en ligne garantit votre entrée.",
  },
  {
    q: "Faut-il être membre de PULSE ?",
    a: "Pas du tout. L’événement est ouvert à tous, membres ou non, débutants comme sportifs confirmés.",
  },
  {
    q: "Comment fonctionne mon QR code ?",
    a: "Après votre inscription, un QR code personnel et unique s’affiche. Téléchargez-le ou gardez la page de votre billet : il sera scanné une seule fois à l’entrée pour enregistrer votre présence.",
  },
  {
    q: "Vais-je recevoir une attestation ?",
    a: "Oui. Après l’événement, chaque participant dont la présence a été validée à l’entrée reçoit une attestation de participation en PDF par e-mail.",
  },
  {
    q: "Que dois-je apporter ?",
    a: "Une tenue de sport, des baskets, une bouteille d’eau, une serviette… et votre QR code sur votre téléphone ou imprimé.",
  },
  {
    q: "Puis-je inscrire quelqu’un d’autre ?",
    a: "Chaque participant s’inscrit avec sa propre adresse e-mail et son propre numéro : un QR code correspond à une seule personne.",
  },
];

export default function Faq() {
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
        {FAQ.map((f, i) => (
          <details key={f.q} data-reveal style={delay(i * 70)}>
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
