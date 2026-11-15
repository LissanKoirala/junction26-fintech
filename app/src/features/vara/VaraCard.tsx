// The Vara entry card on Koti (prominent) and Pankki (compact).
import { ChevronRight } from "lucide-react";
import { navigate } from "@/lib/router";
import { money } from "@/lib/format";
import { useCustomerState } from "@/state/customer";
import { HeroCard, heroInverse, heroMuted, heroTitle, VaraAvatar } from "@/ui/hero";
import { Card, HeroFigure, Skeleton, STROKE, cx } from "@/ui/kit";
import { safeView, statusWording, useSafeToSpend } from "./useVaraData";
import { t } from "@/lib/i18n";
import { moneyParts } from "@/lib/format";

export function VaraCard({ compact }: { compact?: boolean }) {
  const cs = useCustomerState();
  const sts = useSafeToSpend();
  const open = () => navigate("/vara/today");

  if (compact)
    return (
      <Card onClick={open} label={t("Open Vara money coach")}>
        <div className="flex items-center gap-3">
          <VaraAvatar size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-title">{t("Vara money coach")}</p>
            <p className="text-sm text-ink-muted">
              {sts?.ok ? `${safeView(sts.value).title}: ${safeView(sts.value).figure != null ? money(safeView(sts.value).figure, { whole: true }) : t("Plenty of room")}` : t("Your personal economic trainer")}
            </p>
          </div>
          <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
        </div>
      </Card>
    );

  const muted = heroMuted();
  return (
    <HeroCard onClick={open} label={t("Open Vara, your personal economic trainer")}>
      <div className="flex items-center gap-2">
        <VaraAvatar size={28} inverse={heroInverse()} />
        <span className={cx("text-base font-bold", heroInverse() ? "text-white" : heroTitle())}>Vara</span>
        <span className={cx("text-sm", muted)}>· {t("your economic trainer")}</span>
        <ChevronRight size={20} strokeWidth={STROKE} className={cx("ml-auto", muted)} aria-hidden />
      </div>
      <p className={cx("mt-4 text-sm", muted)}>{sts?.ok ? safeView(sts.value).title : t("Safe to spend")}</p>
      {cs.status === "loading" || !sts ? (
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : sts.ok ? (
        <>
          {safeView(sts.value).figure != null ? (
            <HeroFigure value={moneyParts(safeView(sts.value).figure ?? 0).num} ink={heroInverse() ? "inverse" : "default"} />
          ) : (
            <p className={cx("text-3xl font-bold", heroInverse() ? "text-hero-num" : "text-ink")}>{t("Plenty of room")}</p>
          )}
          <p className={cx("mt-1 text-sm", muted)}>{statusWording(sts.value).line}</p>
        </>
      ) : (
        <p className={cx("mt-2 text-sm", muted)}>
          {cs.status === "error" ? t("Customer data could not be loaded.") : t("Vara is still working this out. Open Vara to chat in the meantime.")}
        </p>
      )}
    </HeroCard>
  );
}
