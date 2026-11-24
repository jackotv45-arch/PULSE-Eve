import { describe, expect, it } from "vitest";
import { participationRate, strongPassword } from "./schemas";

describe("règles du back-office", () => {
  it("taux de participation = présents / inscrits, arrondi à 0,1", () => {
    expect(participationRate(2, 3)).toBe(66.7);
    expect(participationRate(0, 0)).toBe(0);
  });
  it("refuse un mot de passe admin faible", () => {
    expect(strongPassword.safeParse("motdepasse").success).toBe(false);
    expect(strongPassword.safeParse("Pulse2026Admin").success).toBe(true);
  });
});
