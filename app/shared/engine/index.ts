// Finance engine entry point: pure TypeScript, runs in the browser and on the server.
// `import { engine } from "@shared/engine"`. One file per area; see ./api.ts for the contract.
import type { Engine } from "./api";
import { classifyTx } from "./classify";
import { resolvePeriod } from "./periods";
import { querySpending } from "./spending";
import { getBaskets } from "./baskets";
import { getRecurring } from "./recurring";
import { getSafeToSpend } from "./safeToSpend";
import { simulateWhatIf } from "./whatif";
import { getFixedEvents, simulateBalance } from "./simulate";
import { getMonthly, getWeekSummary } from "./summaries";
import { getSpenderStats } from "./stats";
import { withLang } from "./util";

export * from "./api";
export { PERIOD_NAMES, monthPeriod } from "./periods";
export { kindsOf, isBasket } from "./classify";

// Every entry point runs inside withLang(opts.lang): sentences and labels come out in that language
// (default getLang(), i.e. the browser's current language; the server always passes lang explicitly).
export const engine: Engine = {
  classifyTx,
  resolvePeriod: (asOf, name, opts) => withLang(opts?.lang, () => resolvePeriod(asOf, name)),
  querySpending: (c, q, opts) => withLang(opts?.lang, () => querySpending(c, q, opts)),
  getBaskets: (c, p, opts) => withLang(opts?.lang, () => getBaskets(c, p, opts)),
  getRecurring: (c, opts) => withLang(opts?.lang, () => getRecurring(c)),
  getSafeToSpend: (c, opts) => withLang(opts?.lang, () => getSafeToSpend(c, opts)),
  simulateWhatIf: (c, sc, opts) => withLang(opts?.lang, () => simulateWhatIf(c, sc, opts)),
  getFixedEvents,
  simulateBalance,
  getMonthly: (c, n, opts) => withLang(opts?.lang, () => getMonthly(c, n, opts)),
  getWeekSummary: (c, w, opts) => withLang(opts?.lang, () => getWeekSummary(c, w, opts)),
  getSpenderStats: (c, opts) => withLang(opts?.lang, () => getSpenderStats(c, opts)),
};
