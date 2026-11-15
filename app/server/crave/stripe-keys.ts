// Stripe test-mode guard for the Crave pay moment. Pure helpers, no I/O, so they can be unit-tested.
// The feature exists only to show the real wallet sheet in a demo: a live key must never be accepted.

export interface WalletConfig {
  enabled: boolean;
  /** Why the wallet is off (safe to log: never contains a key). */
  reason?: string;
  secretKey?: string;
  publishableKey?: string;
}

// Stripe keys are alphanumeric after the prefix; the length floor rejects obvious placeholders.
const SECRET_RE = /^sk_test_[A-Za-z0-9]{16,}$/;
const PUBLISHABLE_RE = /^pk_test_[A-Za-z0-9]{16,}$/;

export function walletConfig(env: Record<string, string | undefined>): WalletConfig {
  const sk = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const pk = env.STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!sk && !pk) return { enabled: false, reason: "STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are not set" };
  if (!sk) return { enabled: false, reason: "STRIPE_SECRET_KEY is not set" };
  if (!pk) return { enabled: false, reason: "STRIPE_PUBLISHABLE_KEY is not set" };
  if (!sk.startsWith("sk_test_")) return { enabled: false, reason: "STRIPE_SECRET_KEY is not a test key (must start with sk_test_); live and restricted keys are refused" };
  if (!pk.startsWith("pk_test_")) return { enabled: false, reason: "STRIPE_PUBLISHABLE_KEY is not a test key (must start with pk_test_)" };
  if (!SECRET_RE.test(sk)) return { enabled: false, reason: "STRIPE_SECRET_KEY does not look like a Stripe key" };
  if (!PUBLISHABLE_RE.test(pk)) return { enabled: false, reason: "STRIPE_PUBLISHABLE_KEY does not look like a Stripe key" };
  return { enabled: true, secretKey: sk, publishableKey: pk };
}

export const MIN_CENTS = 50;
export const MAX_CENTS = 500_000;

/** Returns the amount in cents if it is an integer in [50, 500000], else null. */
export function validAmountCents(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  if (v < MIN_CENTS || v > MAX_CENTS) return null;
  return v;
}

export const DEMO_DESCRIPTION = "Vara Crave mode demo: test payment, nothing is charged";

/** The only fields ever sent to Stripe when creating a PaymentIntent. Nothing about the person. */
export function intentForm(amountCents: number): URLSearchParams {
  const f = new URLSearchParams();
  f.set("amount", String(amountCents));
  f.set("currency", "eur");
  // This Stripe account's API version no longer accepts payment_method_types; payment methods are dynamic.
  // Redirect-based methods are switched off: the wallet sheet confirms in place.
  f.set("automatic_payment_methods[enabled]", "true");
  f.set("automatic_payment_methods[allow_redirects]", "never");
  f.set("description", DEMO_DESCRIPTION);
  f.set("metadata[demo]", "crave");
  return f;
}

export const basicAuth = (secretKey: string) => "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
