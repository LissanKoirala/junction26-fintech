// The real phone-wallet sheet for the Crave pay moment, via Stripe's Express Checkout Element in TEST MODE.
// Only switches on when the server says it has test keys (GET /api/crave/wallet). Stripe.js loads from js.stripe.com
// on demand (never bundled). Anything that goes wrong (no wallet, load error, slow, refused) falls back to the
// simulated ritual. Stripe receives only the amount: no customer id, craving or email.
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";

const STRIPE_JS = "https://js.stripe.com/endive/stripe.js"; // the path the current docs use
const READY_TIMEOUT_MS = 4000;
const BUSINESS_NAME = "Vara Crave demo";

/* eslint-disable @typescript-eslint/no-explicit-any */
type StripeJs = (pk: string, opts?: { locale?: string; developerTools?: { assistant?: { enabled?: boolean } } }) => any;
declare global {
  interface Window {
    Stripe?: StripeJs;
  }
}

let scriptP: Promise<StripeJs> | null = null;
function loadStripeJs(): Promise<StripeJs> {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (scriptP) return scriptP;
  scriptP = new Promise<StripeJs>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = STRIPE_JS;
    s.async = true;
    s.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error("no Stripe")));
    s.onerror = () => reject(new Error("load"));
    document.head.appendChild(s);
  }).catch((e) => {
    scriptP = null; // allow a retry on the next checkout
    throw e;
  });
  return scriptP;
}

/**
 * probing: checking for a wallet (simulated controls stay usable meanwhile)
 * ready:   the wallet button is mounted and visible
 * off:     use the simulated ritual (no keys, no wallet, error, or too slow)
 */
export type WalletState = "probing" | "ready" | "off";
export type WalletNote = "cancelled" | "failed" | null;

export function useRealWallet({ open, amountCents, lang, onPaid }: { open: boolean; amountCents: number; lang: Lang; onPaid: () => void }) {
  const [state, setState] = useState<WalletState>("off");
  const [note, setNote] = useState<WalletNote>(null);
  const [paying, setPaying] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const forced = useRef(false); // the person took the simulated path: never switch to the wallet after that
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    if (!open) return;
    setNote(null);
    setPaying(false);
    forced.current = false;
    if (amountCents < 50) {
      setState("off");
      return;
    }
    setState("probing");
    let alive = true;
    let el: any = null;
    const off = () => {
      if (!alive) return;
      alive = false;
      // destroy on the next tick: off() can run inside Stripe's own event dispatch (loaderror)
      const dead = el;
      setTimeout(() => {
        try {
          dead?.destroy();
        } catch {
          /* already gone */
        }
      }, 0);
      setState("off");
    };
    const timer = setTimeout(off, READY_TIMEOUT_MS);

    (async () => {
      const cfg = (await fetch("/api/crave/wallet").then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { enabled?: boolean; publishableKey?: string } | null;
      if (!alive) return;
      if (!cfg?.enabled || !cfg.publishableKey || !cfg.publishableKey.startsWith("pk_test_")) return off();
      const Stripe = await loadStripeJs();
      if (!alive || !mountRef.current) return off();
      // Stripe's floating test-mode helper badge would sit on top of the sheet's footer note: switched off.
      const stripe = Stripe(cfg.publishableKey, { locale: lang, developerTools: { assistant: { enabled: false } } });
      const elements = stripe.elements({ mode: "payment", amount: amountCents, currency: "eur", allowedPaymentMethodTypes: ["card"], locale: lang, appearance: { theme: "stripe", variables: { borderRadius: "12px" } } });
      el = elements.create("expressCheckout", {
        business: { name: BUSINESS_NAME },
        paymentMethods: { applePay: "always", googlePay: "always", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
        buttonType: { applePay: "plain", googlePay: "plain" },
        buttonTheme: { applePay: "black", googlePay: "black" },
        buttonHeight: 48,
        layout: { maxColumns: 1 },
        billingAddressRequired: false,
        emailRequired: false,
        phoneNumberRequired: false,
      });
      const available = (pm: Record<string, boolean> | undefined | null) => !!pm && (pm.applePay || pm.googlePay);
      el.on("ready", ({ availablePaymentMethods }: { availablePaymentMethods?: Record<string, boolean> }) => {
        if (!alive || forced.current) return;
        if (!available(availablePaymentMethods)) return off();
        clearTimeout(timer);
        setState("ready");
      });
      el.on("loaderror", off);
      el.on("cancel", () => alive && setNote("cancelled"));
      el.on("confirm", async (event: any) => {
        if (!alive) return;
        setPaying(true);
        setNote(null);
        const fail = () => {
          try {
            event.paymentFailed?.({ reason: "fail" });
          } catch {
            /* sheet already closed */
          }
          setPaying(false);
          if (alive) setNote("failed");
        };
        try {
          const { error: submitError } = await elements.submit();
          if (submitError) return fail();
          const r = await fetch("/api/crave/wallet/intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents, lang }) });
          const j = (await r.json().catch(() => ({}))) as { clientSecret?: string };
          if (!r.ok || !j.clientSecret) return fail();
          const { error } = await stripe.confirmPayment({ elements, clientSecret: j.clientSecret, confirmParams: { return_url: location.href }, redirect: "if_required" });
          if (error) return fail();
          if (alive) onPaidRef.current(); // the wallet sheet shows its own success; no chime of ours
        } catch {
          fail();
        }
      });
      el.mount(mountRef.current);
    })().catch(off);

    return () => {
      alive = false;
      clearTimeout(timer);
      const dead = el;
      el = null;
      setTimeout(() => {
        try {
          dead?.destroy();
        } catch {
          /* already gone */
        }
      }, 0);
    };
  }, [open, amountCents, lang]);

  /** The person chose the simulated path after a cancel or failure. */
  const switchToSimulated = () => {
    forced.current = true;
    setNote(null);
    setState("off");
  };
  return { state, note, paying, mountRef, switchToSimulated };
}
