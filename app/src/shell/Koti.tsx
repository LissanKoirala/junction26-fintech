// Koti: believable static S-mobiili home with the real balance and the Vara card.
import { ArrowLeftRight, CreditCard, FileText, PiggyBank, QrCode, type LucideIcon } from "lucide-react";
import { PERSONAS } from "@shared/personas";
import { useCustomerState } from "@/state/customer";
import { money, dateFi } from "@/lib/format";
import { navigate } from "@/lib/router";
import { t } from "@/lib/i18n";
import { Card, CardTitle, ConceptNotice, IconCircle, ListRow, Page, Skeleton, Muted, STROKE, TextLink } from "@/ui/kit";
import { notInDemo } from "@/ui/toast";
import { VaraCard } from "@/features/vara/VaraCard";
import { currentBalance } from "@/features/vara/useVaraData";
import { usePrefs } from "@/state/store";

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-card text-green-900 shadow-app-card">
        <Icon size={24} strokeWidth={STROKE} aria-hidden />
      </span>
      <span className="text-xs leading-tight text-ink-strong">{label}</span>
    </button>
  );
}

export function greeting(id: string) {
  const p = PERSONAS.find((x) => x.id === id);
  return p ? t("Hi {name}!", { name: p.alias }) : t("Hi!");
}

export function Koti() {
  const cs = useCustomerState();
  const prefs = usePrefs();
  const bal = cs.status === "ready" ? currentBalance(cs.data.tx) : null;
  return (
    <Page>
      <div className="px-1 pt-1">
        <p className="text-2xl font-bold text-green-900">{greeting(cs.id)}</p>
        <Muted>
          {cs.status === "ready" ? t("As of {date}", { date: dateFi(cs.data.asOf) }) : t("Loading…")} · {cs.id} <span className="text-ink-muted">({t("demo customer")})</span>
        </Muted>
      </div>

      <div className="flex gap-2 py-2">
        <QuickAction icon={ArrowLeftRight} label={t("Transfer")} onClick={() => notInDemo("Transfers")} />
        <QuickAction icon={FileText} label={t("Pay a bill")} onClick={() => notInDemo("Bill payment")} />
        <QuickAction icon={QrCode} label={t("Scan")} onClick={() => notInDemo("Scanning")} />
        <QuickAction icon={PiggyBank} label="Säästäjä" onClick={() => navigate("/flow/goal")} />
      </div>

      <VaraCard />

      <Card>
        <CardTitle right={<TextLink onClick={() => navigate("/pankki", { replace: true })}>{t("All")}</TextLink>}>{t("Accounts and cards")}</CardTitle>
        <ListRow
          leading={<IconCircle icon={PiggyBank} />}
          title={t("Current account")}
          subtitle={cs.status === "ready" ? t("Balance {date}", { date: dateFi(cs.data.asOf) }) : t("Balance")}
          right={cs.status === "ready" ? money(bal) : cs.status === "error" ? "–" : <Skeleton className="h-5 w-24" />}
        />
        {prefs.bank && (
          <ListRow
            leading={<IconCircle icon={PiggyBank} tone="sunken" />}
            title={t("{bank} (simulated)", { bank: t(prefs.bank.bankName) })}
            subtitle={t("Connected via open banking · demo")}
            right={<span className="text-sm font-normal text-ink-muted">{t("Simulated")}</span>}
          />
        )}
        <ListRow leading={<IconCircle icon={CreditCard} />} title="S-Etukortti Visa" subtitle={t("Debit and credit")}chevron onClick={() => notInDemo("Card settings")} />
      </Card>

      <ConceptNotice />
    </Page>
  );
}
