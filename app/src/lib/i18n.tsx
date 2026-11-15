// Browser side of i18n: the current language, its persistence, and small React helpers.
// Components can simply call t(); App remounts the screen tree when the language changes.
import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { getLang, isLang, missingKeys, onLangChange, setLang as setSharedLang, type Lang } from "@shared/i18n";

export { LANGS, LANG_NAMES, getLang, locale, t, tData, tn, type Lang } from "@shared/i18n";

const KEY = "vara.lang";

function apply(lang: Lang): void {
  setSharedLang(lang);
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export function setLang(lang: Lang): void {
  apply(lang);
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}

/** Call once before the first render. Order: ?lang=fi in the URL (also inside the hash), then the saved choice, then English. */
export function initLang(): void {
  let lang: Lang = "en";
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) lang = saved;
  } catch {
    /* ignore */
  }
  const fromUrl = new URLSearchParams(location.search).get("lang") ?? new URLSearchParams(location.hash.split("?")[1] ?? "").get("lang");
  if (isLang(fromUrl)) {
    setLang(fromUrl);
  } else apply(lang);
  (window as unknown as { __i18nMissing?: () => string[] }).__i18nMissing = missingKeys;
}

export function useLang(): Lang {
  return useSyncExternalStore(onLangChange, getLang, getLang);
}

/** Turns **bold** markers in a translated string into <b>. Use for sentences with one emphasised part. */
export function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>));
}
