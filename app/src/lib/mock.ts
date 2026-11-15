// Local mock of POST /api/chat (?mock=1, or when the endpoint is missing). A small intent router over the
// question; EVERY number comes from the in-browser engine, so the mock never invents figures.
import { engine, monthPeriod, type Scenario, type SpendingQuery } from "@shared/engine";
import type { CardSpec, ChatEvent, ChatRequest, Explain } from "@shared/chat";
import type { Category, CustomerData, Period } from "@shared/types";
import { money, pct, periodLabel } from "./format";
import { categoryLabel, mccLabel } from "./domain";

type Emit = (e: ChatEvent) => void;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new DOMException("aborted", "AbortError"));
    });
  });

const daysSpan = (p: Period) => Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86400000) + 1;
let cardN = 0;
const cid = () => `mock-${Date.now().toString(36)}-${cardN++}`;

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTHS_FI = ["tammi", "helmi", "maalis", "huhti", "touko", "kesä", "heinä", "elo", "syys", "loka", "marras", "joulu"];

function findPeriod(q: string, asOf: string): Period | null {
  const t = q.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (t.includes(MONTHS[i]) || t.includes(MONTHS[i].slice(0, 3) + " ") || t.includes(MONTHS_FI[i] + "kuu")) {
      const y = +asOf.slice(0, 4);
      const m = i + 1;
      const key = `${m > +asOf.slice(5, 7) ? y - 1 : y}-${String(m).padStart(2, "0")}`;
      return monthPeriod(key);
    }
  }
  if (/last month|viime kuu/.test(t)) return engine.resolvePeriod(asOf, "last_month");
  if (/this month|tässä kuussa|tämän kuun/.test(t)) return engine.resolvePeriod(asOf, "this_month");
  if (/this week|tällä viikolla/.test(t)) return engine.resolvePeriod(asOf, "this_week");
  if (/last week|viime viikolla/.test(t)) return engine.resolvePeriod(asOf, "last_week");
  if (/(this|last) year|12 months|vuo/.test(t)) return engine.resolvePeriod(asOf, "last_12_months");
  if (/3 months|three months/.test(t)) return engine.resolvePeriod(asOf, "last_3_months");
  return null;
}

const TOPICS: { re: RegExp; q: Partial<SpendingQuery>; name: string }[] = [
  { re: /tax[iy]|taksi/, q: { mccs: ["4121"] }, name: "taxis" },
  { re: /coffee|cafe|café|fast food|kahvi/, q: { mccs: ["5814"] }, name: "fast food and cafes" },
  { re: /bar|pub|beer/, q: { mccs: ["5813"] }, name: "bars and pubs" },
  { re: /grocer|food shop|supermarket|ruoka|kauppa/, q: { categories: ["Groceries"] }, name: "groceries" },
  { re: /eat(ing)? out|restaurant|dinner|lunch|ravintola/, q: { categories: ["Restaurants"] }, name: "eating out" },
  { re: /transport|bus|train|fuel|travel to work|liikenne/, q: { categories: ["Transportation"] }, name: "transport" },
  { re: /entertain|cinema|concert|movie/, q: { categories: ["Entertainment"] }, name: "entertainment" },
  { re: /health|pharmac|doctor|dentist|terveys/, q: { categories: ["Health"] }, name: "health" },
  { re: /cloth|shopping|lifestyle|vaate/, q: { categories: ["Lifestyle"] }, name: "shopping and lifestyle" },
  { re: /travel|trip|flight|hotel|matka/, q: { categories: ["Travel"] }, name: "travel" },
  { re: /home|tech|furniture|electronic/, q: { categories: ["Home & Tech"] }, name: "home and tech" },
  { re: /utilit|electric|energy|sähkö/, q: { categories: ["Utilities"] }, name: "utilities" },
];

interface Answer {
  status: string[];
  text: string;
  cards: CardSpec[];
  suggestions: string[];
}

function explainOf(tool: string, extra: Partial<Explain> = {}): Explain {
  return { tool, filters: [], ...extra };
}

function safeAnswer(c: CustomerData, req: ChatRequest, q: string): Answer {
  const s = engine.getSafeToSpend(c, { overrides: req.overrides, goal: req.goal });
  const amt = q.match(/(\d+[.,]?\d*)\s*(€|e\b|eur|euro)/i);
  const want = amt ? parseFloat(amt[1].replace(",", ".")) : null;
  let text: string;
  if (want != null) {
    const left = Math.max(0, s.week.remaining);
    text =
      want <= left
        ? `Yes, you can. After setting aside your musts until payday (${money(s.reservedTotal, { whole: true })}), you have ${money(left, { whole: true })} safe to spend for the rest of this week, so ${money(want, { whole: true })} fits with ${money(left - want, { whole: true })} to spare.`
        : `It would be a stretch right now. You have ${money(left, { whole: true })} safe to spend for the rest of this week, and ${money(want, { whole: true })} is more than that. Your balance is ${money(s.balance, { whole: true })}, but ${money(s.reservedTotal, { whole: true })} of it is already spoken for before payday on ${s.nextPayday.date.slice(8, 10)}.${s.nextPayday.date.slice(5, 7)}. A cheaper plan, or waiting until after payday, keeps your musts covered.`;
  } else {
    text = `Your balance is ${money(s.balance, { whole: true })}, but it isn't your budget: ${money(s.reservedTotal, { whole: true })} is already reserved for musts before your next payday. That leaves ${money(s.safePerWeek, { whole: true })} a week that is genuinely safe to spend.`;
  }
  return {
    status: ["Checking your balance…", "Setting aside your musts until payday…"],
    text,
    cards: [
      {
        id: cid(),
        kind: "safe_to_spend",
        data: s,
        explain: explainOf("engine.getSafeToSpend", {
          filters: s.upcoming.map((u) => `${u.label}: ${u.basis}`),
          formula: "(balance − reserved musts until payday) ÷ weeks until payday",
          period: { from: s.asOf, to: s.nextPayday.date },
        }),
      },
    ],
    suggestions: ["What's coming up before payday?", "Where did my money go this month?", "How could I free up 20 € a week?"],
  };
}

function spendingAnswer(c: CustomerData, req: ChatRequest, q: string, topic: (typeof TOPICS)[number], period: Period | null): Answer {
  let p = period ?? engine.resolvePeriod(c.asOf, "last_30_days");
  let r = engine.querySpending(c, { ...topic.q, period: p, includeTransactions: true, limit: 10, compareTo: "previous_period" }, { overrides: req.overrides });
  let widened = false;
  if (r.count === 0) {
    // nothing in the asked period: look at the last 12 months instead, and say so
    const p12 = engine.resolvePeriod(c.asOf, "last_12_months");
    const r12 = engine.querySpending(c, { ...topic.q, period: p12, includeTransactions: true, limit: 10 }, { overrides: req.overrides });
    if (r12.count > 0) {
      widened = true;
      p = p12;
      r = r12;
    }
  }
  const asked = period ?? engine.resolvePeriod(c.asOf, "last_30_days");
  const what = topic.q.mccs ? mccLabel(topic.q.mccs[0]) ?? topic.name : categoryLabel(topic.q.categories![0]);
  const cmp = r.comparison;
  let text =
    r.count === 0
      ? `I found no ${topic.name} in ${periodLabel(asked)}, nor in the last 12 months.`
      : `${widened ? `I found no ${topic.name} in ${periodLabel(asked)}. Looking wider: ` : ""}You spent ${money(r.total)} on ${topic.name} in ${periodLabel(p)}, across ${r.count} ${r.count === 1 ? "purchase" : "purchases"} (about ${money(r.average)} each).`;
  if (cmp && r.count > 0 && cmp.total > 0) text += ` That's ${cmp.deltaAbs >= 0 ? "more" : "less"} than the period before (${money(cmp.total)}).`;
  if (r.count > 0 && topic.q.mccs?.includes("4121")) text += " Taxis sit in your Everyday extras basket: easy to skip on the nights the bus works.";
  const explain = explainOf("engine.querySpending", { filters: r.filters, period: r.period, txCount: r.count, formula: "sum of matching purchases" });
  const cards: CardSpec[] = [
    {
      id: cid(),
      kind: "stat",
      label: `${what} · ${periodLabel(p)}`,
      value: r.total,
      unit: "eur",
      comparison: cmp && (cmp.total > 0 || r.total > 0) ? { label: `vs ${periodLabel(cmp.period)} (${money(cmp.total, { whole: true })})`, deltaAbs: cmp.deltaAbs, deltaPct: cmp.deltaPct, good: cmp.deltaAbs <= 0 } : undefined,
      caption: r.count ? `${r.count} ${r.count === 1 ? "purchase" : "purchases"}${daysSpan(p) > 45 ? ` · ${money(r.perMonth, { whole: true })} a month on average` : ` · about ${money(r.average, { whole: true })} each`}` : undefined,
      explain,
    },
  ];
  if (r.transactions?.length) cards.push({ id: cid(), kind: "transactions", title: `Largest ${topic.name}`, items: r.transactions, total: r.total, count: r.count, explain });
  return {
    status: [`Adding up your ${topic.name}…`],
    text,
    cards,
    suggestions: [`How much did I spend on ${topic.name} last year?`, `What if I spent 30% less on ${topic.name}?`, "Where did my money go this month?"],
  };
}

function basketsAnswer(c: CustomerData, req: ChatRequest, period: Period | null): Answer {
  const p = period ?? engine.resolvePeriod(c.asOf, /^\d{4}-\d{2}-30$/.test(c.asOf) ? "this_month" : "last_month");
  const b = engine.getBaskets(c, p, { overrides: req.overrides });
  const [fixed, surprise, extras] = b.baskets;
  const text = `In ${periodLabel(b.period)} you spent ${money(b.spending, { whole: true })}. ${money(fixed.total, { whole: true })} (${pct(fixed.share)}) went to Fixed musts like rent and groceries, ${money(surprise.total, { whole: true })} to Surprise musts, and ${money(extras.total, { whole: true })} (${pct(extras.share)}) to Everyday extras, the part that slips through your fingers.`;
  return {
    status: ["Sorting your spending into three baskets…"],
    text,
    cards: [
      {
        id: cid(),
        kind: "baskets",
        data: b,
        explain: explainOf("engine.getBaskets", { period: b.period, txCount: b.baskets.reduce((s, x) => s + x.count, 0), filters: b.overridesApplied ? [`${b.overridesApplied} of your own basket corrections applied`] : ["Vara's default basket rules"] }),
      },
    ],
    suggestions: ["What's in my Everyday extras?", "What if I cut Everyday extras by 20%?", "What kind of spender am I?"],
  };
}

function whatifAnswer(c: CustomerData, req: ChatRequest, q: string): Answer {
  const t = q.toLowerCase();
  const topic = TOPICS.find((x) => x.re.test(t));
  const pctM = t.match(/(\d{1,2})\s*%/);
  const change = -(pctM ? +pctM[1] : 25);
  let scenario: Scenario;
  if (topic?.q.mccs) scenario = { adjustments: topic.q.mccs.map((mcc) => ({ target: { mcc }, changePct: change })) };
  else if (topic?.q.categories) scenario = { adjustments: (topic.q.categories as Category[]).map((cat) => ({ target: { category: cat }, changePct: change })) };
  else if (/extras|everyday|free up|else/.test(t)) scenario = { adjustments: [{ target: { basket: "everyday" }, changePct: pctM ? change : -15 }] };
  else scenario = { adjustments: [{ target: { category: "Restaurants" as Category }, changePct: change }] };
  const eur = t.match(/(\d+)\s*(€|e\b|eur)/);
  if (/rent|housing|vuokra/.test(t)) scenario = { adjustments: [], housingChange: -(eur ? +eur[1] : 100) };
  const r = engine.simulateWhatIf(c, scenario, { overrides: req.overrides, goal: req.goal });
  const y1 = r.projections.find((p) => p.months === 12);
  const y5 = r.projections.find((p) => p.months === 60);
  const safeChange = Math.round(r.safePerWeekAfter) !== Math.round(r.safePerWeekBefore);
  const what = scenario.housingChange
    ? `If your rent were ${money(-scenario.housingChange, { whole: true })} lower`
    : `If you spent ${Math.abs(scenario.adjustments[0].changePct)}% less on ${r.perAdjustment.map((a) => a.label.replace(/\s*[-+−]\d+\s?%$/, "").toLowerCase()).join(" and ")}`;
  const text = `${what}, you'd free about ${money(r.savedMonthly, { whole: true })} a month.${safeChange ? ` Your safe-to-spend would go from ${money(r.safePerWeekBefore, { whole: true })} to ${money(r.safePerWeekAfter, { whole: true })} a week.` : ""}${y1 ? ` In a year that's ${money(y1.saved, { whole: true })}` : ""}${y5 ? ` (${money(y5.invested, { whole: true })} in five years if invested)` : ""}. ${scenario.adjustments.length ? "Move the sliders to try your own numbers." : ""}`;
  return {
    status: ["Working out your usual month…", "Running the scenario…"],
    text,
    cards: [
      {
        id: cid(),
        kind: "whatif",
        scenario,
        result: r,
        explain: explainOf("engine.simulateWhatIf", { filters: [r.basis], formula: "baseline monthly × change %; projections at 4 % annual return when invested" }),
      },
    ],
    suggestions: ["Make it a savings goal", "What else could I cut?", "Can I afford a 60 € dinner this weekend?"],
  };
}

function rentAnswer(c: CustomerData, req: ChatRequest): Answer {
  const rec = engine.getRecurring(c);
  const housing = rec.find((r) => r.kind === "housing");
  const salary = rec.find((r) => r.kind === "salary");
  const st = engine.getSpenderStats(c, { overrides: req.overrides });
  if (!housing) {
    return {
      status: ["Looking for housing payments…"],
      text: "I can't see regular rent or housing payments on this account, so I can't compare it with your income. If you pay rent from another bank, connecting it would let me see it.",
      cards: [{ id: cid(), kind: "action", action: "connect_bank", label: "Connect another bank", description: "Simulated open-banking connection" }],
      suggestions: ["Where did my money go this month?", "What kind of spender am I?"],
    };
  }
  const income = salary?.typicalAmount ?? st.monthlyIncome;
  const share = income > 0 ? housing.typicalAmount / income : null;
  const verdict = share == null ? "" : share > 0.5 ? "That's a heavy share: more than half of your pay goes to housing before anything else." : share > 0.35 ? "That's on the high side. A common rule of thumb is to keep housing near a third of take-home pay." : "That's within the common rule of thumb of about a third of take-home pay.";
  const text = `Your rent is usually about ${money(housing.typicalAmount, { whole: true })} a month and your salary about ${money(income, { whole: true })}, so housing takes ${share != null ? pct(share) : "an unknown share"} of your pay. ${verdict}`;
  return {
    status: ["Finding your rent and salary…"],
    text,
    cards: [
      {
        id: cid(),
        kind: "stat",
        label: "Housing as a share of your salary",
        value: share ?? 0,
        unit: "pct",
        caption: `${money(housing.typicalAmount, { whole: true })} rent ÷ ${money(income, { whole: true })} salary per month`,
        explain: explainOf("engine.getRecurring", { filters: [`Housing: ${housing.monthsSeen} of the last 12 months seen`, housing.note ?? ""].filter(Boolean), formula: "typical housing payment ÷ typical monthly salary" }),
      },
      {
        id: cid(),
        kind: "concept",
        term: "Housing cost ratio",
        definition: "How much of your take-home pay goes to rent or housing each month. The lower it is, the more room you have for everything else, including saving.",
        example: `${money(housing.typicalAmount, { whole: true })} of ${money(income, { whole: true })} means about ${share != null ? Math.round(share * 100) : "–"} cents of every euro you earn are spoken for by housing.`,
      },
    ],
    suggestions: ["What if my rent were 150 € lower?", "Can I afford a 60 € dinner this weekend?", "What kind of spender am I?"],
  };
}

function spenderAnswer(c: CustomerData, req: ChatRequest): Answer {
  const st = engine.getSpenderStats(c, { overrides: req.overrides });
  const items = [
    { key: "must_regular", label: "Fixed musts", value: st.basketShares.must_regular, share: st.basketShares.must_regular },
    { key: "must_irregular", label: "Surprise musts", value: st.basketShares.must_irregular, share: st.basketShares.must_irregular },
    { key: "everyday", label: "Everyday extras", value: st.basketShares.everyday, share: st.basketShares.everyday },
  ];
  const top = st.topCategories[0];
  const text = `Over the last ${st.months} months you earned about ${money(st.monthlyIncome, { whole: true })} and spent about ${money(st.monthlySpending, { whole: true })} a month. ${pct(st.basketShares.everyday)} of your spending is Everyday extras${top ? `, and your biggest category is ${top.label.toLowerCase()} at ${money(top.monthly, { whole: true })} a month` : ""}. You make about ${Math.round(st.smallPurchasesPerMonth)} small purchases (under 10 €) a month, and ${Math.round(st.weekendSharePct)}% of your extras happen Friday to Sunday.`;
  return {
    status: ["Looking at two years of your spending patterns…"],
    text,
    cards: [
      {
        id: cid(),
        kind: "breakdown",
        title: "How your spending splits",
        chart: "donut",
        unit: "pct",
        items,
        total: 1,
        explain: explainOf("engine.getSpenderStats", { filters: [`${st.months} months of history`], formula: "basket total ÷ all spending" }),
      },
      {
        id: cid(),
        kind: "breakdown",
        title: "Your top categories per month",
        chart: "bars",
        unit: "eur",
        items: st.topCategories.slice(0, 5).map((t) => ({ key: t.key, label: t.label, value: t.monthly, share: t.shareOfSpending })),
        explain: explainOf("engine.getSpenderStats", { filters: [`${st.months} months of history`], formula: "average per month" }),
      },
    ],
    suggestions: ["Where did my money go this month?", "How much could I save if I ate out less?", "Can I afford a 60 € dinner this weekend?"],
  };
}

function trendAnswer(c: CustomerData, req: ChatRequest): Answer {
  const rows = engine.getMonthly(c, 12, { overrides: req.overrides }).filter((r) => r.complete);
  const items = rows.map((r) => ({ key: r.month, label: r.month, value: r.mustRegular + r.mustIrregular + r.everyday }));
  const avg = items.reduce((s, i) => s + i.value, 0) / Math.max(1, items.length);
  return {
    status: ["Adding up month by month…"],
    text: `Here's your spending month by month. On average you spent ${money(avg, { whole: true })} a month over these ${items.length} months.`,
    cards: [{ id: cid(), kind: "breakdown", title: "Spending per month", chart: "trend", unit: "eur", items, explain: explainOf("engine.getMonthly", { filters: ["three baskets, complete months only"] }) }],
    suggestions: ["Where did my money go this month?", "What kind of spender am I?"],
  };
}

function goalAnswer(c: CustomerData, req: ChatRequest): Answer {
  const s = engine.getSafeToSpend(c, { overrides: req.overrides, goal: req.goal });
  return {
    status: ["Checking what you could set aside…"],
    text: req.goal
      ? `You're already saving for ${req.goal.name}: ${money(req.goal.monthlyContribution, { whole: true })} a month, which I reserve before working out your safe-to-spend (${money(s.safePerWeek, { whole: true })} a week right now).`
      : `A goal makes saving concrete. Pick a name, an amount and a date, and I'll work out the monthly amount and show how it changes your safe-to-spend (now ${money(s.safePerWeek, { whole: true })} a week). S-Pankki's Säästäjä can then put it aside automatically.`,
    cards: [{ id: cid(), kind: "action", action: "set_goal", label: req.goal ? "Edit your goal" : "Set a savings goal", title: "Savings goal", description: "Name, amount and date → monthly amount" }],
    suggestions: ["How much could I save if I ate out less?", "Can I afford a 60 € dinner this weekend?"],
  };
}

function sweepAnswer(c: CustomerData, req: ChatRequest): Answer {
  const p = engine.resolvePeriod(c.asOf, "last_month");
  const b = engine.getBaskets(c, p, { overrides: req.overrides });
  if (b.transfersOut <= 0) return basketsAnswer(c, req, p);
  return {
    status: ["Following the money after payday…"],
    text: `Right after payday, ${money(b.transfersOut, { whole: true })} of your ${money(b.income, { whole: true })} income moved to another account in ${periodLabel(b.period)}. That's why your balance drops so fast, and it means I only see part of your spending here. Connect your other bank and I can give you the full picture.`,
    cards: [
      { id: cid(), kind: "baskets", data: b, explain: explainOf("engine.getBaskets", { period: b.period, filters: ["Salary sweeps counted as transfers, not spending"] }) },
      { id: cid(), kind: "action", action: "connect_bank", label: "Connect another bank", title: "See the whole picture", description: "Simulated open-banking (PSD2) connection" },
    ],
    suggestions: ["Where did my money go last month?", "Can I afford a 60 € dinner this weekend?"],
  };
}

function route(c: CustomerData, req: ChatRequest, q: string): Answer {
  const t = q.toLowerCase();
  const period = findPeriod(t, c.asOf);
  if (/goal|tavoite/.test(t)) return goalAnswer(c, req);
  if (/after payday|balance drop|another account|other bank|sweep/.test(t)) return sweepAnswer(c, req);
  if (/what if|could i save|save if|less on|cut|free up|spent? \d+ ?% less|jos /.test(t)) return whatifAnswer(c, req, q);
  if (/afford|safe to spend|can i (buy|spend)|onko varaa|voinko|payday|coming up/.test(t)) return safeAnswer(c, req, q);
  if (/rent|housing|vuokra/.test(t)) return rentAnswer(c, req);
  if (/spender|kind of|personality|millainen/.test(t)) return spenderAnswer(c, req);
  if (/basket|where did|went|money go|extras|musts|kori/.test(t)) return basketsAnswer(c, req, period);
  if (/month by month|trend|over time|per month/.test(t)) return trendAnswer(c, req);
  const topic = TOPICS.find((x) => x.re.test(t));
  if (topic) return spendingAnswer(c, req, q, topic, period);
  const a = safeAnswer(c, req, q);
  a.text = `Here's where you stand this week. ${a.text} In offline demo mode I understand questions about spending, baskets, rent, affordability and what-ifs.`;
  return a;
}

export async function mockChat(req: ChatRequest, c: CustomerData | null, onEvent: Emit, signal?: AbortSignal) {
  const q = req.messages[req.messages.length - 1]?.content ?? "";
  try {
    if (!c) throw new Error("Customer data is not loaded yet.");
    let a: Answer;
    try {
      a = route(c, req, q);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onEvent({ type: "error", message: /not implemented/.test(msg) ? "Vara's calculator is being updated. Try again in a moment." : `I couldn't work that out: ${msg}` });
      onEvent({ type: "done" });
      return;
    }
    for (const s of a.status) {
      onEvent({ type: "status", label: s });
      await sleep(450, signal);
    }
    const words = a.text.split(/(\s+)/);
    for (let i = 0; i < words.length; i += 6) {
      onEvent({ type: "text_delta", text: words.slice(i, i + 6).join("") });
      await sleep(35, signal);
    }
    for (const card of a.cards) {
      await sleep(180, signal);
      onEvent({ type: "card", card });
    }
    onEvent({ type: "check", verified: true, unverified: [] });
    onEvent({ type: "suggestions", items: a.suggestions });
    onEvent({ type: "done" });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      onEvent({ type: "done" });
      return;
    }
    onEvent({ type: "error", message: (e as Error).message });
    onEvent({ type: "done" });
  }
}
