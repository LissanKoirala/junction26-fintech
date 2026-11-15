// The Vara space: own header (back, "Vara", avatar) and four sections Today · Chat · What-if · You.
import { lazy, Suspense } from "react";
import { goBack, navigate } from "@/lib/router";
import { ScreenHeader, ScrollArea, VaraAvatar } from "@/ui/hero";
import { Segmented, SkeletonCard } from "@/ui/kit";
import { Today } from "@/features/today/Today";
import { useCustomerState, retryCustomer } from "@/state/customer";
import { Button, LangSwitch, Unavailable } from "@/ui/kit";
import { t } from "@/lib/i18n";
import { ErrorBoundary } from "@/ui/ErrorBoundary";

const Chat = lazy(() => import("@/features/chat/Chat"));
const WhatIf = lazy(() => import("@/features/whatif/WhatIf"));
const You = lazy(() => import("@/features/you/You"));

export type VaraSection = "today" | "chat" | "whatif" | "you";
// English labels; translated where shown (never call t() at module scope).
const OPTIONS: { value: VaraSection; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "chat", label: "Chat" },
  { value: "whatif", label: "What-if" },
  { value: "you", label: "You" },
];

function Loading() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <SkeletonCard tall />
      <SkeletonCard />
    </div>
  );
}

export function VaraSpace({ section }: { section: VaraSection }) {
  const cs = useCustomerState();
  return (
    <>
      <ScreenHeader
        title="Vara"
        leading={<VaraAvatar size={26} />}
        onBack={() => goBack("/koti")}
        right={<LangSwitch className="mr-1" />}
      />
      <div className="shrink-0 px-gutter pb-2">
        <Segmented
          label={t("Vara sections")}
          value={section}
          options={OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
          onChange={(v) => navigate("/vara/" + v, { replace: true })}
        />
      </div>
      {cs.status === "error" ? (
        <div className="p-4">
          <Unavailable
            title={t("Customer data could not be loaded")}
            reason={cs.error}
            action={<Button size="sm" onClick={retryCustomer}>{t("Try again")}</Button>}
          />
        </div>
      ) : section === "chat" ? (
        <ErrorBoundary label="The chat">
          <Suspense fallback={<Loading />}>
            <Chat />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ScrollArea key={section} id="vara-scroll">
          <ErrorBoundary label="This section">
          <Suspense fallback={<Loading />}>
            {section === "today" && <Today />}
            {section === "whatif" && <WhatIf />}
            {section === "you" && <You />}
          </Suspense>
          </ErrorBoundary>
        </ScrollArea>
      )}
    </>
  );
}
