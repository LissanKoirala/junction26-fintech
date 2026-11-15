// Chat history per thread (customer and language, see useChat), kept in module memory so it survives tab switches (not persisted).
import { useSyncExternalStore } from "react";
import type { CardSpec } from "@shared/chat";
import type { Lang } from "@shared/i18n";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: CardSpec[];
  status?: string | null; // current activity line while streaming
  streaming?: boolean;
  check?: { verified: boolean; unverified: string[] };
  suggestions?: string[];
  error?: string;
  mocked?: boolean;
}

/** One conversation per customer and language: a thread written in Finnish is not shown when English is selected
 *  (and comes back when Finnish is selected again). */
export const chatThread = (customerId: string, lang: Lang) => `${customerId}|${lang}`;

const byCustomer = new Map<string, UiMessage[]>();
const listeners = new Set<() => void>();
const EMPTY: UiMessage[] = [];

export function getMessages(cid: string): UiMessage[] {
  return byCustomer.get(cid) ?? EMPTY;
}
export function setMessages(cid: string, fn: (m: UiMessage[]) => UiMessage[]) {
  byCustomer.set(cid, fn(getMessages(cid)));
  listeners.forEach((l) => l());
}
export function patchMessage(cid: string, id: string, fn: (m: UiMessage) => UiMessage) {
  setMessages(cid, (ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
}
export function useMessages(cid: string): UiMessage[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getMessages(cid),
  );
}
let n = 0;
export const newId = () => `m${Date.now().toString(36)}${(n++).toString(36)}`;
