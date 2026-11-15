// CHAT: generative-UI conversation with Vara. Streaming text, activity line, cards from the registry,
// number-guard line, suggestion chips, push-to-talk.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Mic, RotateCcw, Square } from "lucide-react";
import { PERSONAS } from "@shared/personas";
import { actions, useStore } from "@/state/store";
import { useCustomer } from "@/state/customer";
import { Banner, Chip, STROKE } from "@/ui/kit";
import { ActivityLine, CheckLine, Composer, composerInputClass, RoundAction, UserBubble, VaraText, VaraTurn } from "@/ui/chat";
import { t, useLang } from "@/lib/i18n";
import { VaraAvatar } from "@/ui/hero";
import { CardRenderer } from "./cards/registry";
import { useChat } from "./useChat";
import { useSpeech } from "./useSpeech";
import { questionIcon } from "./questionIcon";
import type { UiMessage } from "./store";

function starters(hasHousing: boolean, sweep: boolean): string[] {
  const q = [
    t("Can I afford a 60 € dinner this weekend?"),
    t("How much did I spend on taxis in September?"),
    t("Where did my money go last month?"),
    t("What kind of spender am I?"),
  ];
  if (hasHousing) q.push(t("Is my rent too high for my income?"));
  q.push(t("How much could I save if I ate out less?"));
  if (sweep) q.unshift(t("Why does my balance drop right after payday?"));
  return q;
}

function AssistantMessage({ m, last, onAsk }: { m: UiMessage; last: boolean; onAsk: (q: string) => void }) {
  const showStatus = m.streaming && m.status;
  const waiting = m.streaming && !m.status && !m.text && !m.cards.length;
  return (
    <VaraTurn>
      {m.text && <VaraText streaming={m.streaming && !m.cards.length}>{m.text}</VaraText>}
      {m.cards.map((c) => (
        <CardRenderer key={c.id} card={c} />
      ))}
      {showStatus && <ActivityLine label={m.status!} />}
      {waiting && <ActivityLine label={t("Thinking…")} />}
      {m.error && <Banner tone="warning" title={t("Something went wrong")}>{m.error}</Banner>}
      {!m.streaming && m.check && <CheckLine verified={m.check.verified} unverified={m.check.unverified} note={m.mocked ? t("offline demo") : undefined} />}
      {last && !m.streaming && m.suggestions && m.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {m.suggestions.map((s) => (
            <Chip key={s} icon={questionIcon(s)} onClick={() => onAsk(s)} className="max-w-full !shrink py-2 text-left">{s}</Chip>
          ))}
        </div>
      )}
    </VaraTurn>
  );
}

export default function Chat() {
  const customerId = useStore((s) => s.customerId);
  const pending = useStore((s) => s.pendingQuestion);
  // the microphone listens in the app language (EN | FI switch in the header)
  const voiceLang = useLang() === "fi" ? "fi-FI" : "en-US";
  const customer = useCustomer();
  const { messages, busy, send, stop, clear } = useChat(customerId);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeech(voiceLang, (finalText) => {
    setText("");
    send(finalText);
  });

  // a question handed over from another screen (Today chips, What-if "Ask Vara")
  useEffect(() => {
    if (!pending || !customer) return;
    const q = actions.takePendingQuestion();
    if (q) send(q.text, q.screen);
  }, [pending, customer, send]);

  // when a new question is sent, bring it to the top of the view so the answer streams in below it;
  // while streaming, follow the content only if the reader is already near the bottom
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  useLayoutEffect(() => {
    if (!lastUserId) return;
    const el = document.getElementById("msg-" + lastUserId);
    const sc = scrollRef.current;
    if (el && sc) sc.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: "smooth" });
  }, [lastUserId]);
  const last = messages[messages.length - 1];
  const lastLen = last ? last.text.length + last.cards.length * 1000 + (last.suggestions?.length ?? 0) : 0;
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const el = lastUserId ? document.getElementById("msg-" + lastUserId) : null;
    if (!sc || !el) return;
    // keep following until the question would scroll out of view
    const target = Math.min(sc.scrollHeight - sc.clientHeight, el.offsetTop - 8);
    if (target > sc.scrollTop + 4) sc.scrollTo({ top: target, behavior: "smooth" });
  }, [lastLen, lastUserId]);

  // grow the textarea with its content
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(128, el.scrollHeight) + "px";
  }, [text, speech.interim]);

  const submit = () => {
    if (!text.trim() || busy) return;
    send(text);
    setText("");
  };
  const ask = (q: string) => send(q);
  const persona = PERSONAS.find((p) => p.id === customerId);
  const lastBot = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="no-scrollbar relative flex-1 overflow-y-auto overscroll-contain px-gutter pb-4 pt-1" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <VaraAvatar size={56} />
              <p className="text-xl font-bold text-title">{persona ? t("Hi {name}, I'm Vara", { name: persona.alias }) : t("Hi, I'm Vara")}</p>
              <p className="max-w-[300px] text-base text-ink-strong">
                {t("Ask me anything about your money. I'll answer with your own numbers and show you how I got them.")}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              {starters(customer?.hasHousing ?? true, customer?.hasSalarySweep ?? false).map((q) => (
                <Chip key={q} icon={questionIcon(q)} onClick={() => ask(q)} className="justify-start">{q}</Chip>
              ))}
            </div>
            <p className="text-center text-xs text-ink-muted">{t("You can write in Finnish, Swedish or English.")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} id={"msg-" + m.id} className="flex">
                  <UserBubble>{m.text}</UserBubble>
                </div>
              ) : (
                <AssistantMessage key={m.id} m={m} last={m === lastBot} onAsk={ask} />
              ),
            )}
            {!busy && (
              <div className="flex justify-center">
                <button type="button" onClick={clear} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-green-700">
                  <RotateCcw size={14} strokeWidth={STROKE} aria-hidden /> {t("New conversation")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Composer>
        <form
          className="flex min-w-0 flex-1 items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="vara-input" className="sr-only">{t("Message Vara")}</label>
          <textarea
            id="vara-input"
            ref={inputRef}
            rows={1}
            value={speech.listening ? speech.interim || text : text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={speech.listening ? t("Listening…") : t("Ask Vara…")}
            className={composerInputClass}
          />
          {speech.supported && (
            <>
              <RoundAction
                label={speech.listening ? t("Stop listening") : t("Hold to talk")}
                variant="plain"
                active={speech.listening}
                disabled={busy}
                onPointerDown={speech.press}
                onPointerUp={speech.release}
                onClick={(e) => e.detail === 0 && speech.toggle()}
              >
                <Mic size={22} strokeWidth={STROKE} aria-hidden />
              </RoundAction>
            </>
          )}
          {busy ? (
            <RoundAction label={t("Stop")} onClick={stop}>
              <Square size={16} strokeWidth={2} aria-hidden fill="currentColor" />
            </RoundAction>
          ) : (
            <RoundAction label={t("Send")} onClick={submit} disabled={!text.trim()}>
              <ArrowUp size={22} strokeWidth={2} aria-hidden />
            </RoundAction>
          )}
        </form>
      </Composer>
    </div>
  );
}
