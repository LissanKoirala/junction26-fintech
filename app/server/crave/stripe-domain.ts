// Registers the demo domain with Stripe for Apple Pay / Google Pay in the Express Checkout Element.
// Run by hand on the VM:  npx tsx server/crave/stripe-domain.ts [domain]
// Uses STRIPE_SECRET_KEY from the environment, refuses anything that is not a test key, never prints the key.
import { basicAuth, walletConfig } from "./stripe-keys";

const DOMAIN = process.argv[2] ?? "vara-junction26.swedencentral.cloudapp.azure.com";

interface Pmd {
  id: string;
  domain_name: string;
  enabled: boolean;
  livemode: boolean;
  [k: string]: unknown;
}
type Status = { status?: string; status_details?: { error_message?: string } };

async function stripe(method: "GET" | "POST", p: string, key: string, body?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${p}`, {
    method,
    headers: { Authorization: basicAuth(key), "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, any>;
  // Stripe error messages can echo a masked key ("sk_test_****1234"); scrub anything key-shaped anyway
  if (!res.ok) throw new Error(`${res.status} ${j.error?.type ?? ""}: ${String(j.error?.message ?? "").replace(/[sprk]k_(test|live)_[*A-Za-z0-9]+/g, "[key]")}`);
  return j;
}

function show(d: Pmd) {
  console.log(`domain     ${d.domain_name}  (id ${d.id}, enabled ${d.enabled}, livemode ${d.livemode})`);
  for (const k of ["apple_pay", "google_pay", "link", "paypal"]) {
    const s = d[k] as Status | undefined;
    if (!s) continue;
    console.log(`${k.padEnd(10)} ${s.status ?? "?"}${s.status_details?.error_message ? `  -> ${s.status_details.error_message}` : ""}`);
  }
}

async function main() {
  const cfg = walletConfig(process.env);
  if (!cfg.enabled) {
    console.error(`Not running: ${cfg.reason}.`);
    process.exit(1);
  }
  const key = cfg.secretKey!;
  const list = await stripe("GET", `payment_method_domains?domain_name=${encodeURIComponent(DOMAIN)}&limit=10`, key);
  let d = (list.data as Pmd[] | undefined)?.find((x) => x.domain_name === DOMAIN);
  if (d) {
    console.log("Already registered; asking Stripe to re-validate.");
    d = (await stripe("POST", `payment_method_domains/${d.id}/validate`, key)) as Pmd;
  } else {
    d = (await stripe("POST", "payment_method_domains", key, new URLSearchParams({ domain_name: DOMAIN }))) as Pmd;
    console.log("Registered.");
  }
  show(d);
  const ap = (d.apple_pay as Status | undefined)?.status;
  console.log("");
  if (ap === "active") {
    console.log("Apple Pay is active for this domain in the sandbox. Test-key registration is enough for the demo;");
    console.log("live-mode registration is only needed before taking real payments, which this demo never does.");
  } else {
    console.log("Apple Pay is NOT active yet. Copy the error text above. If it mentions a domain association file,");
    console.log("Stripe wants /.well-known/apple-developer-merchantid-domain-association served over HTTPS; report it");
    console.log("rather than changing Caddy. Otherwise register the domain in the Dashboard (live mode also covers");
    console.log("sandboxes): https://dashboard.stripe.com/settings/payment_method_domains");
  }
}

main().catch((e) => {
  console.error(`Stripe call failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
