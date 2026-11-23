import { describe, expect, it } from "vitest";
import { normalizePhone, qrPayload, registrationSchema } from "./registration";

const valid = {
  lastName: "Mba",
  firstName: "Clarisse",
  age: "28",
  email: "clarisse@exemple.com",
  phone: "+241 77 12 34 56",
  profession: "Infirmière",
  organization: "",
  consent: true,
};

describe("formulaire d'inscription", () => {
  it("accepte une inscription complète, organisation facultative", () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["lastName", "firstName", "age", "email", "phone", "profession"] as const)(
    "refuse l'inscription si %s est vide",
    (field) => {
      expect(registrationSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
    },
  );

  it("exige un âge numérique", () => {
    expect(registrationSchema.safeParse({ ...valid, age: "vingt" }).success).toBe(false);
    expect(registrationSchema.parse(valid).age).toBe(28);
  });

  it("exige une adresse e-mail valide", () => {
    expect(registrationSchema.safeParse({ ...valid, email: "clarisse@" }).success).toBe(false);
  });

  it("exige un numéro de téléphone valide", () => {
    expect(registrationSchema.safeParse({ ...valid, phone: "12ab" }).success).toBe(false);
  });

  it("exige l'accord sur l'utilisation des données", () => {
    expect(registrationSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
});

describe("détection des doublons de téléphone", () => {
  it("considère identiques les formats local, +241 et 00241", () => {
    expect(normalizePhone("077 12 34 56")).toBe("24177123456");
    expect(normalizePhone("+241 77 12 34 56")).toBe("24177123456");
    expect(normalizePhone("00241 77-12-34-56")).toBe("24177123456");
  });
});

describe("QR code", () => {
  it("ne contient que le jeton, aucune donnée personnelle", () => {
    expect(qrPayload("abc")).toBe("PULSE-EVT:abc");
  });
});
