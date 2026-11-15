/* Version 2: the acts shared by both videos. An act spans one or more scenes; its local time 0 is the start of its
 * first scene, and every moment inside it comes from the narration (audio.json) or the take's events (footage.json). */
import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { clip, ev, evOpt, facts, footage, MONTAGE_STANDIN_OFFSET, real, sentence, voOf, word, wordEnd, hasWord, v1clip } from "./data";
import { f, Plan } from "./timeline";
import credits from "./credits.json";
import {
  AINO_LABEL, At, C, Chip, clamp, Count, ease, Flash, Icon, Labels, LIVE_LABEL, Mint, PhoneBody, PhoneTake, phoneH, Say, Seg, Sfx, SIM_LABEL,
  speedLabel, Sprout, avoidOf, srcAt, resolve, Stopwatch, TakeLabels, TakeSounds, TakeVideo, useSpring, useT, Whip, Win, whenShown, BRAND_LABEL,
} from "./kit";

export const RUN = "crave-run";
export const L = { x: 130, w: 900 };      // the text column
export const PX = 1330;                   // phone centre when text is on the left
export const WALLET_LABEL = "Wallet-style pay · " + SIM_LABEL.replace("Prototype: ", "prototype: ");

/* ------------------------------------------------------------ clock */
export type Clock = ReturnType<typeof clock>;
export const clock = (plan: Plan, firstId: string) => {
  const P = (id: string) => { const s = plan.scenes.find(k => k.id === id); if (!s) throw new Error(`no scene ${id}`); return s; };
  const o = P(firstId).start;
  return {
    P, o,
    start: (id: string) => P(id).start - o,
    end: (id: string) => P(id).end - o,
    vo: (id: string) => P(id).vo - o,
    voEnd: (id: string) => P(id).voEnd - o,
    w: (id: string, sub: string) => P(id).vo + word(id, sub) - o,
    we: (id: string, sub: string) => P(id).vo + wordEnd(id, sub) - o,
    s: (id: string, sub: string) => { const k = sentence(id, sub); return { a: P(id).vo + k.start - o, b: P(id).vo + k.end - o }; },
    /** start of sentence n (0-based) of a scene; n past the end = the scene's end */
    n: (id: string, n: number) => { const v = voOf(id); return n < v.sentences.length ? P(id).vo + v.sentences[n].start - o : P(id).end - o; },
    /** end of sentence n of a scene */
    ne: (id: string, n: number) => P(id).vo + voOf(id).sentences[Math.min(n, voOf(id).sentences.length - 1)].end - o,
    has: (id: string, sub: string) => hasWord(id, sub),
    tick: (id: string) => P(id).tick! - o,
  };
};

/** An act: placed at its first scene, visuals clipped to its scenes, sounds allowed to ring on. */
export const Act: React.FC<{ plan: Plan; from: string; to: string; children: (c: Clock) => React.ReactNode; sounds?: (c: Clock) => React.ReactNode }> = ({ plan, from, to, children, sounds }) => {
  const c = clock(plan, from);
  const len = c.end(to);
  return <Sequence from={f(c.P(from).start)} layout="none">
    <Win from={0} to={len}>{children(c)}</Win>
    {sounds ? sounds(c) : null}
  </Sequence>;
};

/* ------------------------------------------------------------ the take's events */
export const E = (label: string) => ev(RUN, label);
export const Eo = (label: string) => evOpt(RUN, label);
export const shop = () => clip(RUN).shop ?? {};
export const priceNumber = () => {
  const p = shop().price ?? "";
  const m = p.replace(/\s/g, "").match(/(\d+)(?:[.,](\d+))?/);
  return m ? { v: parseFloat(`${m[1]}.${m[2] ?? "0"}`), dec: m[2] ? m[2].length : 0 } : null;
};

/* ------------------------------------------------------------ the build
 * typing → submitted → first paint → shop visible, mapped onto the narration:
 *   typing:  [tType, tSubmit)     source [typing-start − 0.2, submitted]
 *   build:   [tSubmit, tPaint)    source [submitted, build-first-paint]
 *   filling: [tPaint, tVisible)   source [build-first-paint, shop-visible]
 *   shop:    [tVisible, tEnd)     source [shop-visible, shopEnd]
 * The stopwatch shows source time − submitted: the real elapsed build time at every frame. */
export const buildSegs = (tType: number, tSubmit: number, tPaint: number, tVisible: number, tEnd: number, shopEnd: number): Seg[] => [
  { from: tType, to: tSubmit, a: Math.max(0, E("typing-start") - 0.2), b: E("submitted"), maxRate: 4 },
  { from: tSubmit, to: tPaint, a: E("submitted"), b: E("build-first-paint"), maxRate: 99, anchor: "end" },
  ...(tVisible - tPaint >= E("shop-visible") - E("build-first-paint")
    // the build fits the words at real speed: one continuous run from first paint to the scene's end (no jump back)
    ? [{ from: tPaint, to: tEnd, a: E("build-first-paint"), b: Math.max(shopEnd, E("build-first-paint") + tEnd - tPaint), maxRate: 3, anchor: "start" } as Seg]
    : [{ from: tPaint, to: tVisible, a: E("build-first-paint"), b: E("shop-visible"), maxRate: 99, anchor: "start" } as Seg,
       { from: tVisible, to: tEnd, a: E("shop-visible"), b: shopEnd, maxRate: 3, anchor: "start" } as Seg]),
];

export const CHIPS = [
  { key: "name", word: "name", icon: "spark", text: () => shop().name ? <>Name · <Mint>{shop().name}</Mint></> : <>Its name</> },
  { key: "brands", word: "brands", icon: "layers", text: () => <>Brands</> },
  { key: "products", word: "products", icon: "bag", text: () => { const n = (shop() as Record<string, unknown>).products; return typeof n === "number" ? <><Mint>{n}</Mint> products</> : <>Products</>; } },
  { key: "reviews", word: "reviews", icon: "chat", text: () => <>Reviews</> },
];

/** What the finished shop holds, from REC's data ("10 products, 10 photos"), or null. */
export const shopCounts = () => {
  const sh = shop() as Record<string, unknown>;
  const n = (k: string) => typeof sh[k] === "number" ? sh[k] as number : null;
  const notes = facts.notes ?? "";
  const p = n("products") ?? n("products_count") ?? n("product_count") ?? (+(notes.match(/(\d+) products/)?.[1] ?? 0) || null);
  const ph = n("photos") ?? n("photos_count") ?? n("photo_count") ?? (+(notes.match(/(\d+) (?:generated )?(?:product )?photos/)?.[1] ?? 0) || null);
  return p && ph ? `${p} products, ${ph} photos` : p ? `${p} products` : null;
};
/** The two true moments of the build, in real seconds after the tap. */
export const buildDone = () => E("shop-visible") - E("submitted");   // 15.2 s in the hero take (facts.json agrees)
export const buildLaps = () => {
  const open = (Eo("shop-open") ?? E("build-first-paint")) - E("submitted");
  const done = buildDone();
  return [{ label: "First product", value: open }, { label: "Shop complete", value: done }];
};

/** Whether the chat clip on screen was recorded with Gemini answering (timeline.json `model`, or credits.json). */
export const chatIsGemini = () => (credits as unknown as { coach: { footage_is_gemini?: boolean } }).coach.footage_is_gemini === true ||
  String((v1clip("chat.mp4") as unknown as { model?: string }).model ?? "").toLowerCase().startsWith("gemini");
/** The model credit (credits.json): plain type, no logo. "Built live by Gemini" over its feature. */
export type CreditKey = "build" | "coach";
export const CreditBadge: React.FC<{ which: CreditKey; at: number; x?: number; y?: number; pulseAt?: number; center?: boolean }> = ({ which, at, x = L.x, y = 36, pulseAt, center }) => {
  const k = useSpring(at, 13, 0.55);
  const t = useT();
  if (t < at) return null;
  const pt = pulseAt === undefined ? -1 : t - pulseAt;
  const pulse = pt >= 0 && pt < 0.6 ? 1 + 0.1 * Math.sin(Math.PI * pt / 0.6) : 1;
  const cr = (credits as unknown as Record<string, { lead: string; model: string; feature: string; id?: string }>)[which];
  return <div style={{ position: "absolute", left: center ? 960 : x, top: y, opacity: clamp(k * 2), transform: `${center ? "translateX(-50%) " : ""}translateY(${(1 - k) * -30}px) scale(${pulse})`, transformOrigin: "left center",
    padding: "16px 34px 20px", borderRadius: 30, border: `4px solid ${C.mint}`, background: "rgba(0,30,16,.6)", maxWidth: L.w, whiteSpace: "nowrap" }}>
    <div style={{ fontSize: 66, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1.05 }}>{cr.lead ? <>{cr.lead} </> : null}<span style={{ color: C.mint }}>{cr.model}</span></div>
    <div style={{ fontSize: 42, fontWeight: 600, color: C.heroMeta, marginTop: 6 }}>{cr.feature}</div>
    {cr.id ? <div style={{ fontSize: 28, fontWeight: 600, color: C.heroMeta, opacity: 0.8, marginTop: 4 }}>{cr.id}</div> : null}
  </div>;
};

/** Stopwatch with its laps, and chips on the words, beside the phone during the build. Chips: at most three at a time. */
export const BuildPanel: React.FC<{ c: Clock; id: string; segs: Seg[]; watchAt: number; chipsTo: number; text?: React.ReactNode; pulseAt?: number }> = ({ c, id, segs, watchAt, chipsTo, pulseAt }) => {
  const t = useT();
  const r = resolve(segs, clip(RUN).seconds, avoidOf(clip(RUN)));
  const src = srcAt(r, t);
  const real = src - E("submitted");
  const hero = buildDone();
  const chips = CHIPS.filter(k => c.has(id, k.word) && facts.shop_has[k.key] !== false).map(k => ({ ...k, at: c.w(id, k.word) - 0.05 })).sort((p, q) => p.at - q.at);
  return <>
    <CreditBadge which="build" at={watchAt} pulseAt={pulseAt} />
    <At x={L.x} y={270}><Stopwatch seconds={Math.max(0, real)} final={hero} at={watchAt} laps={buildLaps()} size={120} /></At>
    <div style={{ position: "absolute", left: L.x, top: 575, display: "flex", flexDirection: "column", gap: 26 }}>
      {chips.map((k, i) => {
        const g = Math.floor(i / 3), groupEnd = chips[(g + 1) * 3]?.at ?? chipsTo;
        return <Win key={k.key} from={k.at} to={groupEnd}><Chip at={k.at} icon={k.icon} size={42}>{k.text()}</Chip></Win>;
      })}
    </div>
    {/* the photos come from a separate image model: their own tag, away from the Gemini credit */}
    {c.has(id, "photos") ? <Win from={c.w(id, "photos") - 0.05} to={chipsTo}><PhotosTag at={c.w(id, "photos") - 0.05} /></Win> : null}
  </>;
};
const PhotosTag: React.FC<{ at: number }> = ({ at }) => {
  const k = useSpring(at, 13, 0.55);
  const [a, b] = ((credits as unknown as { photos?: string }).photos ?? "Photos · image model").split(" · ");
  return <div style={{ position: "absolute", left: 1745, top: 470, transform: `translateX(-50%) scale(${0.8 + 0.2 * k})`, opacity: clamp(k * 2), whiteSpace: "nowrap", textAlign: "center",
    padding: "10px 22px 12px", borderRadius: 22, border: "2px solid rgba(255,255,255,.45)", background: "rgba(0,0,0,.35)", color: "#fff" }}>
    <div style={{ fontSize: 34, fontWeight: 750 }}>{a}</div>{b ? <div style={{ fontSize: 26, fontWeight: 600, color: C.heroMeta }}>{b}</div> : null}
  </div>;
};
export const chipSounds = (c: Clock, id: string) => CHIPS.filter(k => c.has(id, k.word) && facts.shop_has[k.key] !== false)
  .map(k => <Sfx key={k.key} name="pop" at={c.w(id, k.word) - 0.05} volume={0.5} />);

/* ------------------------------------------------------------ the montage of three more shops */
export const MONTAGE = [
  { id: "shop-sushi", word: "sushi" },
  { id: "shop-headphones", word: "headphones" },
  { id: "shop-coat", word: "winter coat" },
];
/* Each montage clip is a fresh build: first paint, products and photos streaming in (the first seconds), a wait for
 * the stream to finish, then a slow scroll at the end. A single cut shows the build part (sped up, labelled); the
 * side-by-side shot shows the scroll at the end. Event labels are used when REC gives them. */
const montageSeg = (id: string, from: number, to: number, mode: "build" | "scroll"): Seg => {
  const m = clip(id), d = to - from;
  if (!real.footage) return { from, to, a: MONTAGE_STANDIN_OFFSET, b: MONTAGE_STANDIN_OFFSET + d, anchor: "start" };
  if (mode === "build") {
    const a = evOpt(id, "first-paint") ?? evOpt(id, "build-first-paint") ?? 0;
    let b = evOpt(id, "photos-in") ?? evOpt(id, "shop-visible") ?? Math.min(4.2, m.seconds);
    for (const [s] of avoidOf(m)) if (s > a && s < b) b = s - 0.05;          // stop short of an avoided range
    return { from, to, a, b, maxRate: 12 };
  }
  let a = evOpt(id, "scroll-start") ?? Math.max(0, m.seconds - 3.6);
  for (const [s, e] of avoidOf(m)) if (s <= a + 0.05 && e > a) a = Math.min(e + 0.05, m.seconds - 0.5);   // start after it
  return { from, to, a, b: m.seconds, maxRate: 3 };
};
const MonPhone: React.FC<{ id: string; from: number; to: number; x: number; width: number; y?: number; mode: "build" | "scroll" }> = ({ id, from, to, x, width, y, mode }) =>
  <PhoneTake clipId={id} segs={[montageSeg(id, from, to, mode)]} x={x} width={width} y={y} />;
/** "Sushi." "Headphones." "Anything." one shop each, on the cut; then all three side by side for the last line. */
export const Montage: React.FC<{ c: Clock; id: string; from: number; to: number; lastWord: string }> = ({ c, id, from, to, lastWord }) => {
  const ts = MONTAGE.map(m => c.w(id, m.word) - 0.06);
  ts[0] = Math.min(ts[0], from);
  const last = c.s(id, lastWord).a - 0.06;
  const bounds = [...ts, last];
  const fmt = (n: number) => `Built live in ${n.toFixed(1)} s`;
  // the Gemini credit and build times only over takes built by Gemini (footage.json `model`); older takes get neither
  const gem = MONTAGE.every(m => String((clip(m.id) as unknown as { model?: string }).model ?? "").toLowerCase().startsWith("gemini"));
  const secs = (k: number) => gem ? (clip(MONTAGE[k].id).build_seconds as number | undefined) ?? facts.build_seconds.others[k] : undefined;
  return <>
    {gem ? <Win from={from} to={last}><CreditBadge which="build" at={from - 1} /></Win> : null}
    {MONTAGE.map((m, k) => <Win key={m.id} from={bounds[k]} to={bounds[k + 1]}>
      <Whip at={bounds[k]} dir={k % 2 ? -1 : 1}>
        <MonPhone id={m.id} from={bounds[k]} to={bounds[k + 1]} x={PX} width={470} mode="build" />
        <At x={L.x} y={330} w={L.w}>
          <Say at={bounds[k]} size={128}>“{clip(m.id).craving ?? m.word}”</Say>
          {secs(k) ? <Say at={bounds[k] + 0.08} size={44} color={C.heroMeta} weight={600} style={{ marginTop: 30 }}>{fmt(secs(k)!)}</Say> : null}
        </At>
        <TakeLabels clipId={m.id} segs={[montageSeg(m.id, bounds[k], bounds[k + 1], "build")]} />
      </Whip>
    </Win>)}
    <Win from={last} to={to}>
      <Whip at={last}>
        {MONTAGE.map((m, k) => <MonPhone key={m.id} id={m.id} from={last} to={to} x={300 + k * 390} width={340} mode="scroll" />)}
        <At x={1270} y={380} w={600}><Say at={last} size={92}>A new shop, <Mint>every time.</Mint></Say></At>
        <TakeLabels clipId={MONTAGE[0].id} segs={[montageSeg(MONTAGE[0].id, last, to, "scroll")]} />
      </Whip>
    </Win>
  </>;
};
export const montageSounds = (c: Clock, id: string, lastWord: string) => <>
  {MONTAGE.map(m => <Sfx key={m.id} name="whoosh" at={c.w(id, m.word) - 0.12} volume={0.55} />)}
  <Sfx name="whoosh" at={c.s(id, lastWord).a - 0.12} volume={0.55} />
</>;

/* ------------------------------------------------------------ shop → pay (the hunt, basket, checkout, the pay sheet)
 * Each beat of the narration gets its part of the take; the pay sheet then plays at REAL speed, anchored so that the
 * take's tick lands on `tick` (the chime), long enough to read: from the sheet opening (or 3.2 s before the double-click
 * if the take sat on the sheet longer), through the wallet button, the double-click, the scan and the tick. */
export const paySrcStart = () => E("sheet-open") - 0.15;
export const WALLET_HOLD = 2.7;   // the wallet button on screen (≈2.1 s of take at real speed plus a hold on its first full frame)
export const SCAN_HOLD = 0.35;    // a beat on the scan, so double-click, scan and tick read as three steps
export const SHEET_IN = 1.0;      // the sheet sliding up and the app's own wallet probing, sped up
/** The pay ritual ending with the take's tick exactly on `tick` (the chime) and running on at real speed to `until`.
 *  The capture judders between 44.2 and 52.0 s, so this uses holds and cuts there, never slow motion. */
export const paySegs = (tick: number, until: number): Seg[] => {
  const wv = Eo("wallet-visible"), sim = Eo("sim-sheet") ?? Eo("simulated-pay-link"), scan = Eo("scan");
  if (wv == null || sim == null || scan == null) {   // a take without the wallet events: one real-speed stretch
    const a = Math.max(E("sheet-open") - 0.2, E("pay-tap") - 3.2), from = tick - (E("tick") - a);
    return [{ from, to: until, a, b: a + (until - from), anchor: "start", maxRate: 1 }];
  }
  const t3 = tick - (E("tick") - scan) - SCAN_HOLD;        // video second at which the scan frame appears
  const t2 = t3 - (scan - sim);                              // the simulated sheet appears (cut from the wallet frame)
  const t1 = t2 - WALLET_HOLD, t0 = t1 - SHEET_IN;
  return [
    { from: t0, to: t1, a: paySrcStart(), b: wv + 0.04, maxRate: 3 },
    { from: t1, to: t2, a: wv + 0.04, b: sim - 0.04, anchor: "hold", maxRate: 1 },
    { from: t2, to: t3, a: sim, b: scan, maxRate: 1 },
    { from: t3, to: t3 + SCAN_HOLD, a: scan, b: scan, anchor: "start", maxRate: 1 },
    { from: t3 + SCAN_HOLD, to: until, a: scan, b: scan + (until - t3 - SCAN_HOLD), anchor: "start", maxRate: 1 },
  ];
};
export const payLength = () => { const s = paySegs(100, 101); return 100 - s[0].from; };
export type HuntCuts = { hunt: number; product: number; basket: number; checkout: number; fits: number; pay: number };
export const huntSegs = (k: HuntCuts, shopFrom: number): Seg[] => [
  { from: k.hunt, to: k.product, a: shopFrom, b: E("product-open") + 0.3, maxRate: 3 },
  { from: k.product, to: k.basket, a: E("product-open") + 0.3, b: E("added") + 0.5, maxRate: 3 },
  { from: k.basket, to: k.checkout, a: E("added") + 0.5, b: E("basket") + 0.8, maxRate: 3 },
  { from: k.checkout, to: k.fits, a: E("basket") + 0.8, b: E("checkout") + 0.4, maxRate: 3 },
  { from: k.fits, to: k.pay, a: E("checkout") + 0.4, b: E("sheet-open") - 0.2, maxRate: 3, anchor: "start" },
];
/** "137 € is free until payday": read from the take's checkout text when REC gives it (the narration says 137). */
export const freeUntilPayday = () => {
  const m = String((shop() as Record<string, unknown>).payday_check ?? "").match(/(\d+)\s*(?:\u00a0)?€ is free until payday/);
  return m ? +m[1] : 137;
};
/** The checkout's "free until payday" check, said in big type: 137 € free until payday. */
export const FitsText: React.FC<{ at: number; fitsAt?: number }> = ({ at, fitsAt }) => <At x={L.x} y={300} w={L.w}>
  <Say at={at} size={210} color={C.mint}><Count at={at} to={freeUntilPayday()} dur={0.7} /> €</Say>
  <Say at={at + 0.15} size={64} style={{ marginTop: 10 }}>free until payday</Say>
  {fitsAt !== undefined ? <Say at={fitsAt} size={64} color={C.mint} style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 18 }}>
    <Icon name="check" size={70} color={C.mint} stroke={3} /> so it fits</Say> : null}
</At>;

/** The pay sheet, centred and large, then the take carries on at real speed through the tick into the reveal. */
export const PayPhone: React.FC<{ segs: Seg[]; sheetAt: number; centreAt: number; unzoomAt?: number }> = ({ segs, sheetAt, centreAt, unzoomAt }) => {
  const push: { at: number; dur: number; scale: number; origin: string; x?: number }[] = [
    { at: sheetAt, dur: 0.6, scale: 1.22, origin: "50% 96%" },
    { at: centreAt, dur: 0.55, scale: 1.42, origin: "50% 96%", x: 960 },
  ];
  if (unzoomAt !== undefined && unzoomAt > centreAt) push.push({ at: unzoomAt, dur: 0.5, scale: 1, origin: "50% 96%", x: 960 });
  return <PhoneTake clipId={RUN} segs={segs} x={PX} width={470} push={push} />;
};

/* ------------------------------------------------------------ "Nothing ships" */
export const NothingShips: React.FC<{ at: number }> = ({ at }) => {
  const k = useSpring(at, 12, 0.6);
  const t = useT();
  const strike = ease(Math.max(0, Math.min(1, (t - at - 0.25) / 0.25)));
  return <>
    <At x={960} y={250} center w={1800}>
      <div style={{ display: "inline-grid", placeItems: "center", width: 200, height: 200, borderRadius: 200, background: "rgba(145,250,155,.14)", position: "relative", transform: `scale(${0.4 + 0.6 * k})` }}>
        <Icon name="box" size={120} color={C.mint} stroke={1.8} />
        <svg width={200} height={200} style={{ position: "absolute", inset: 0 }}><path d={`M 50 50 L ${50 + 100 * strike} ${50 + 100 * strike}`} stroke={C.mint} strokeWidth={10} strokeLinecap="round" /></svg>
      </div>
      <Say at={at} size={230} from="scale" style={{ marginTop: 30 }}>Nothing <Mint>ships.</Mint></Say>
    </At>
    <Flash at={at} />
  </>;
};

/** The pot counting up beside the phone, in step with the app's own count (its `coins` event). */
export const PotCount: React.FC<{ at: number; label?: string }> = ({ at, label = "in her savings pot" }) => {
  const p = priceNumber();
  return <At x={L.x} y={330} w={L.w}>
    <Say at={at - 0.2} size={56} color={C.heroMeta} weight={700}>{label}</Say>
    {p ? <Say at={at - 0.1} size={190} color={C.mint} style={{ marginTop: 10 }}><Count at={at} to={p.v} decimals={p.dec} comma dur={1.1} group=" " /> €</Say> : null}
  </At>;
};

/* ------------------------------------------------------------ three words, one at a time */
export const Three: React.FC<{ items: { at: number; text: React.ReactNode }[]; y?: number; size?: number }> = ({ items, y = 260, size = 104 }) =>
  <At x={L.x} y={y} w={L.w}>
    {items.map((it, k) => <Say key={k} at={it.at} size={size} style={{ marginBottom: 26 }} from="left">{it.text}</Say>)}
  </At>;

/* ------------------------------------------------------------ the close */
export const Close: React.FC<{ c: Clock; id: string; addresses: string[]; hitAt: number }> = ({ c, id, addresses, hitAt }) => {
  const k = useSpring(c.vo(id), 12, 0.6);
  const t = useT();
  const push = 1 + 0.05 * Math.max(0, t - c.start(id)) / 6;   // a slow, continuous push-in to the end
  return <>
    <At x={960} y={170} center w={1800} style={{ transform: `scale(${push})`, transformOrigin: "50% 40%" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 36, transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 2) }}>
        <Sprout size={150} inverse /><span style={{ fontSize: 190, fontWeight: 800, letterSpacing: -6 }}>Vara</span>
      </div>
      <Say at={c.s(id, "craving").a} size={84} style={{ marginTop: 40 }}>Helping you save money,<br /><Mint>a craving at a time.</Mint></Say>
      {addresses.map((a, i) => <Say key={a} at={hitAt + 0.1 + i * 0.15} size={36} weight={600} color={C.heroMeta} style={{ marginTop: i ? 8 : 60 }}>{a}</Say>)}
    </At>
    <Flash at={hitAt} len={0.3} color={C.mint} />
  </>;
};
export const APP_URL = "vara-junction26.swedencentral.cloudapp.azure.com";

export { At, C, Chip, Count, ease, Flash, Icon, Labels, LIVE_LABEL, AINO_LABEL, SIM_LABEL, Mint, PhoneTake, Say, Sfx, speedLabel, TakeLabels, TakeSounds, Whip, Win, whenShown, useT, footage, PhoneBody, phoneH, TakeVideo, BRAND_LABEL, resolve };
export type { Seg };
