// Minä: demo-customer switcher, language note and the concept notice with data attribution.
import { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";
import { PERSONAS } from "@shared/personas";
import type { CustomerIndexRow } from "@shared/types";
import { actions, useStore } from "@/state/store";
import { useCustomerState } from "@/state/customer";
import { fetchCustomer, fetchCustomerIndex, MOCK } from "@/lib/api";
import { money } from "@/lib/format";
import { navigate } from "@/lib/router";
import { Button, Card, CardTitle, Field, inputClass, Muted, Page, SectionTitle, STROKE, cx } from "@/ui/kit";

export function Mina() {
  const selected = useStore((s) => s.customerId);
  const cs = useCustomerState();
  const [index, setIndex] = useState<CustomerIndexRow[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCustomerIndex().then(setIndex, () => setIndex(null));
  }, []);

  const pick = (id: string) => {
    actions.selectCustomer(id);
    navigate("/koti", { replace: true });
  };

  const load = async () => {
    let id = q.trim().toUpperCase();
    if (/^\d{1,5}$/.test(id)) id = "CUST" + id.padStart(5, "0");
    if (!/^CUST\d{5}$/.test(id)) {
      setErr("Use an id like CUST01234 or just 1234.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await fetchCustomer(id);
      pick(id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const row = (id: string) => index?.find((r) => r.id === id);

  return (
    <Page>
      <SectionTitle>Choose a demo customer</SectionTitle>
      <Muted className="px-1">
        The dataset has no names. These first names are invented for the demo; every number comes from the customer's real
        (synthetic) transactions.
      </Muted>
      <div className="flex flex-col gap-2">
        {PERSONAS.map((p) => {
          const active = p.id === selected;
          const r = row(p.id);
          return (
            <Card key={p.id} onClick={() => pick(p.id)} label={`Switch to demo customer ${p.alias}`} className={cx(active && "ring-2 ring-green-500")}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-green-150 font-bold text-green-900" aria-hidden>
                  {p.alias[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {p.alias}, {p.age} <span className="font-normal text-ink-muted">· {p.area}</span>
                  </p>
                  <p className="text-sm text-ink-strong">{p.headline}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {p.id} · demo customer{r ? ` · balance ${money(r.endBalance, { whole: true })}` : ""}
                  </p>
                </div>
                {active && <Check size={20} strokeWidth={STROKE} className="text-green-500" aria-label="Selected" />}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>Load any customer</CardTitle>
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <Field label="Customer id" hint={index ? `${index.length.toLocaleString("fi-FI")} customers in the dataset (CUST00001–CUST05100).` : "CUST00001–CUST05100"}>
            {(id) => (
              <input id={id} className={inputClass} placeholder="e.g. CUST01408" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="characters" inputMode="text" />
            )}
          </Field>
          {err && <p className="text-sm text-error" role="alert">{err}</p>}
          <Button type="submit" icon={Search} disabled={busy || !q.trim()}>
            {busy ? "Loading…" : "Load customer"}
          </Button>
        </form>
        {cs.status === "ready" && !PERSONAS.some((p) => p.id === selected) && (
          <p className="mt-2 text-sm text-ink-muted">
            Now showing {selected}, age {cs.data.age}
            {cs.data.cohort === "tail" ? " (irregular-income cohort: some figures may look unusual)" : ""}.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Language</CardTitle>
        <p className="mt-1 text-sm text-ink-strong">
          The app is in English, with S-mobiili's Finnish tab names. Vara answers in the language you write in: Finnish,
          Swedish or English. The microphone in the chat follows the FI/EN switch there.
        </p>
      </Card>

      <Card>
        <CardTitle>About this demo</CardTitle>
        <p className="mt-1 text-sm text-ink-strong">
          Junction 2026 concept · not an official S-Pankki product. Built on the synthetic transaction dataset of the
          S-Pankki "Personal Economic Trainer" challenge (5,100 customers, Oct 2024 – Sep 2026). "Today" is 30 Sep 2026.
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Benchmarks: Statistics Finland, Household Budget Survey 2022, price-adjusted (CC BY 4.0). Icons: Lucide (ISC).
          Font: Schibsted Grotesk (OFL).
        </p>
        {MOCK && <p className="mt-2 text-sm text-info">Offline demo mode is on (?mock=1): chat and check-in are generated in the browser from the engine.</p>}
      </Card>
    </Page>
  );
}
