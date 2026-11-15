// S-Etukortti and Maksu: intentional static placeholders (these live in the real S-mobiili).
import { ArrowLeftRight, FileText, QrCode, Receipt, ShoppingBag, Smartphone, WalletCards } from "lucide-react";
import { Card, CardTitle, ConceptNotice, ListRow, Muted, Page, STROKE } from "@/ui/kit";
import { notInDemo } from "@/ui/toast";
import { t } from "@/lib/i18n";

export function Etukortti() {
  return (
    <Page>
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-green-150 text-green-900">
          <WalletCards size={32} strokeWidth={STROKE} aria-hidden />
        </span>
        <p className="text-lg font-bold text-title">S-Etukortti</p>
        <Muted>{t("Your loyalty card, Bonus and purchases live here in the real S-mobiili.")}</Muted>
      </Card>
      <Card>
        <CardTitle>{t("In S-mobiili")}</CardTitle>
        <ListRow icon={ShoppingBag} title="Bonus ja ostot" subtitle={t("Purchase breakdown for S Group stores")} chevron onClick={() => notInDemo("Bonus ja ostot")} />
        <ListRow icon={Receipt} title="Kuitit" subtitle={t("Digital receipts")} chevron onClick={() => notInDemo("Kuitit")} />
      </Card>
      <ConceptNotice />
    </Page>
  );
}

export function Maksu() {
  return (
    <Page>
      <Card>
        <CardTitle>Maksa ja siirrä</CardTitle>
        <ListRow icon={FileText} title="Maksa lasku" subtitle={t("Pay a bill")} chevron onClick={() => notInDemo("Bill payment")} />
        <ListRow icon={ArrowLeftRight} title="Oma siirto" subtitle={t("Move money between your accounts")} chevron onClick={() => notInDemo("Transfers")} />
        <ListRow icon={Smartphone} title="MobilePay" subtitle={t("Pay a friend")} chevron onClick={() => notInDemo("MobilePay")} />
        <ListRow icon={QrCode} title="Skannaa viivakoodi" subtitle={t("Scan a bill barcode")} chevron onClick={() => notInDemo("Scanning")} />
      </Card>
      <Muted className="px-1 text-center">{t("Payments are not part of this concept demo.")}</Muted>
      <ConceptNotice />
    </Page>
  );
}
