// A small leading icon for starter questions and suggestion chips, picked from the wording.
import {
  CalendarClock, ChartPie, CarTaxiFront, House, Layers, Link2, MessageCircleQuestionMark, PiggyBank, Receipt, SlidersHorizontal,
  Sparkles, Target, TrendingDown, Utensils, Wallet, type LucideIcon,
} from "lucide-react";

const RULES: [RegExp, LucideIcon][] = [
  [/goal|tavoite/i, Target],
  [/after payday|another account|other bank|balance drop|toinen pankki|toisen pankin|toiselle tilille|heti palkkapäivän/i, Link2],
  [/what if|what else|could i cut|free up|\d+ ?% less|entä jos|vapauttaa|karsia/i, SlidersHorizontal],
  [/could i save|save if|saving|säästä|säästö/i, PiggyBank],
  [/afford|safe to spend|onko varaa|varaa|käyttövara/i, Wallet],
  [/payday|coming up|palkkapäiv|tulossa/i, CalendarClock],
  [/rent|housing|vuokra|asumi/i, House],
  [/kind of spender|spender|kuluttaja/i, Sparkles],
  [/extras|basket|musts|ekstra|kori|pakollis/i, Layers],
  [/where did|money go|mihin rahani|rahat menivät/i, ChartPie],
  [/tax[iy]|taksi/i, CarTaxiFront],
  [/eat|restaurant|dinner|coffee|ulkona|ravintola|illalli|kahvi/i, Utensils],
  [/less|cut|vähemmän/i, TrendingDown],
  [/how much|spend|spent|paljonko|kulutin|kulut/i, Receipt],
];

export function questionIcon(q: string): LucideIcon {
  for (const [re, icon] of RULES) if (re.test(q)) return icon;
  return MessageCircleQuestionMark;
}
