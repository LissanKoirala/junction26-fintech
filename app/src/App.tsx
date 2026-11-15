// Root: phone-width frame, hash routing between the S-mobiili shell, the Vara space and full-screen flows.
import { lazy, Suspense, useEffect } from "react";
import { useRoute } from "@/lib/router";
import { Shell, type TabKey } from "@/shell/Shell";
import { VaraSpace, type VaraSection } from "@/features/vara/VaraSpace";
import { FullScreen } from "@/ui/hero";
import { SkeletonCard } from "@/ui/kit";
import { applyThemeToDocument } from "@/ui/theme";
import { useStore } from "@/state/store";
import { ToastHost } from "@/ui/toast";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { useLang } from "@/lib/i18n";

const BasketsExplorer = lazy(() => import("@/features/baskets/BasketsExplorer"));
const CheckInStories = lazy(() => import("@/features/checkin/CheckInStories"));
const GoalFlow = lazy(() => import("@/features/goal/GoalFlow"));
const ConnectBank = lazy(() => import("@/features/connect/ConnectBank"));
const CraveFlow = lazy(() => import("@/features/crave/CraveFlow"));

const TABS: TabKey[] = ["koti", "etukortti", "maksu", "pankki", "mina"];
const SECTIONS: VaraSection[] = ["today", "chat", "whatif", "you"];

function FlowFallback() {
  return (
    <FullScreen>
      <div className="flex flex-col gap-3 p-4 pt-16">
        <SkeletonCard tall />
        <SkeletonCard />
      </div>
    </FullScreen>
  );
}

export default function App() {
  const route = useRoute();
  const customerId = useStore((s) => s.customerId);
  const lang = useLang(); // part of the key below: switching language remounts the screens so every t() call re-runs
  useEffect(applyThemeToDocument, []);
  const [a, b] = route.segments;

  let content: React.ReactNode;
  if (a === "vara") content = <VaraSpace section={SECTIONS.includes(b as VaraSection) ? (b as VaraSection) : "today"} />;
  else if (a === "flow") {
    const flow =
      b === "baskets" ? <BasketsExplorer /> : b === "checkin" ? <CheckInStories /> : b === "goal" ? <GoalFlow /> : b === "connect" ? <ConnectBank /> : null;
    content = flow ? <Suspense fallback={<FlowFallback />}>{flow}</Suspense> : <Shell tab="koti" />;
  } else if (a === "crave") content = <Suspense fallback={<FlowFallback />}><CraveFlow /></Suspense>;
  else content = <Shell tab={TABS.includes(a as TabKey) ? (a as TabKey) : "koti"} />;

  return (
    <div className="flex h-full w-full justify-center">
      <div
        id="phone"
        key={`${customerId}:${lang}`}
        className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-screen sm:shadow-middle"
      >
        <ErrorBoundary key={route.path} label="This screen">{content}</ErrorBoundary>
        <ToastHost />
        <div id="overlay-root" className="pointer-events-none absolute inset-0 z-50 [&>*]:pointer-events-auto" />
      </div>
    </div>
  );
}
