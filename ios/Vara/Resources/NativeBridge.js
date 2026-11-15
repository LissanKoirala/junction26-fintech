/* iOS adaptations only. The hosted app owns all routes, data, calculations and UI. */
(() => {
  'use strict';
  if (window.top !== window || location.origin !== __VARA_ORIGIN_JSON__) return;
  const handler = window.webkit?.messageHandlers?.varaNative;
  if (!handler) return;
  // The deployed S-mobiili mock bypasses t() for these Finnish shell strings.
  // Keep this compatibility adapter inside iOS until the web shell is localized.
  // Touch text nodes, never innerHTML, so React's controls and handlers survive.
  if (typeof document !== 'undefined') {
    const labels = new Map(Object.entries({
      'Koti': 'Home', 'S-Etukortti': 'S-Benefit Card', 'Maksu': 'Pay',
      'Pankki': 'Bank', 'Minä': 'Me', 'Siirrä': 'Transfer',
      'Maksa lasku': 'Pay a bill', 'Skannaa': 'Scan', 'Kaikki': 'All',
      'Tilit ja kortit': 'Accounts and cards', 'Käyttötili': 'Current account',
      'Tilit': 'Accounts', 'Maksut ja e-laskut': 'Payments and e-invoices',
      'Maksa, siirrä ja hallitse e-laskuja': 'Pay, transfer and manage e-invoices',
      'Kortit': 'Cards', 'Säästä ostojen yhteydessä': 'Save when you shop',
      'Sijoitukset': 'Investments', 'Rahastot ja osakkeet': 'Funds and shares',
      'Talousvalmentaja Vara': 'Vara money trainer',
      'Bonus ja ostot': 'Bonus and purchases', 'Kuitit': 'Receipts',
      'Maksa ja siirrä': 'Pay and transfer', 'Oma siirto': 'Own transfer',
      'Skannaa viivakoodi': 'Scan barcode', 'Ladataan…': 'Loading…', 'Saldo': 'Balance'
    }));
    const originals = new WeakMap();
    let lastLanguage;
    const translate = text => {
      const trimmed = text.trim();
      const translated = labels.get(trimmed)
        ?? (/^Hei(?: .+)?!$/.test(trimmed) ? trimmed.replace(/^Hei/, 'Hi') : undefined)
        ?? (/^Tilanne /.test(trimmed) ? trimmed.replace(/^Tilanne /, 'As of ') : undefined)
        ?? (/^Saldo /.test(trimmed) ? trimmed.replace(/^Saldo /, 'Balance ') : undefined);
      return translated ? text.replace(trimmed, translated) : text;
    };
    const update = (node, key, read, write, english) => {
      const current = read();
      let entries = originals.get(node);
      if (!entries) originals.set(node, entries = new Map());
      let entry = entries.get(key);
      // React may reuse a text node for a new customer/date: retain its new source.
      if (!entry || current !== entry.rendered) entry = { source: current };
      const next = english ? translate(entry.source) : entry.source;
      entry.rendered = next;
      entries.set(key, entry);
      if (current !== next) write(next);
    };
    const synchronize = () => {
      if (!document.documentElement) return;
      const lang = document.documentElement.lang === 'fi' ? 'fi' : 'en';
      if (lang !== lastLanguage) {
        lastLanguage = lang;
        handler.postMessage({ action: 'language', lang });
      }
      const phone = document.getElementById('phone');
      // Only the bank shell has a bottom nav; leave generated shops/chat untouched.
      if (!phone?.querySelector('nav')) return;
      const walker = document.createTreeWalker(phone, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement?.closest('script, style, textarea, [contenteditable]')) continue;
        update(node, 'text', () => node.nodeValue, value => { node.nodeValue = value; }, lang === 'en');
      }
      for (const node of phone.querySelectorAll('[aria-label]')) {
        update(node, 'label', () => node.getAttribute('aria-label'), value => node.setAttribute('aria-label', value), lang === 'en');
      }
    };
    const observer = new MutationObserver(synchronize);
    observer.observe(document, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['lang', 'aria-label']
    });
    synchronize();
  }
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
