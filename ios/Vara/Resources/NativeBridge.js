/* iOS adaptations only. The hosted app owns all routes, data, calculations and UI. */
(() => {
  'use strict';
  if (window.top !== window || location.origin !== __VARA_ORIGIN_JSON__) return;
  const handler = window.webkit?.messageHandlers?.varaNative;
  if (!handler) return;
  let active = null;
  let sequence = 0;
  class NativeSpeechRecognition {
    constructor() {
      this.lang = 'en-US';
      this.interimResults = true;
      this.continuous = true;
      this.onresult = this.onend = this.onerror = this.onstart = null;
      this.id = null;
    }
    start() {
      if (active) throw new DOMException('Recognition already running', 'InvalidStateError');
      this.id = String(++sequence);
      active = this;
      handler.postMessage({ action: 'speechStart', id: this.id, lang: this.lang });
    }
    stop() {
      if (active === this) handler.postMessage({ action: 'speechStop', id: this.id });
    }
    abort() {
      if (active !== this) return;
      handler.postMessage({ action: 'speechAbort', id: this.id });
      // Unmounting the React hook must not submit an old transcript.
      active = null;
      this.id = null;
    }
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = NativeSpeechRecognition;
  Object.defineProperty(window, '__varaNativeSpeech', { value: (event) => {
    const rec = active;
    if (!rec || rec.id !== event.id) return;
    if (event.type === 'start') rec.onstart?.({});
    if (event.type === 'result') {
      const result = { 0: { transcript: event.text, confidence: 1 }, length: 1, isFinal: !!event.final };
      rec.onresult?.({ resultIndex: 0, results: [result] });
    }
    if (event.type === 'error') rec.onerror?.({ error: event.error });
    if (event.type === 'end') {
      active = null;
      rec.id = null;
      rec.onend?.({});
    }
  }});
  // iOS has no Web Vibration API; preserve the web app's existing haptic calls.
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (pattern) => {
    const values = (Array.isArray(pattern) ? pattern : [pattern]).slice(0, 10);
    if (!values.every(n => Number.isFinite(n) && n >= 0)) return false;
    handler.postMessage({ action: 'haptic', pattern: values.map(n => Math.min(200, n)) });
    return true;
  }});
})();
