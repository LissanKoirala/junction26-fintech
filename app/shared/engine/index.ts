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

export * from "./api";
export { PERIOD_NAMES, monthPeriod } from "./periods";
export { kindsOf, isBasket } from "./classify";

export const engine: Engine = {
  classifyTx,
  resolvePeriod,
  querySpending,
  getBaskets,
  getRecurring,
  getSafeToSpend,
  simulateWhatIf,
  getFixedEvents,
  simulateBalance,
  getMonthly,
  getWeekSummary,
  getSpenderStats,
};
