// A small leading icon for starter questions and suggestion chips, picked from the wording.
import {
  CalendarClock, ChartPie, CarTaxiFront, House, Layers, Link2, MessageCircleQuestionMark, PiggyBank, Receipt, SlidersHorizontal,
  Sparkles, Target, TrendingDown, Utensils, Wallet, type LucideIcon,
} from "lucide-react";

const RULES: [RegExp, LucideIcon][] = [
  [/goal|tavoite/i, Target],
  [/after payday|another account|other bank|balance drop/i, Link2],
  [/what if|what else|could i cut|free up|\d+ ?% less/i, SlidersHorizontal],
  [/could i save|save if|saving/i, PiggyBank],
  [/afford|safe to spend|onko varaa/i, Wallet],
  [/payday|coming up/i, CalendarClock],
  [/rent|housing|vuokra/i, House],
  [/kind of spender|spender/i, Sparkles],
  [/extras|basket|musts/i, Layers],
  [/where did|money go/i, ChartPie],
  [/tax[iy]|taksi/i, CarTaxiFront],
  [/eat|restaurant|dinner|coffee/i, Utensils],
  [/less|cut/i, TrendingDown],
  [/how much|spend|spent/i, Receipt],
];

export function questionIcon(q: string): LucideIcon {
  for (const [re, icon] of RULES) if (re.test(q)) return icon;
  return MessageCircleQuestionMark;
}
