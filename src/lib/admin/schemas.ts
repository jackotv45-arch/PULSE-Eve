import { z } from "zod";

export const programmeItemSchema = z.object({
  time: z.string().trim().max(20),
  tag: z.string().trim().max(60),
  title: z.string().trim().min(1, "Titre requis").max(80),
  text: z.string().trim().max(300),
  img: z.string().trim().max(500),
});
export const faqItemSchema = z.object({
  q: z.string().trim().min(1, "Question requise").max(200),
  a: z.string().trim().min(1, "Réponse requise").max(1000),
});

export const eventInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Lettres minuscules, chiffres et tirets uniquement"),
  title: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(200),
  description: z.string().trim().max(2000),
  startsAt: z.string().min(1, "Date de début requise"),
  endsAt: z.string(),
  venue: z.string().trim().min(1, "Lieu requis").max(120),
  address: z.string().trim().max(200),
  capacity: z.number().int().positive().nullable(),
  registrationsOpen: z.boolean(),
  organizer: z.string().trim().max(120),
  heroImage: z.string().trim().max(500),
  isFeatured: z.boolean(),
  programme: z.array(programmeItemSchema).max(12),
  faq: z.array(faqItemSchema).max(30),
});
export type EventInput = z.infer<typeof eventInputSchema>;
export type ProgrammeItem = z.infer<typeof programmeItemSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;

/** Mot de passe robuste : 10 caractères, une majuscule, une minuscule, un chiffre. */
export const strongPassword = z
  .string()
  .min(10, "10 caractères minimum")
  .max(72)
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const staffInputSchema = z.object({
  email: z.string().trim().email("E-mail invalide").max(200),
  fullName: z.string().trim().max(120),
  password: strongPassword,
  role: z.enum(["admin", "agent"]),
});

export const registrationEditSchema = z.object({
  id: z.string().uuid(),
  lastName: z.string().trim().min(1).max(80),
  firstName: z.string().trim().min(1).max(80),
  age: z.number().int().min(5).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(6).max(30),
  profession: z.string().trim().min(1).max(80),
  organization: z.string().trim().max(120),
});

export function participationRate(present: number, total: number) {
  return total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
}
