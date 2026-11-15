// PLACEHOLDER owned by the ML-UI agent: Money Map and tribe, Two Futures, habits, unusual-for-you,
// first-home readiness, model cards. Replace this file freely (default export, no props; read the customer
// with useCustomer() from "@/state/customer").
import { Sparkles } from "lucide-react";
import { Card, ConceptNotice, Muted, Page, STROKE } from "@/ui/kit";

export default function You() {
  return (
    <Page>
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-green-150 text-green-900">
          <Sparkles size={28} strokeWidth={STROKE} aria-hidden />
        </span>
        <p className="text-lg font-bold text-title">Your money profile is coming together</p>
        <Muted className="max-w-[280px]">
          Soon: your Money Map and tribe, two possible futures, the habits you are building and how ready you are for a first home.
        </Muted>
      </Card>
      <ConceptNotice />
    </Page>
  );
}
