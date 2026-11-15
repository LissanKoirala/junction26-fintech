// S-mobiili shell: top bar (centred title, chat bubble right) and the bottom navigation.
import { CircleUserRound, House, Landmark, MessageCircle, Plus, WalletCards, type LucideIcon } from "lucide-react";
import { navigate } from "@/lib/router";
import { cx, IconButton, STROKE } from "@/ui/kit";
import { ScrollArea } from "@/ui/hero";
import { Koti } from "./Koti";
import { Pankki } from "./Pankki";
import { Mina } from "./Mina";
import { Etukortti, Maksu } from "./Static";

export type TabKey = "koti" | "etukortti" | "maksu" | "pankki" | "mina";

const TITLES: Record<TabKey, string> = { koti: "Koti", etukortti: "S-Etukortti", maksu: "Maksu", pankki: "Pankki", mina: "Minä" };

export function TopBar({ title }: { title: string }) {
  return (
    <header className="grid shrink-0 grid-cols-[48px_1fr_48px] items-center bg-screen px-1 pt-[env(safe-area-inset-top)]">
      <span />
      <h1 className="flex min-h-14 items-center justify-center text-lg font-bold text-green-900">{title}</h1>
      <IconButton icon={MessageCircle} label="Open Vara chat" onClick={() => navigate("/vara/chat")} />
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

export function BottomNav({ tab }: { tab: TabKey }) {
  return (
    <nav aria-label="Main" className="relative z-10 flex shrink-0 items-end border-t border-line bg-card px-1 pb-[env(safe-area-inset-bottom)]">
      <NavItem tab="koti" icon={House} label="Koti" active={tab === "koti"} />
      <NavItem tab="etukortti" icon={WalletCards} label="S-Etukortti" active={tab === "etukortti"} />
      <div className="flex flex-1 flex-col items-center pb-1">
        <button
          type="button"
          aria-label="Maksu"
          aria-current={tab === "maksu" ? "page" : undefined}
          onClick={() => navigate("/maksu", { replace: true })}
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-pill bg-green-700 text-white shadow-middle transition-transform duration-200 active:scale-95"
        >
          <Plus size={28} strokeWidth={2} aria-hidden />
        </button>
        <span className={cx("text-xs", tab === "maksu" ? "font-semibold text-green-700" : "text-ink-muted")}>Maksu</span>
      </div>
      <NavItem tab="pankki" icon={Landmark} label="Pankki" active={tab === "pankki"} />
      <NavItem tab="mina" icon={CircleUserRound} label="Minä" active={tab === "mina"} />
    </nav>
  );
}

export function Shell({ tab }: { tab: TabKey }) {
  return (
    <>
      <TopBar title={TITLES[tab]} />
      <ScrollArea key={tab}>
        {tab === "koti" && <Koti />}
        {tab === "pankki" && <Pankki />}
        {tab === "mina" && <Mina />}
        {tab === "etukortti" && <Etukortti />}
        {tab === "maksu" && <Maksu />}
      </ScrollArea>
      <BottomNav tab={tab} />
    </>
  );
}
