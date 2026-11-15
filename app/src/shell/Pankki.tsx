// Pankki: stacked white cards like the real S-mobiili bank tab, plus the Vara card.
import { ChartLine, CreditCard, FileText, PiggyBank, Wallet, type LucideIcon } from "lucide-react";
import { useCustomerState } from "@/state/customer";
import { money } from "@/lib/format";
import { navigate } from "@/lib/router";
import { Card, ConceptNotice, IconCircle, Page, Skeleton, STROKE } from "@/ui/kit";
import { notInDemo } from "@/ui/toast";
import { t } from "@/lib/i18n";
import { VaraCard } from "@/features/vara/VaraCard";
import { currentBalance } from "@/features/vara/useVaraData";
import { ChevronRight } from "lucide-react";

function BankCard({ icon, title, sub, onClick, right }: { icon: LucideIcon; title: string; sub: string; onClick: () => void; right?: React.ReactNode }) {
  return (
    <Card onClick={onClick} label={title}>
      <div className="flex items-center gap-3">
        <IconCircle icon={icon} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-title">{title}</p>
          <p className="truncate text-sm text-ink-muted">{sub}</p>
        </div>
        {right}
        <ChevronRight size={20} strokeWidth={STROKE} className="text-icon-muted" aria-hidden />
      </div>
    </Card>
  );
}

export function Pankki() {
  const cs = useCustomerState();
  const bal = cs.status === "ready" ? currentBalance(cs.data.tx) : null;
  return (
    <Page>
      <BankCard
        icon={Wallet}
        title={t("Accounts")}
        sub={t("Current account")}
        onClick={() => notInDemo("Account details")}
        right={cs.status === "ready" ? <span className="tnum font-semibold">{money(bal)}</span> : <Skeleton className="h-5 w-20" />}
      />
      <BankCard icon={FileText} title={t("Payments and e-invoices")} sub={t("Pay, transfer and manage e-invoices")} onClick={() => notInDemo("Payments")} />
      <BankCard icon={CreditCard} title={t("Cards")} sub="S-Etukortti Visa" onClick={() => notInDemo("Cards")} />
      <BankCard icon={PiggyBank} title="Säästäjä" sub={t("Save as you shop")} onClick={() => navigate("/flow/goal")} />
      <BankCard icon={ChartLine} title={t("Investments")} sub={t("Funds and shares")} onClick={() => notInDemo("Investments")} />
      <VaraCard compact />
      <ConceptNotice />
    </Page>
  );
}
