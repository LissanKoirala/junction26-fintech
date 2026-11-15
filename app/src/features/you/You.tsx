// YOU: what the machine-learning models learned about this customer, strongest cards first for the demo.
// The model-card screen lives at #/vara/you?view=models; #/vara/you?focus=<section> scrolls to a card.
import { lazy, useEffect } from "react";
import { ChevronRight, FlaskConical } from "lucide-react";
import { useRoute } from "@/lib/router";
import { useCustomerState } from "@/state/customer";
import { ConceptNotice, Page, SkeletonCard, STROKE } from "@/ui/kit";
import { openModels } from "@/features/ml/words";
import {
  ForecastSection, FuturesSection, Guard, HabitsSection, HomeSection, MoneyMapSection, PersonalitySection, RiskSection, TwinsSection, UnusualSection,
} from "./sections";

const ModelCards = lazy(() => import("./ModelCards"));

function ModelsEntry({ big }: { big?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => openModels()}
      className={
        big
          ? "flex w-full items-center gap-3 rounded-app-card bg-card p-4 text-left shadow-app-card transition-transform active:scale-[0.99]"
          : "flex w-full items-center gap-2 rounded-pill px-1 py-1 text-left text-sm text-ink-strong"
      }
    >
      <span className={big ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-green-100 text-green-700" : "text-green-700"}>
        <FlaskConical size={big ? 20 : 16} strokeWidth={STROKE} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        {big ? (
          <>
            <span className="block text-lg font-bold text-title">How these models were tested</span>
            <span className="block text-sm text-ink-muted">Eight models, each checked against a simple baseline</span>
          </>
        ) : (
          <>Eight models trained on 5,000 customers · <span className="font-semibold text-green-700">how they were tested</span></>
        )}
      </span>
      <ChevronRight size={big ? 20 : 16} strokeWidth={STROKE} className="shrink-0 text-icon-muted" aria-hidden />
    </button>
  );
}

export default function You() {
  const route = useRoute();
  const cs = useCustomerState();
  const view = route.query.get("view");
  const focus = route.query.get("focus");

  useEffect(() => {
    if (!focus || view) return;
    let n = 0;
    const tick = () => {
      const el = document.getElementById(`you-${focus}`);
      if (el) el.scrollIntoView({ behavior: n ? "smooth" : "auto", block: "start" });
      if (++n < 4) t = setTimeout(tick, 350);
    };
    let t = setTimeout(tick, 120);
    return () => clearTimeout(t);
  }, [focus, view, cs.status]);

  if (view === "models")
    return (
      <Guard label="The model cards" h={300}>
        <ModelCards focus={route.query.get("model")} />
      </Guard>
    );

  if (cs.status !== "ready")
    return (
      <Page>
        <SkeletonCard tall lines={4} />
        <SkeletonCard lines={5} />
      </Page>
    );

  return (
    <Page key={cs.id}>
      <ModelsEntry />
      <Guard label="Your money personality"><PersonalitySection /></Guard>
      <MoneyMapSection />
      <Guard label="Two futures" h={260}><TwinsSection /></Guard>
      <Guard label="Crystal ball" h={210}><ForecastSection /></Guard>
      <Guard label="Early warning"><RiskSection /></Guard>
      <Guard label="Your habits"><HabitsSection /></Guard>
      <Guard label="Unusual for you"><UnusualSection /></Guard>
      <Guard label="First home"><HomeSection /></Guard>
      <Guard label="Possible next two weeks"><FuturesSection /></Guard>
      <ModelsEntry big />
      <ConceptNotice />
    </Page>
  );
}
