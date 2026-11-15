import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { goBack } from "@/lib/router";
import { t } from "@/lib/i18n";
import { FullScreen } from "@/ui/hero";
import { Button, ConceptNotice, STROKE } from "@/ui/kit";

// The teammate's Shopping Lab (shopping-lab/), served by our VM under /lab/ (vara-lab service, bin/deploy-lab).
// An absolute address so the development copy on another port loads the same hosted lab. No customer/bank data
// enters the frame; it only receives the parent origin (its checkout message is not consumed here).
const LAB_URL = "https://vara-junction26.swedencentral.cloudapp.azure.com/lab/";

/** `#/crave/lab`: full screen with a way back to Crave. `inShell`: the bottom-navigation tab (`#/lab`), whose top bar
 *  and navigation come from the shell. */
export default function ShoppingLabFlow({ inShell = false }: { inShell?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "slow" | "loaded" | "error">("loading");
  const source = new URL(LAB_URL);
  source.searchParams.set("embed", "1");
  source.searchParams.set("parentOrigin", window.location.origin);

  useEffect(() => {
    const timer = window.setTimeout(() => setStatus((s) => s === "loading" ? "slow" : s), 15000);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  const newTab = (
    <a href={LAB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-green-700" aria-label={t("Open shopping demo in a new tab")}>
      <ExternalLink size={16} strokeWidth={STROKE} aria-hidden />
    </a>
  );
  const body = (
    <>
      {!inShell && <header className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)]">
        <button className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-green-700" aria-label={t("Back")} onClick={() => goBack("/crave")}><ArrowLeft size={17} strokeWidth={STROKE} aria-hidden />{t("Crave mode")}</button>
        <h1 className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">{t("Shopping Lab")}</h1>
        {newTab}
      </header>}
      {/* In the tab, the notice sits on top: at the bottom the raised Maksu button would cover it. */}
      {inShell && <div className="flex shrink-0 items-center justify-between pl-1 pr-2">
        <span className="w-9" aria-hidden />
        <ConceptNotice className="py-0 text-[9px]" />
        {newTab}
      </div>}
      <div className={inShell ? "relative min-h-0 flex-1 bg-card pb-5" : "relative min-h-0 flex-1 bg-card"}>{/* pb-5: clear of the raised Maksu button */}
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
          <a className="ml-3 text-sm font-semibold text-green-700 underline" href={LAB_URL} target="_blank" rel="noopener noreferrer">{t("Open in new tab")}</a>
        </div>}
      </div>
      {!inShell && <ConceptNotice className="shrink-0 py-1 text-[9px]" />}
    </>
  );
  return inShell ? <div className="flex min-h-0 flex-1 flex-col">{body}</div> : <FullScreen>{body}</FullScreen>;
}
