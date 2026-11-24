import { z } from "zod";

/** Événement actuellement mis en avant sur la page publique. */
export const CURRENT_EVENT_SLUG = "pulse-fit-day";

/** Choix proposés dans le formulaire de pré-inscription UEnergy. */
export const GENDER_OPTIONS = ["Homme", "Femme"] as const;
export const AGE_RANGE_OPTIONS = ["8 - 18", "19 - 29", "30 - 40", "40 - 50", "+ de 50"] as const;

/** Délai minimal (ms) entre l'affichage du formulaire et l'envoi : en dessous, c'est un robot. */
export const MIN_FILL_MS = 2500;

/**
 * Normalise un numéro pour détecter les doublons : chiffres uniquement, indicatif Gabon (241)
 * ajouté aux numéros locaux, préfixe international 00 retiré.
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("241")) return digits;
  if (digits.length === 8 || digits.length === 9) return `241${digits.replace(/^0/, "")}`;
  return digits;
}

const text = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire`)
    .max(max, `${label} : ${max} caractères maximum`);

export const registrationSchema = z.object({
  participantName: text("Le nom, prénom ou pseudo"),
  gender: z.enum(GENDER_OPTIONS, { message: "Veuillez sélectionner une option" }),
  ageRange: z.enum(AGE_RANGE_OPTIONS, { message: "Veuillez sélectionner une tranche d’âge" }),
  email: z.string().trim().max(160).email("Adresse e-mail invalide"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{8,20}$/, "Numéro de téléphone invalide")
    .refine((v) => {
      const n = v.replace(/\D/g, "").length;
      return n >= 8 && n <= 15;
    }, "Numéro de téléphone invalide"),
  profession: text("La profession ou fonction", 80),
  receiveUpdates: z.boolean({ message: "Veuillez choisir oui ou non" }),
  consent: z.literal(true, { message: "Votre accord est nécessaire pour vous inscrire" }),
});

export type RegistrationInput = z.input<typeof registrationSchema>;

export const registrationRequestSchema = registrationSchema.extend({
  website: z.string().optional().default(""), // piège à robots, doit rester vide
  elapsedMs: z.number().int().nonnegative(),
});

export type RegisterResult =
  | { status: "ok"; token: string; reference: string }
  | { status: "duplicate"; field: "email" | "phone" }
  | { status: "full" | "closed" | "not_found" | "rate_limited" | "error" };

export const REGISTER_ERRORS: Record<Exclude<RegisterResult["status"], "ok">, string> = {
  duplicate: "Vous êtes déjà inscrit à cet événement.",
  full: "Désolé, l’événement est complet.",
  closed: "Les inscriptions sont fermées pour cet événement.",
  not_found: "Cet événement n’existe plus.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  error: "L’inscription n’a pas abouti. Réessayez dans un instant.",
};

/** Contenu encodé dans le QR : un jeton secret, jamais de données personnelles. */
export const qrPayload = (token: string) => `PULSE-EVT:${token}`;
