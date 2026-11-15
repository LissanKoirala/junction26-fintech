import { describe, expect, it } from "vitest";
import { DEMO_DESCRIPTION, intentForm, validAmountCents, walletConfig } from "./stripe-keys";

const SK = "sk_test_" + "a1B2c3D4e5F6g7H8i9J0k1L2";
const PK = "pk_test_" + "z9Y8x7W6v5U4t3S2r1Q0p9O8";

describe("walletConfig (test keys only)", () => {
  it("is off with no keys", () => {
    expect(walletConfig({}).enabled).toBe(false);
  });
  it("is off when either key is missing", () => {
    expect(walletConfig({ STRIPE_SECRET_KEY: SK }).enabled).toBe(false);
    expect(walletConfig({ STRIPE_PUBLISHABLE_KEY: PK }).enabled).toBe(false);
  });
  it("refuses live and restricted keys", () => {
    for (const sk of ["sk_live_" + "a1B2c3D4e5F6g7H8i9J0", "rk_live_" + "a1B2c3D4e5F6g7H8i9J0", "rk_test_" + "a1B2c3D4e5F6g7H8i9J0"]) {
      const c = walletConfig({ STRIPE_SECRET_KEY: sk, STRIPE_PUBLISHABLE_KEY: PK });
      expect(c.enabled).toBe(false);
      expect(c.secretKey).toBeUndefined();
    }
    expect(walletConfig({ STRIPE_SECRET_KEY: SK, STRIPE_PUBLISHABLE_KEY: "pk_live_" + "z9Y8x7W6v5U4t3S2r1Q0" }).enabled).toBe(false);
  });
  it("refuses swapped and malformed keys", () => {
    expect(walletConfig({ STRIPE_SECRET_KEY: PK, STRIPE_PUBLISHABLE_KEY: SK }).enabled).toBe(false);
    expect(walletConfig({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PUBLISHABLE_KEY: PK }).enabled).toBe(false);
    expect(walletConfig({ STRIPE_SECRET_KEY: SK + " sk_live_abc", STRIPE_PUBLISHABLE_KEY: PK }).enabled).toBe(false);
  });
  it("never puts a key in the reason", () => {
    const c = walletConfig({ STRIPE_SECRET_KEY: "sk_live_" + "a1B2c3D4e5F6g7H8i9J0", STRIPE_PUBLISHABLE_KEY: PK });
    expect(c.reason).not.toMatch(/a1B2|z9Y8/);
  });
  it("is on with a valid test pair (whitespace trimmed)", () => {
    const c = walletConfig({ STRIPE_SECRET_KEY: ` ${SK}\n`, STRIPE_PUBLISHABLE_KEY: PK });
    expect(c).toEqual({ enabled: true, secretKey: SK, publishableKey: PK });
  });
});

describe("validAmountCents", () => {
  it("accepts integers from 50 to 500000", () => {
    expect(validAmountCents(50)).toBe(50);
    expect(validAmountCents(1299)).toBe(1299);
    expect(validAmountCents(500_000)).toBe(500_000);
  });
  it("rejects everything else", () => {
    for (const v of [49, 0, -100, 500_001, 12.5, NaN, Infinity, "1299", null, undefined, {}, [1299]]) expect(validAmountCents(v)).toBeNull();
  });
});

describe("intentForm", () => {
  it("sends only the amount and fixed demo fields", () => {
    const f = intentForm(1299);
    expect([...f.keys()].sort()).toEqual(["amount", "currency", "description", "metadata[demo]", "payment_method_types[]"].sort());
    expect(f.get("amount")).toBe("1299");
    expect(f.get("currency")).toBe("eur");
    expect(f.get("description")).toBe(DEMO_DESCRIPTION);
    expect(f.get("metadata[demo]")).toBe("crave");
  });
});
