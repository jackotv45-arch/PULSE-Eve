import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CircleX, Ticket } from "lucide-react";
import { registerParticipant, type PublicEvent } from "@/lib/event.functions";
import { REGISTER_ERRORS, registrationSchema } from "@/lib/registration";
import { delay } from "./reveal";

const LAST_TICKET_KEY = "pulse-last-ticket";

type Values = {
  lastName: string;
  firstName: string;
  age: string;
  email: string;
  phone: string;
  profession: string;
  organization: string;
  consent: boolean;
  website: string;
};

const EMPTY: Values = {
  lastName: "",
  firstName: "",
  age: "",
  email: "",
  phone: "",
  profession: "",
  organization: "",
  consent: false,
  website: "",
};

const FIELDS: { name: keyof Values; label: string; type: string; autoComplete: string; placeholder: string; optional?: boolean; full?: boolean; inputMode?: "numeric" | "tel" | "email" }[] = [
  { name: "lastName", label: "Nom", type: "text", autoComplete: "family-name", placeholder: "Mba" },
  { name: "firstName", label: "Prénom", type: "text", autoComplete: "given-name", placeholder: "Clarisse" },
  { name: "age", label: "Âge", type: "text", autoComplete: "off", placeholder: "28", inputMode: "numeric" },
  { name: "phone", label: "Téléphone", type: "tel", autoComplete: "tel", placeholder: "+241 77 12 34 56", inputMode: "tel" },
  { name: "email", label: "Adresse e-mail", type: "email", autoComplete: "email", placeholder: "vous@exemple.com", full: true, inputMode: "email" },
  { name: "profession", label: "Profession", type: "text", autoComplete: "organization-title", placeholder: "Infirmière" },
  { name: "organization", label: "Organisation / entreprise", type: "text", autoComplete: "organization", placeholder: "CHU de Libreville", optional: true },
];

export default function RegisterSection({ event }: { event: PublicEvent }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const register = useServerFn(registerParticipant);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    shownAt.current = Date.now();
    setLastTicket(localStorage.getItem(LAST_TICKET_KEY));
  }, []);

  const spotsLeft = event.capacity != null ? event.capacity - event.registeredCount : null;
  const closed = !event.registrationsOpen || new Date(event.startsAt).getTime() < Date.now();
  const full = spotsLeft != null && spotsLeft <= 0;

  const set = (name: keyof Values, value: string | boolean) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = registrationSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof Values, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Values;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      const first = FIELDS.find((f) => next[f.name])?.name ?? (next.consent ? "consent" : null);
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await register({
        data: {
          ...parsed.data,
          eventSlug: event.slug,
          website: values.website,
          elapsedMs: Date.now() - shownAt.current,
        },
      });
      if (res.status === "ok") {
        localStorage.setItem(LAST_TICKET_KEY, res.token);
        await queryClient.invalidateQueries({ queryKey: ["event"] });
        await navigate({ to: "/billet/$token", params: { token: res.token }, search: { nouveau: true } });
        return;
      }
      if (res.status === "duplicate") {
        const field = res.field === "phone" ? "phone" : "email";
        setErrors({ [field]: field === "phone" ? "Ce numéro est déjà inscrit." : "Cette adresse e-mail est déjà inscrite." });
      }
      setFormError(REGISTER_ERRORS[res.status]);
    } catch {
      setFormError(REGISTER_ERRORS.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section register" id="inscription">
      <div className="section-heading" data-reveal>
        <div>
          <div className="eyebrow green">03 / INSCRIPTION</div>
          <h2>
            VOTRE PLACE.
            <br />
            <em>EN 1 MINUTE.</em>
          </h2>
        </div>
        <p>
          {spotsLeft != null && spotsLeft > 0 ? `Plus que ${spotsLeft} places disponibles.` : "Inscription gratuite."}
          <br />
          Votre QR code d’entrée s’affiche immédiatement.
        </p>
      </div>
      <div className="register-grid">
        <aside className="register-steps" data-reveal>
          <div className="eyebrow">COMMENT ÇA MARCHE</div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>JE M’INSCRIS</strong>
                <p>Quelques informations, c’est gratuit et sans engagement.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>JE REÇOIS MON QR CODE</strong>
                <p>Un code personnel et unique, à garder sur votre téléphone ou à imprimer.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>JE LE PRÉSENTE À L’ENTRÉE</strong>
                <p>Un scan rapide, votre présence est enregistrée : pas de file d’attente.</p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <strong>JE REÇOIS MON ATTESTATION</strong>
                <p>Après l’événement, par e-mail, réservée aux participants présents.</p>
              </div>
            </li>
          </ol>
        </aside>

        <form className="register-form" onSubmit={onSubmit} noValidate data-reveal style={delay(150)}>
          <div className="eyebrow green">
            <span className="dot" /> {event.title} · GRATUIT
          </div>
          <h3>JE RÉSERVE MA PLACE.</h3>
          <p>Tous les champs sont obligatoires, sauf l’organisation.</p>

          {lastTicket && (
            <div className="qr-result accepted" role="status">
              <Ticket aria-hidden size={20} />
              <div>
                <strong>DÉJÀ INSCRIT SUR CET APPAREIL ?</strong>
                <p>
                  <Link to="/billet/$token" params={{ token: lastTicket }}>
                    Afficher mon billet et mon QR code
                  </Link>
                </p>
              </div>
            </div>
          )}

          {closed || full ? (
            <div className="qr-result denied" role="status">
              <CircleX aria-hidden size={20} />
              <div>
                <strong>{full ? "COMPLET" : "INSCRIPTIONS FERMÉES"}</strong>
                <p>{full ? REGISTER_ERRORS.full : REGISTER_ERRORS.closed}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="form-grid">
                {FIELDS.map((f) => (
                  <div className={`field${f.full ? " full" : ""}`} key={f.name}>
                    <label htmlFor={`f-${f.name}`}>
                      {f.label} {f.optional && <small>(facultatif)</small>}
                    </label>
                    <input
                      id={`f-${f.name}`}
                      name={f.name}
                      type={f.type}
                      inputMode={f.inputMode}
                      autoComplete={f.autoComplete}
                      placeholder={f.placeholder}
                      value={values[f.name] as string}
                      onChange={(e) => set(f.name, e.target.value)}
                      aria-invalid={errors[f.name] ? true : undefined}
                      aria-describedby={errors[f.name] ? `e-${f.name}` : undefined}
                      required={!f.optional}
                    />
                    {errors[f.name] && (
                      <span className="field-error" id={`e-${f.name}`}>
                        {errors[f.name]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="f-website">Ne pas remplir</label>
                <input
                  id="f-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={values.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>
              <label className="consent">
                <input
                  id="f-consent"
                  type="checkbox"
                  checked={values.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                />
                <span>
                  J’accepte que mes informations soient utilisées par PULSE pour gérer mon inscription, contrôler
                  mon entrée et m’envoyer mon attestation de participation.
                </span>
              </label>
              {errors.consent && <span className="field-error">{errors.consent}</span>}

              <button className="button submit" type="submit" disabled={submitting}>
                {submitting ? "Inscription en cours…" : "Valider mon inscription"} <ArrowUpRight aria-hidden size={20} />
              </button>

              {formError && (
                <div className="qr-result denied" role="alert">
                  <CircleX aria-hidden size={20} />
                  <div>
                    <strong>INSCRIPTION NON ENREGISTRÉE</strong>
                    <p>{formError}</p>
                  </div>
                </div>
              )}
              <small className="form-note">
                Une seule inscription par personne : l’e-mail et le téléphone servent à éviter les doublons. Vos
                données ne sont jamais revendues.
              </small>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
