// Crave mode entry and routing.
//   #/crave            intro + craving input (opt-in on first use)
//   #/crave?q=sushi    the generated shop for that craving (deep link)
//   #/crave/pot        the Crave pot and diary
//   #/crave/lab        real-product shopping demo (separate hosted runtime)
//   #/crave/inbox      in-app order emails (?mail=id opens one)
//   #/crave/track?id=  order tracking
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Headphones, Fish, Footprints, PackageX, PiggyBank, RotateCcw, ShieldCheck, ShoppingBag, Sparkles, Volume2, VolumeX } from "lucide-react";
import { CRAVE_MOTTO } from "@shared/crave";
import { goBack, navigate, useRoute } from "@/lib/router";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { FullScreen, HeroCard, ScreenHeader, ScrollArea, VaraAvatar } from "@/ui/hero";
import { Button, Card, Chip, ConceptNotice, IconButton, inputClass, Page, STROKE } from "@/ui/kit";
import { usePrefs } from "@/state/store";
import { craveActions } from "./diary";
import { startShop, useShopSession } from "./session";
import { Hunting, ShopError, ShopFlow } from "./Shop";
import { PotView } from "./Pot";
import { InboxView, Tracking } from "./After";
import { sfx } from "./sfx";
import { craveExamples } from "./look";

function MuteToggle() {
  const [m, setM] = useState(sfx.isMuted());
  return <IconButton icon={m ? VolumeX : Volume2} label={m ? t("Sound on") : t("Sound off")} onClick={() => { sfx.setMuted(!m); setM(!m); }} />;
}

function Intro({ initial }: { initial: string }) {
  const prefs = usePrefs();
  const customerId = useStore((s) => s.customerId);
  const [text, setText] = useState(initial);
  // prefetch while the customer reads the deal, so the shop is ready when they say yes
  useEffect(() => {
    if (initial) startShop(initial, customerId);
  }, [initial, customerId]);
  const go = (q: string) => {
    const v = q.trim();
    if (!v) return;
    sfx.click();
    craveActions.consent(true);
    navigate(`/crave?q=${encodeURIComponent(v)}`, { replace: !!initial });
  };
  return (
    <FullScreen>
      <ScreenHeader title={t("Crave mode")} onBack={() => goBack("/vara/today")} right={<MuteToggle />} />
      <ScrollArea>
        <Page>
          <HeroCard label={t("Crave mode")}>
            <div className="flex items-center gap-2">
              <VaraAvatar size={28} inverse />
              <p className="text-sm font-semibold uppercase tracking-wide text-hero-num">{t("Crave mode")}</p>
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white">{t(CRAVE_MOTTO)}</h1>
            <p className="mt-2 text-hero-meta">{t("Got the urge to buy something? Get the whole thrill first: hunt for it, fill the basket, check out. Then the twist.")}</p>
          </HeroCard>

          <Card>
            <p className="text-lg font-bold text-title">{t("Real shops, real products")}</p>
            <p className="mt-1 text-sm text-ink-muted">{t("Browse StockX, Zara or Uber Eats, or paste another shop's URL to import its products.")}</p>
            <Button full className="mt-3" variant="soft" icon={ShoppingBag} iconRight={ArrowRight} onClick={() => navigate("/crave/lab")}>{t("Open Shopping Lab")}</Button>
            <p className="mt-2 text-xs text-ink-muted">{t("Separate shopping demo. Checkout builds a simulated savings pot; no money moves.")}</p>
          </Card>

          <Card>
            <p className="text-lg font-bold text-title">{t("The deal")}</p>
            <ul className="mt-2 flex flex-col gap-3">
              {[
                { icon: ShoppingBag, t: "A real-feeling shop, made on the spot", d: "Invented brands and products for whatever you crave, with photos, reviews and a full checkout." },
                { icon: PackageX, t: "Nothing ships", d: "You know it going in. The fun is in the hunt and the checkout, not in being fooled." },
                { icon: PiggyBank, t: "The money goes to your Crave pot", d: "The basket total moves to your own savings, never more than is free until payday." },
                { icon: RotateCcw, t: "Still yours, always", d: "Still want it in 48 hours? Release the money with one tap and buy it for real." },
              ].map((x) => (
                <li key={x.t} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-green-100 text-green-700"><x.icon size={20} strokeWidth={STROKE} aria-hidden /></span>
                  <span><span className="block font-semibold text-ink">{t(x.t)}</span><span className="block text-sm text-ink-muted">{t(x.d)}</span></span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <label htmlFor="crave-q" className="text-sm font-semibold text-ink-strong">{t("What are you craving?")}</label>
            <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); go(text); }}>
              <input id="crave-q" className={inputClass} value={text} maxLength={80} placeholder={t("e.g. a cosy hoodie, ramen, a new phone case")} onChange={(e) => setText(e.target.value)} />
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {craveExamples().map((x) => <Chip key={x.q} icon={x.icon} selected={text === x.q} onClick={() => { setText(x.q); sfx.click(); }}>{x.q}</Chip>)}
            </div>
            <Button full className="mt-4" iconRight={ArrowRight} disabled={!text.trim()} onClick={() => go(text)}>
              {prefs.craveConsent ? t("Open the shop") : t("I'm in, open the shop")}
            </Button>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted"><ShieldCheck size={14} strokeWidth={STROKE} className="mt-0.5 shrink-0" aria-hidden /> {t("Only the craving text is sent to the AI that builds the shop, never your name or transactions. Simulation: no money is moved.")}</p>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="soft" icon={PiggyBank} onClick={() => navigate("/crave/pot")}>{t("Crave pot")}</Button>
            <Button variant="soft" icon={Sparkles} onClick={() => navigate("/crave/inbox")}>{t("Inbox")}</Button>
          </div>
          <ConceptNotice />
        </Page>
      </ScrollArea>
    </FullScreen>
  );
}

function ShopRoute({ craving }: { craving: string }) {
  const customerId = useStore((s) => s.customerId);
  const session = useShopSession(craving, customerId);
  const [minDone, setMinDone] = useState(false);
  useEffect(() => {
    const tm = setTimeout(() => setMinDone(true), 1500); // the hunt is part of the fun, even when cached
    return () => clearTimeout(tm);
  }, [craving]);
  if (!session) return null;
  const failed = session.status === "refused" || (session.status === "error" && !session.products.length);
  const hunting = !failed && (!minDone || !session.header || !session.products.length);
  return (
    <FullScreen>
      {hunting || failed ? (
        <>
          <ScreenHeader title={t("Crave mode")} onBack={() => goBack("/vara/today")} right={<MuteToggle />} />
          {failed ? <ShopError session={session} customerId={customerId} /> : <Hunting craving={session.craving} header={minDone ? session.header : null} />}
        </>
      ) : (
        <motion.div key="shop" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ShopFlow key={session.craving} session={session} onNewCraving={() => navigate("/crave", { replace: true })} />
        </motion.div>
      )}
    </FullScreen>
  );
}

export default function CraveFlow() {
  const route = useRoute();
  const prefs = usePrefs();
  const sub = route.segments[1];
  if (sub === "pot") return <PotView />;
  if (sub === "inbox") return <InboxView />;
  if (sub === "track") return <Tracking />;
  const q = (route.query.get("q") ?? "").trim().slice(0, 80);
  if (q && prefs.craveConsent) return <ShopRoute craving={q} />;
  return <Intro key={q} initial={q} />;
}

