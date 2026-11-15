// Sending a message: optimistic user bubble, then stream ChatEvents into the assistant message.
import { useCallback } from "react";
import type { ChatMessage, ChatRequest } from "@shared/chat";
import { streamChat } from "@/lib/api";
import { getState } from "@/state/store";
import { useCustomer } from "@/state/customer";
import { getMessages, newId, patchMessage, setMessages, useMessages } from "./store";
import { summarise } from "@/features/crave/diary";

const controllers = new Map<string, AbortController>();

export function useChat(customerId: string) {
  const messages = useMessages(customerId);
  const customer = useCustomer();
  const busy = messages.some((m) => m.streaming);

  const send = useCallback(
    async (text: string, screen?: string) => {
      const q = text.trim();
      if (!q) return;
      if (getMessages(customerId).some((m) => m.streaming)) return;
      const history: ChatMessage[] = getMessages(customerId)
        .filter((m) => !m.error && (m.text || m.cards.length))
        .map((m) => ({ role: m.role, content: m.text, cards: m.cards.length ? m.cards : undefined }));
      const userId = newId();
      const botId = newId();
      setMessages(customerId, (ms) => [
        ...ms,
        { id: userId, role: "user", text: q, cards: [] },
        { id: botId, role: "assistant", text: "", cards: [], streaming: true, status: "Looking at your transactions…" },
      ]);
      const prefs = getState().byCustomer[customerId];
      const req: ChatRequest = {
        customerId,
        messages: [...history, { role: "user", content: q }],
        locale: getState().voiceLang === "fi-FI" ? "fi-FI" : "en-GB",
        overrides: prefs?.overrides,
        goal: prefs?.goal ?? null,
        screen: screen ?? "chat",
        crave: prefs?.cravings?.length ? summarise(prefs.cravings) : null,
      };
      const ctl = new AbortController();
      controllers.set(customerId, ctl);
      try {
        const { mocked } = await streamChat(
          req,
          customer,
          (ev) => {
            patchMessage(customerId, botId, (m) => {
              switch (ev.type) {
                case "status":
                  return { ...m, status: ev.label };
                case "text_delta":
                  return { ...m, text: m.text + ev.text, status: null };
                case "card":
                  return { ...m, cards: [...m.cards.filter((c) => c.id !== ev.card.id), ev.card], status: null };
                case "suggestions":
                  return { ...m, suggestions: ev.items };
                case "check":
                  return { ...m, check: { verified: ev.verified, unverified: ev.unverified ?? [] } };
                case "error":
                  return { ...m, error: ev.message, status: null };
                case "done":
                  return { ...m, streaming: false, status: null };
                default:
                  return m;
              }
            });
          },
          ctl.signal,
        );
        patchMessage(customerId, botId, (m) => ({ ...m, mocked }));
      } catch (e) {
        if (!ctl.signal.aborted)
          patchMessage(customerId, botId, (m) => ({ ...m, error: "Vara couldn't answer just now. Please try again.", status: null }));
      } finally {
        patchMessage(customerId, botId, (m) => ({ ...m, streaming: false, status: null }));
        controllers.delete(customerId);
      }
    },
    [customerId, customer],
  );

  const stop = useCallback(() => controllers.get(customerId)?.abort(), [customerId]);
  const clear = useCallback(() => {
    controllers.get(customerId)?.abort();
    setMessages(customerId, () => []);
  }, [customerId]);

  return { messages, busy, send, stop, clear };
}
