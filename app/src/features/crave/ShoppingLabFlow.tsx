import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { goBack } from "@/lib/router";
import { t } from "@/lib/i18n";
import { FullScreen, ScreenHeader } from "@/ui/hero";
import { Button, ConceptNotice, STROKE } from "@/ui/kit";

// The catalogue importer runs on its own origin. No customer/bank data enters the frame.
const LAB_ORIGIN = "https://vara-shopping-lab.lissanartist.chatgpt.site";

export default function ShoppingLabFlow() {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "slow" | "loaded" | "error">("loading");
  const source = new URL(LAB_ORIGIN);
  source.searchParams.set("embed", "1");
  source.searchParams.set("parentOrigin", window.location.origin);

  useEffect(() => {
    const timer = window.setTimeout(() => setStatus((s) => s === "loading" ? "slow" : s), 15000);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  return (
    <FullScreen>
      <ScreenHeader title={t("Shopping Lab")} onBack={() => goBack("/crave")} right={
        <a href={LAB_ORIGIN} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-pill text-green-700" aria-label={t("Open shopping demo in a new tab")}>
          <ExternalLink size={20} strokeWidth={STROKE} aria-hidden />
        </a>
      } />
      <p className="shrink-0 px-gutter pb-2 text-center text-xs text-ink-muted">{t("Real products · demo checkout · nothing ships")}</p>
      <div className="relative min-h-0 flex-1 bg-card">
        <iframe
          key={attempt}
          title={t("Shopping Lab storefront")}
          src={source.href}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
        {status === "loading" && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card text-green-700" role="status">
          <LoaderCircle className="motion-safe:animate-spin" size={28} strokeWidth={STROKE} aria-hidden />
          <p className="text-sm">{t("Opening the shopping demo…")}</p>
        </div>}
        {(status === "slow" || status === "error") && <div className="absolute inset-x-4 top-4 rounded-app-card bg-screen p-4 shadow-app-card" role="status">
          <p className="text-sm text-ink">{t("Having trouble loading the shop? Retry or open the demo in a new tab.")}</p>
          <Button size="sm" variant="soft" className="mt-3" icon={RotateCcw} onClick={() => { setStatus("loading"); setAttempt((n) => n + 1); }}>{t("Try again")}</Button>
          <a className="ml-3 text-sm font-semibold text-green-700 underline" href={LAB_ORIGIN} target="_blank" rel="noopener noreferrer">{t("Open in new tab")}</a>
        </div>}
      </div>
      <ConceptNotice className="shrink-0 py-2" />
    </FullScreen>
  );
}
