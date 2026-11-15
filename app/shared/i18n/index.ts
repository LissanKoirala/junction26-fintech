// Vara i18n. English is the source language AND the lookup key; Finnish lives in ./fi/*.ts, one file per owner.
//
//   t("Next payday {date} · in {n} days", { date, n })      a UI string, with {placeholders}
//   tn("{n} day", "{n} days", n)                           singular / plural (both forms are dictionary keys)
//   tData(reasonFromJson)                                   a string that arrives inside data (model output, engine labels):
//                                                           exact match first, then the templates in ./fi/patterns.ts
//   tr(lang).t(...)                                         server side: always pass the request's language explicitly
//
// Rules
// - Call t() at render or call time, never at module scope (module constants keep the English text; translate where shown).
// - A string that is missing from the Finnish dictionary falls back to English and is recorded: missingKeys() lists them
//   (in the browser: window.__i18nMissing()). A screen is done when that list is empty after visiting it in Finnish.
// - Numbers and amounts keep the app's existing Finnish style in both languages ("1 277,37 €"). Dates use locale().
// - The browser has one current language (setLang). The server must never rely on it: pass `lang` down.
//
// Finnish style: write it the way a Finnish banking app would, not as a translation. Informal "sinä", short sentences,
// calm, never shaming. Keep these terms the same everywhere:
//   Vara (the coach, not translated) · S-mobiili · Säästäjä
//   safe to spend = käyttövara ("Käyttövaraa sunnuntaihin asti") · payday = palkkapäivä · balance = saldo
//   below zero / overdrawn = miinuksella ("saldo käy miinuksella") · cushion, buffer = puskuri
//   Fixed musts = Kiinteät pakolliset · Surprise musts = Yllättävät pakolliset · Everyday extras = Arjen ekstrat
//   savings goal = säästötavoite · weekly check-in = viikkokatsaus · what-if = Entä jos · Today = Tänään · You = Sinä
//   early warning = ennakkovaroitus · tribe = heimo · Money Map = Rahakartta · Two Futures = Kaksi tulevaisuutta
//   habit = tapa · unusual for you = epätavallista sinulle · first home = ensiasunto · forecast = ennuste
//   Crave mode = Mielitekotila · craving = mieliteko · Crave pot = Mielitekopotti · nothing ships = mitään ei toimiteta
//   motto "Saving money, a craving at a time." = "Säästöä, mieliteko kerrallaan."
import app from "./fi/app";
import chat from "./fi/chat";
import crave from "./fi/crave";
import engine from "./fi/engine";
import ml from "./fi/ml";
import dataPatterns from "./fi/patterns";
import today from "./fi/today";

export type Lang = "en" | "fi";
export const LANGS: readonly Lang[] = ["en", "fi"];
export const LANG_NAMES: Record<Lang, string> = { en: "English", fi: "Suomi" };
export type Vars = Record<string, string | number>;
export const isLang = (x: unknown): x is Lang => x === "en" || x === "fi";

const DICT: Record<Lang, Record<string, string>> = { en: {}, fi: { ...engine, ...today, ...app, ...chat, ...ml, ...crave } };
const PATTERNS: Record<Lang, Record<string, string>> = { en: {}, fi: dataPatterns };

let current: Lang = "en";
const listeners = new Set<() => void>();
export const getLang = (): Lang => current;
export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  listeners.forEach((f) => f());
}
export function onLangChange(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}
/** BCP 47 locale for dates and weekday / month names. */
export const locale = (lang: Lang = current): string => (lang === "fi" ? "fi-FI" : "en-GB");

const missing = new Set<string>();
export const missingKeys = (): string[] => [...missing].sort();
export const clearMissing = (): void => missing.clear();

const fill = (s: string, vars?: Vars): string => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

export function t(text: string, vars?: Vars, lang: Lang = current): string {
  if (lang === "en") return fill(text, vars);
  const hit = DICT[lang][text];
  if (hit === undefined) {
    missing.add(text);
    return fill(text, vars);
  }
  return fill(hit, vars);
}

/** Singular / plural: tn("{n} day", "{n} days", 3). {n} is filled in for you. */
export function tn(one: string, other: string, n: number, vars?: Vars, lang: Lang = current): string {
  return t(Math.abs(n) === 1 ? one : other, { n, ...vars }, lang);
}

interface Pattern { re: RegExp; out: string; literal: number }
const compiled: Partial<Record<Lang, Pattern[]>> = {};
function patternsFor(lang: Lang): Pattern[] {
  return (compiled[lang] ??= Object.entries(PATTERNS[lang])
    .map(([key, out]) => {
      const src = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          return m ? `(?<${m[1]}>.+?)` : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      return { re: new RegExp(`^${src}$`), out, literal: key.replace(/\{\w+\}/g, "").length };
    })
    .sort((a, b) => b.literal - a.literal));
}

/** Translate a string that arrives as data. Captured {placeholders} are translated too when they are known words
 *  (category names and the like) and kept as they are otherwise (numbers, names). */
export function tData(text: string, lang: Lang = current): string {
  if (lang === "en" || !text) return text;
  const d = DICT[lang];
  if (d[text] !== undefined) return d[text];
  for (const p of patternsFor(lang)) {
    const m = p.re.exec(text);
    if (m) return p.out.replace(/\{(\w+)\}/g, (_, k: string) => d[m.groups?.[k] ?? ""] ?? m.groups?.[k] ?? "");
  }
  if (/[A-Za-z]{3}/.test(text)) missing.add(text);
  return text;
}

/** A translator bound to one language, for server code and for the shared engine when called with an explicit language. */
export function tr(lang: Lang) {
  return {
    lang,
    t: (text: string, vars?: Vars) => t(text, vars, lang),
    tn: (one: string, other: string, n: number, vars?: Vars) => tn(one, other, n, vars, lang),
    tData: (text: string) => tData(text, lang),
    locale: locale(lang),
  };
}
export type Translator = ReturnType<typeof tr>;
