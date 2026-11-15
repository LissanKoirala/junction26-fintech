// Push-to-talk with the browser SpeechRecognition API (webkit fallback). Hold the mic to talk, release to send;
// a quick tap toggles listening instead. Hidden where unsupported.
import { useCallback, useEffect, useRef, useState } from "react";

interface Rec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function ctor(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(lang: string, onFinal: (text: string) => void) {
  const [supported] = useState(() => !!ctor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Rec | null>(null);
  const finalText = useRef("");
  const pressedAt = useRef(0);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const start = useCallback(() => {
    const C = ctor();
    if (!C || rec.current) return;
    const r = new C();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    finalText.current = "";
    r.onresult = (e) => {
      let fin = "";
      let tmp = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else tmp += res[0].transcript;
      }
      finalText.current = fin;
      setInterim((fin + " " + tmp).trim());
    };
    r.onerror = () => {};
    r.onend = () => {
      rec.current = null;
      setListening(false);
      const t = (finalText.current || "").trim();
      setInterim("");
      if (t) onFinalRef.current(t);
    };
    try {
      r.start();
      rec.current = r;
      setListening(true);
    } catch {
      rec.current = null;
    }
  }, [lang]);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return {
    supported,
    listening,
    interim,
    toggle: () => (rec.current ? stop() : start()),
    press: (e: React.PointerEvent) => {
      e.preventDefault();
      pressedAt.current = Date.now();
      if (rec.current) stop();
      else start();
    },
    release: () => {
      // held for a while = push-to-talk: releasing sends. A quick tap keeps listening until the next tap.
      if (rec.current && Date.now() - pressedAt.current > 450) stop();
    },
  };
}
