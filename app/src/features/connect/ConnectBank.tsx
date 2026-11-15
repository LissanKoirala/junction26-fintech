// "Connect another bank" (PSD2 / open banking) — a mock flow. No real bank, no real connection.
import { useEffect, useMemo, useState } from "react";
import { CircleCheck, Clock, Eye, EyeOff, Landmark, Link2, ShieldCheck, Unlink } from "lucide-react";
import { useCustomer } from "@/state/customer";
import { actions, usePrefs } from "@/state/store";
import { addDays, dateFi, money, monthLabel } from "@/lib/format";
import { goBack, navigate } from "@/lib/router";
import { FullScreen, ScreenHeader, ScrollArea } from "@/ui/hero";
import { Badge, Banner, Button, Card, CardTitle, ConceptNotice, IconCircle, IconHero, ListRow, Muted, Page, STROKE, cx } from "@/ui/kit";
import { t as tr } from "@/lib/i18n";

const BANKS = [
  { id: "a", name: "Bank A (example)", sub: "Placeholder bank for the demo" },
  { id: "b", name: "Nordic Savings Bank (example)", sub: "Placeholder bank for the demo" },
  { id: "c", name: "City Cooperative Bank (example)", sub: "Placeholder bank for the demo" },
  { id: "d", name: "Online Bank D (example)", sub: "Placeholder bank for the demo" },
];
const CONSENT_DAYS = 90;

const SHARED = [
  "Account names and balances",
  "Transactions of the last 24 months: date, amount and type",
  "New transactions while the consent is valid",
];
const NOT_SHARED = ["Your login details or PIN", "The right to make payments or move money", "Anything after you withdraw consent"];

type Step = "intro" | "pick" | "consent" | "linking" | "done";

/** What we really know about the other account: the salary sweeps sent there from this account. */
function useSweepFacts() {
  const c = useCustomer();
  return useMemo(() => {
    if (!c) return null;
    const sweeps = c.tx.filter((t) => t.type === "salary_sweep");
    if (!sweeps.length) return null;
    const last = sweeps[sweeps.length - 1];
    const month = last.date.slice(0, 7);
    const monthTotal = sweeps.filter((t) => t.date.startsWith(month)).reduce((s, t) => s - t.amount, 0);
    const yearFrom = addDays(c.asOf, -365);
    const year = sweeps.filter((t) => t.date > yearFrom).reduce((s, t) => s - t.amount, 0);
    return { month, monthTotal, year, count: sweeps.length };
  }, [c]);
}

export default function ConnectBank() {
  const c = useCustomer();
  const prefs = usePrefs();
  const [step, setStep] = useState<Step>(prefs.bank ? "done" : "intro");
  const [bank, setBank] = useState<string | null>(null);
  const facts = useSweepFacts();
  const close = () => goBack("/vara/today");
  const asOf = c?.asOf ?? "2026-09-30";

  useEffect(() => {
    if (step !== "linking") return;
    const t = setTimeout(() => {
      const b = BANKS.find((x) => x.id === bank) ?? BANKS[0];
      actions.connectBank({ bankName: b.name.replace(/ \(example\)$/, ""), connectedAt: asOf, validUntil: addDays(asOf, CONSENT_DAYS) });
      setStep("done");
    }, 1400);
    return () => clearTimeout(t);
  }, [step, bank, asOf]);

  const back = step === "pick" ? () => setStep("intro") : step === "consent" ? () => setStep("pick") : close;

  return (
    <FullScreen>
      <ScreenHeader title={tr("Connect another bank")} onBack={back} />
      <ScrollArea>
        <Page>
          {step === "intro" && (
            <>
              <Card className="flex flex-col items-center gap-3 py-6 text-center">
                <IconHero icon={Link2} />
                <h2 className="text-xl font-bold text-title">{tr("See all your money in one place")}</h2>
                <p className="text-ink">
                  {tr("With your consent, Vara can read your accounts in other banks through open banking (PSD2). Your safe-to-spend and baskets then count everything, not just this account.")}
                </p>
              </Card>
              {c?.hasSalarySweep && facts && (
                <Banner tone="info" title={tr("Why Vara suggests this")}>
                  {tr("Most of your salary leaves this account right after payday: {amount} in {month}. Vara can't see how that money is spent.", { amount: money(facts.monthTotal, { whole: true }), month: monthLabel(facts.month) })}
                </Banner>
              )}
              <Button full onClick={() => setStep("pick")}>{tr("Choose a bank")}</Button>
              <div className="flex justify-center"><Badge tone="neutral">{tr("Demo: this is a simulated flow")}</Badge></div>
            </>
          )}

          {step === "pick" && (
            <>
              <Muted className="px-1">{tr("Pick the bank to connect. These are placeholder names for the demo.")}</Muted>
              <Card padded={false} className="px-4">
                <ul className="divide-y divide-line">
                  {BANKS.map((b) => (
                    <li key={b.id}>
                      <ListRow icon={Landmark} title={tr(b.name)} subtitle={tr(b.sub)} chevron onClick={() => { setBank(b.id); setStep("consent"); }} />
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          {step === "consent" && (
            <>
              <div className="px-1">
                <h2 className="text-xl font-bold text-title">{tr("Share account data with Vara?")}</h2>
                <Muted>{tr("From {bank}, read-only.", { bank: tr(BANKS.find((b) => b.id === bank)?.name ?? BANKS[0].name) })}</Muted>
              </div>
              <Card>
                <CardTitle>{tr("What is shared")}</CardTitle>
                <ul className="mt-2 flex flex-col gap-2">
                  {SHARED.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-ink">
                      <Eye size={18} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-green-700" aria-hidden /> {tr(s)}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardTitle>{tr("What is never shared")}</CardTitle>
                <ul className="mt-2 flex flex-col gap-2">
                  {NOT_SHARED.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-ink">
                      <EyeOff size={18} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden /> {tr(s)}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <div className="flex items-start gap-3">
                  <Clock size={20} strokeWidth={STROKE} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
                  <p className="text-ink">
                    {tr("Valid for {n} days, until {date}. You can withdraw it any time in Minä, and Vara will ask before renewing.", { n: CONSENT_DAYS, date: dateFi(addDays(asOf, CONSENT_DAYS)) })}
                  </p>
                </div>
              </Card>
              <div className="flex flex-col gap-2">
                <Button full icon={ShieldCheck} onClick={() => setStep("linking")}>{tr("Give consent (simulated)")}</Button>
                <Button full variant="ghost" onClick={close}>{tr("Cancel")}</Button>
              </div>
            </>
          )}

          {step === "linking" && (
            <Card className="flex flex-col items-center gap-3 py-10 text-center" >
              <span className="dot-pulse flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-pill bg-green-700" />
                <span className="h-2.5 w-2.5 rounded-pill bg-green-700" />
                <span className="h-2.5 w-2.5 rounded-pill bg-green-700" />
              </span>
              <p className="font-semibold text-ink" role="status">{tr("Confirming with your bank…")}</p>
              <Muted>{tr("In real life you would sign in to the other bank here.")}</Muted>
            </Card>
          )}

          {step === "done" && prefs.bank && (
            <>
              <Card className="flex flex-col items-center gap-2 py-6 text-center">
                <span className={cx("flex h-14 w-14 items-center justify-center rounded-pill bg-green-150 text-green-700")}>
                  <CircleCheck size={32} strokeWidth={STROKE} aria-hidden />
                </span>
                <h2 className="text-xl font-bold text-title">{tr("Showing 2 banks (simulated)")}</h2>
                <Muted>
                  {tr("{bank} connected on {date} · consent valid until {until}", { bank: tr(prefs.bank.bankName), date: dateFi(prefs.bank.connectedAt), until: dateFi(prefs.bank.validUntil) })}
                </Muted>
              </Card>
              <Card>
                <CardTitle>{tr("Your accounts")}</CardTitle>
                <ListRow icon={Landmark} title="S-Pankki Käyttötili" subtitle={tr("This account")} right={c ? money(c.tx[c.tx.length - 1]?.balance) : "–"} />
                <ListRow
                  leading={<IconCircle icon={Landmark} tone="sunken" />}
                  title={tr(prefs.bank.bankName)}
                  subtitle={tr("Simulated connection")}
                  right={<span className="text-sm font-normal text-ink-muted">{tr("No data")}</span>}
                />
                {facts ? (
                  <Muted className="mt-2">
                    {tr("What Vara already knows: right after payday you moved {year} out of your S-Pankki account in the last 12 months ({month} in {monthName}). With a real connection Vara would also see how it is spent. The dataset has no other-bank data, so the figures elsewhere stay S-Pankki only.", {
                      year: money(facts.year, { whole: true }),
                      month: money(facts.monthTotal, { whole: true }),
                      monthName: monthLabel(facts.month),
                    })}
                  </Muted>
                ) : (
                  <Muted className="mt-2">{tr("The dataset has no other-bank data, so Vara keeps showing this account's figures only.")}</Muted>
                )}
              </Card>
              <div className="flex flex-col gap-2">
                <Button full onClick={() => navigate("/vara/today", { replace: true })}>{tr("Back to Today")}</Button>
                <Button full variant="ghost" icon={Unlink} onClick={() => { actions.connectBank(null); setStep("intro"); }}>{tr("Disconnect")}</Button>
              </div>
            </>
          )}
          <ConceptNotice />
        </Page>
      </ScrollArea>
    </FullScreen>
  );
}
