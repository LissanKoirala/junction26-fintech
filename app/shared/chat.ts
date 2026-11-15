// Chat protocol between the browser and POST /api/chat.
// The server answers with text/event-stream; every `data:` line is one JSON-encoded ChatEvent.
// Design rule ("numbers never pass through the model"): every figure shown in a card comes straight from an
// engine or ML result attached server-side. The language model chooses WHICH card to show and writes the prose.
import type { BasketsResult, SafeToSpend, Scenario, WhatIfResult } from "./engine/api";
import type { MlAnomalies, MlHabits, MlHome, MlProfile, MlTwins, Tribe } from "./ml/typesA";
import type { MlForecast, MlRisk, MlTxGpt } from "./ml/typesB";
import type { BasketOverrides, Goal, Period, Tx } from "./types";
import type { CraveSummary } from "./crave";
import type { Lang } from "./i18n";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  cards?: CardSpec[]; // cards the assistant showed in that turn (the server summarises them for the model)
}

export interface ChatRequest {
  customerId: string;
  messages: ChatMessage[]; // full history, last one is the new user message
  locale?: string; // UI locale hint; the coach always answers in the language the user writes in
  lang?: Lang; // app language: default reply language, and the language of every server-built card text (default "en")
  overrides?: BasketOverrides;
  goal?: Goal | null;
  screen?: string; // where the chat was opened from, e.g. "today" | "whatif"
  crave?: CraveSummary | null; // Crave mode diary summary (optional), so Vara can answer from real numbers
}

/** "How I got this": shown in a drawer under every card. Filled by the server from the tool call, not by the model. */
export interface Explain {
  tool: string; // engine or model that produced the numbers
  filters: string[];
  period?: Period;
  txCount?: number;
  formula?: string;
  source?: string; // e.g. "Statistics Finland, Household Budget Survey 2022 (CC BY 4.0)"
  model?: { name: string; metric: string }; // for ML-backed cards, e.g. { name: "Early-warning model", metric: "AUC 0.91 on held-out months" }
}

interface CardBase {
  id: string;
  title?: string;
  explain?: Explain;
}

export type CardSpec = CardBase &
  (
    | {
        kind: "stat";
        label: string;
        value: number;
        unit: "eur" | "pct" | "count" | "days";
        comparison?: {
          label: string;
          deltaAbs?: number;
          deltaPct?: number | null;
          good?: boolean;
          value?: number; // the comparison period's own total (same unit as value)
          period?: Period;
        };
        caption?: string;
        // Optional chart data (server-built, never from the model): e.g. the same query per month for a sparkline.
        // The last point is the card's own period when `highlightKey` matches its key.
        series?: { key: string; label: string; value: number }[];
        seriesLabel?: string; // e.g. "Per month, last 6 months"
        highlightKey?: string;
      }
    | {
        kind: "breakdown";
        chart: "bars" | "donut" | "trend";
        unit: "eur" | "pct" | "count";
        items: { key: string; label: string; value: number; share?: number }[];
        total?: number;
        period?: Period;
      }
    | { kind: "transactions"; items: Tx[]; total: number; count: number; note?: string }
    | { kind: "baskets"; data: BasketsResult }
    | { kind: "safe_to_spend"; data: SafeToSpend }
    | { kind: "whatif"; scenario: Scenario; result: WhatIfResult } // interactive: the client re-runs the engine as sliders move
    | {
        kind: "benchmark";
        metric: string; // "Eating out per month"
        you: number;
        unit: "eur" | "pct";
        peers: { label: string; value: number; source: string }[]; // e.g. Statistics Finland 25-34, S-Pankki customers your age
        percentile?: number; // among in-bank peers
        note: string; // year, price adjustment, caveat
      }
    | { kind: "concept"; term: string; definition: string; example: string } // plain-language explainer using the user's own numbers
    | {
        kind: "action";
        action: "open_saastaja" | "set_goal" | "start_challenge" | "connect_bank" | "open_screen" | "open_crave"; // open_crave: payload { craving }
        label: string;
        description?: string;
        payload?: Record<string, unknown>;
      }
    // --- machine-learning cards (rendered by the ML UI) ---
    | { kind: "forecast"; data: MlForecast }
    | { kind: "risk"; data: MlRisk }
    | { kind: "twins"; data: MlTwins }
    | { kind: "tribe"; data: MlProfile; tribe: Tribe }
    | { kind: "anomalies"; data: MlAnomalies }
    | { kind: "habits"; data: MlHabits }
    | { kind: "home"; data: MlHome }
    | { kind: "futures"; data: MlTxGpt }
  );

export type CardKind = CardSpec["kind"];

export type ChatEvent =
  | { type: "status"; label: string } // friendly progress line while tools run: "Adding up your September taxis…"
  | { type: "text_delta"; text: string }
  | { type: "card"; card: CardSpec }
  | { type: "suggestions"; items: string[] } // 2-3 follow-up questions
  | { type: "check"; verified: boolean; unverified: string[] } // number guard: figures in the prose not found in any tool result
  | { type: "done" }
  | { type: "error"; message: string };
