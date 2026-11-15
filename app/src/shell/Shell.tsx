// S-mobiili shell: top bar (centred title, chat bubble right) and the bottom navigation.
import { lazy, Suspense } from "react";
import { CircleUserRound, House, Landmark, LoaderCircle, MessageCircle, Plus, ShoppingBag, WalletCards, type LucideIcon } from "lucide-react";
import { navigate } from "@/lib/router";
import { t } from "@/lib/i18n";
import { cx, IconButton, LangSwitch, STROKE } from "@/ui/kit";
import { ScrollArea } from "@/ui/hero";
import { Koti } from "./Koti";
import { Pankki } from "./Pankki";
import { Mina } from "./Mina";
import { Etukortti, Maksu } from "./Static";

const ShoppingLabFlow = lazy(() => import("@/features/crave/ShoppingLabFlow"));

export type TabKey = "koti" | "etukortti" | "maksu" | "pankki" | "mina" | "lab";

// English keys, translated where shown (Finnish: Koti, S-Etukortti, Maksu, Pankki, Minä). Use tabTitle() for nav labels too.
const TITLES: Record<Exclude<TabKey, "lab">, string> = { koti: "Home", etukortti: "S-Etukortti", maksu: "Payment", pankki: "Bank", mina: "Me" };
export const tabTitle = (tab: Exclude<TabKey, "lab">): string => t(TITLES[tab]);

export function TopBar({ title }: { title: string }) {
  return (
    <header className="grid shrink-0 grid-cols-[76px_1fr_76px] items-center bg-screen px-1 pt-[env(safe-area-inset-top)]">
      <div className="pl-2">
        <LangSwitch />
      </div>
      <h1 className="flex min-h-14 items-center justify-center text-lg font-bold text-green-900">{title}</h1>
      <div className="flex justify-end">
        <IconButton icon={MessageCircle} label={t("Open Vara chat")} onClick={() => navigate("/vara/chat")} />
      </div>
    </header>
  );
}

function NavItem({ tab, icon: Icon, label, active }: { tab: TabKey; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <button
      type="button"
      onClick={() => navigate("/" + tab, { replace: true })}
      aria-current={active ? "page" : undefined}
      className={cx("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs", active ? "font-semibold text-green-500" : "text-ink-muted")}
    >
      <Icon size={24} strokeWidth={STROKE} aria-hidden />
      <span className={active ? "text-green-700" : undefined}>{label}</span>
    </button>
  );
}

// Six items around the raised Maksu button: two on the left, three on the right. Each side takes half of the width
// left over by the centre column, so Maksu stays centred and "S-Etukortti" keeps room at 360 px.
export function BottomNav({ tab }: { tab: TabKey }) {
  return (
    <nav aria-label={t("Main")}className="relative z-10 flex shrink-0 items-end border-t border-line bg-card px-1 pb-[env(safe-area-inset-bottom)]">
      <div className="flex min-w-0 flex-1 items-end">
        <NavItem tab="koti" icon={House} label={tabTitle("koti")} active={tab === "koti"} />
        <NavItem tab="etukortti" icon={WalletCards} label={tabTitle("etukortti")} active={tab === "etukortti"} />
      </div>
      <div className="flex w-[72px] shrink-0 flex-col items-center pb-1">
        <button
          type="button"
          aria-label={tabTitle("maksu")}
          aria-current={tab === "maksu" ? "page" : undefined}
          onClick={() => navigate("/maksu", { replace: true })}
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-pill bg-green-700 text-white shadow-middle transition-transform duration-200 active:scale-95"
        >
          <Plus size={28} strokeWidth={2} aria-hidden />
        </button>
        <span className={cx("text-xs", tab === "maksu" ? "font-semibold text-green-700" : "text-ink-muted")}>{tabTitle("maksu")}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-end">
        <NavItem tab="pankki" icon={Landmark} label={tabTitle("pankki")} active={tab === "pankki"} />
        <NavItem tab="lab" icon={ShoppingBag} label={t("Shop")} active={tab === "lab"} />
        <NavItem tab="mina" icon={CircleUserRound} label={tabTitle("mina")} active={tab === "mina"} />
      </div>
    </nav>
  );
}

export function Shell({ tab }: { tab: TabKey }) {
  return (
    <>
      <TopBar title={tab === "lab" ? t("Shopping Lab") : tabTitle(tab)} />
      {tab === "lab" ? (
        <Suspense fallback={<div className="flex flex-1 items-center justify-center text-green-700"><LoaderCircle className="motion-safe:animate-spin" size={28} strokeWidth={STROKE} aria-hidden /></div>}>
          <ShoppingLabFlow inShell />
        </Suspense>
      ) : <ScrollArea key={tab}>
        {tab === "koti" && <Koti />}
        {tab === "pankki" && <Pankki />}
        {tab === "mina" && <Mina />}
        {tab === "etukortti" && <Etukortti />}
        {tab === "maksu" && <Maksu />}
      </ScrollArea>}
      <BottomNav tab={tab} />
    </>
  );
}
