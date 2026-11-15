// Weekly check-in as full-screen swipeable stories (tap left/right, swipe, keyboard arrows).
import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Layers, Lightbulb, PartyPopper, Repeat, Search, Sunrise, Trophy, type LucideIcon } from "lucide-react";
import type { CheckInSlide } from "@shared/checkin";
import type { CheckIn } from "@shared/checkin";
import type { CardSpec } from "@shared/chat";
import { fetchCheckin } from "@/lib/api";
import { goBack, navigate } from "@/lib/router";
import { useCustomer } from "@/state/customer";
import { actions, useStore, usePrefs } from "@/state/store";
import { safe } from "@/lib/safeEngine";
import { money, num } from "@/lib/format";
import { VaraAvatar } from "@/ui/hero";
import { StoryCard, StoryClose, StorySegments, StorySurface, StoryText } from "@/ui/story";
import { Button, IconHero, Skeleton, STROKE, Unavailable } from "@/ui/kit";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { rich, t } from "@/lib/i18n";

const CardRenderer = lazy(() =>
  import("@/features/chat/cards/registry").then((m) => ({
    default: ((m as Record<string, unknown>).CardRenderer ?? (() => null)) as ComponentType<{ card: CardSpec }>,
  })),
);

const KIND_ICON: Record<CheckInSlide["kind"], LucideIcon> = {
  recap: CalendarDays, baskets: Layers, unusual: Search, habit: Repeat, lesson: Lightbulb, outlook: Sunrise, challenge: Trophy,
};

export default function CheckInStories() {
  const c = useCustomer();
  const id = useStore((s) => s.customerId);
  const prefs = usePrefs();
  const [data, setData] = useState<{ ci: CheckIn; mocked: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!c) return;
    let alive = true;
    fetchCheckin(id, c).then(
      (r) => alive && setData({ ci: r.data, mocked: r.mocked }),
      (e: Error) => {
        // the mock itself depends on the engine; show a plain message if it cannot run
        const res = safe(() => {
          throw e;
        });
        alive && setErr(res.ok ? null : res.notImplemented ? t("Vara's calculator is being updated. Try again in a moment.") : e.message);
      },
    );
    return () => {
      alive = false;
    };
  }, [c, id]);

  const n = data?.ci.slides.length ?? 0;
  const go = useCallback(
    (d: number) => {
      setDir(d);
      setI((x) => Math.max(0, Math.min(n - 1, x + d)));
    },
    [n],
  );
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") goBack("/vara/today");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go]);

  const close = () => goBack("/vara/today");
  const slide = data?.ci.slides[i];
  const isLast = i === n - 1;
  const already = prefs.challenge?.id === data?.ci.challenge.id;

  return (
    <StorySurface>
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex-1">{n > 0 && <StorySegments count={n} index={i} label={t("Slide {i} of {n}", { i: i + 1, n })} />}</div>
        <StoryClose onClick={close} />
      </div>
      {data?.mocked && <p className="px-4 text-xs text-hero-meta/70">{t("Generated in your browser from your transactions (offline mode)")}</p>}

      {err ? (
        <div className="p-4">
          <Unavailable title={t("Your check-in isn't ready yet")} reason={err} action={<Button size="sm" onClick={close}>{t("Back to Today")}</Button>} />
        </div>
      ) : !data || !slide ? (
        <div className="flex flex-col gap-3 p-6 pt-10" aria-busy="true">
          <p className="mb-2 flex items-center gap-2 text-hero-meta"><VaraAvatar size={28} inverse /> {t("Vara is looking back at your week…")}</p>
          <Skeleton className="h-4 w-24 opacity-30" />
          <Skeleton className="h-10 w-4/5 opacity-30" />
          <Skeleton className="h-5 w-full opacity-30" />
        </div>
      ) : accepted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
            <IconHero icon={PartyPopper} tone="hero" />
          </motion.span>
          <h2 className="text-3xl font-bold text-hero-num">{t("Challenge accepted")}</h2>
          <p className="text-lg text-hero-meta">{t("You'll see your progress on Today. Small steps count, and every week is a fresh start.")}</p>
          <Button variant="soft" onClick={() => navigate("/vara/today", { replace: true })}>{t("See it on Today")}</Button>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col">
          {/* tap zones */}
          <button type="button" className="sr-only focus:not-sr-only" onClick={() => go(-1)}>{t("Previous slide")}</button>
          {!isLast && <button type="button" className="sr-only focus:not-sr-only" onClick={() => go(1)}>{t("Next slide")}</button>}
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={slide.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.24 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button, a, input, [role=dialog]")) return;
                const r = e.currentTarget.getBoundingClientRect();
                if (e.clientX - r.left < r.width * 0.3) go(-1);
                else if (!isLast) go(1);
              }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(1);
                else if (info.offset.x > 60) go(-1);
              }}
              className="no-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8 pt-8"
            >
              <StoryText eyebrow={slide.eyebrow} title={slide.title} body={slide.body} icon={KIND_ICON[slide.kind]} />
              {slide.card && (
                <div className="text-ink">
                  <ErrorBoundary label="This card">
                    <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                      <CardRenderer card={slide.card} />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              )}
              {slide.kind === "challenge" && (
                <div className="mt-auto flex flex-col gap-3">
                  <StoryCard>
                    <div className="flex items-center gap-3">
                      <Trophy size={28} strokeWidth={STROKE} className="text-green-700" aria-hidden />
                      <div className="tnum text-sm">
                        <p>
                          {rich(
                            t("Target **{target}** · usual {usual}", {
                              target: data.ci.challenge.metric.unit === "eur" ? money(data.ci.challenge.target, { whole: true }) : num(data.ci.challenge.target),
                              usual: data.ci.challenge.metric.unit === "eur" ? money(data.ci.challenge.baseline, { whole: true }) : num(data.ci.challenge.baseline),
                            }),
                          )}
                        </p>
                        <p className="text-ink-muted">{t("Could free about {v} a month", { v: money(data.ci.challenge.potentialMonthlySaving, { whole: true }) })}</p>
                      </div>
                    </div>
                  </StoryCard>
                  {already ? (
                    <Button variant="soft" full onClick={close}>{t("Already accepted · back to Today")}</Button>
                  ) : (
                    <Button
                      variant="soft"
                      full
                      onClick={() => {
                        actions.acceptChallenge(data.ci.challenge, data.ci.asOf);
                        setAccepted(true);
                      }}
                    >
                      {t("Accept challenge")}
                    </Button>
                  )}
                  <Button variant="ghost" full className="text-white hover:bg-white/10" onClick={close}>
                    {t("Maybe later")}
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </StorySurface>
  );
}
