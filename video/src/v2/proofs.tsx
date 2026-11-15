/* Version 2: the honesty proofs (d6, p8). One proof per screen, big words on the left, the app showing it on the right. */
import React from "react";
import { CravePill } from "../kit";
import { At, C, Clock, E, Eo, freeUntilPayday, Icon, L, Labels, LIVE_LABEL, Mint, PhoneTake, PX, RUN, Say, Seg, SIM_LABEL, TakeLabels, useT, Whip, Win } from "./acts";
import { clip } from "./data";
import { useSpring } from "./kit";

export type ProofKind = "optin" | "pill" | "cap" | "twodays" | "release" | "sim" | "wallet" | "nocard";

/** The part of the take that proves each point (scene seconds [from, to)). */
export const proofSegs = (kind: ProofKind, from: number, to: number): Seg[] | null => {
  const d = to - from, end = clip(RUN).seconds;
  switch (kind) {
    case "optin": return [{ from, to, a: Math.max(E("typing-start"), E("submitted") - Math.max(d, 1.5)), b: E("submitted") + 0.3, maxRate: 1.5 }];
    case "pill": return [{ from, to, a: E("shop-visible") + 0.2, b: E("shop-visible") + 0.2 + d, anchor: "start", maxRate: 1 }];
    case "cap": return [{ from, to, a: E("checkout"), b: E("checkout") + d, anchor: "start", maxRate: 1 }];
    case "twodays": case "release": { const r = Eo("release") ?? Eo("pot") ?? E("pot"); return [{ from, to, a: Math.max(0, Math.min(r - 0.3, end - d)), b: Math.min(end, r - 0.3 + d), anchor: "start", maxRate: 1 }]; }
    case "sim": { const a = Eo("sim-sheet") ?? E("pay-tap") - 2; return [{ from, to, a: a + 0.1, b: Math.min(a + 0.1 + d, E("pay-tap") - 0.3), anchor: "start", maxRate: 1 }]; }
    case "wallet": case "nocard": { const a = Eo("wallet-visible") ?? E("sheet-open") + 1; const z = (Eo("simulated-pay-link") ?? a + 2) - 0.05;
      return [{ from, to, a: a + 0.04, b: Math.min(a + 0.04 + d, z), anchor: "hold", maxRate: 1 }]; }
    default: return null;
  }
};

const ProofText: React.FC<{ kind: ProofKind; at: number }> = ({ kind, at }) => {
  const k = useSpring(at, 12, 0.5);
  const icon = (name: string) => <div style={{ width: 130, height: 130, borderRadius: 130, background: C.mint, display: "grid", placeItems: "center", transform: `scale(${0.5 + 0.5 * k})`, marginBottom: 40 }}>
    <Icon name={name} size={80} color={C.deep} stroke={2.4} /></div>;
  switch (kind) {
    case "optin": return <>{icon("check")}<Say at={at} size={130}>Opt-<Mint>in.</Mint></Say><Say at={at + 0.1} size={52} color={C.heroMeta} style={{ marginTop: 20 }}>Off until she turns it on</Say></>;
    case "pill": return <><div style={{ transform: `scale(${0.5 + 0.5 * k})`, transformOrigin: "left center", opacity: Math.min(1, k * 2), marginBottom: 46 }}><CravePill scale={2.2} /></div>
      <Say at={at} size={96}>On <Mint>every</Mint> screen.</Say></>;
    case "cap": return <>{icon("shield")}<Say at={at} size={96}>Never more than</Say><Say at={at + 0.1} size={120} color={C.mint}>{freeUntilPayday()} € free</Say><Say at={at + 0.15} size={60} color={C.heroMeta} style={{ marginTop: 12 }}>until payday</Say></>;
    case "release": return <>{icon("undo")}<Say at={at} size={110}>Release<br />the <Mint>money.</Mint></Say><Say at={at + 0.1} size={52} color={C.heroMeta} style={{ marginTop: 20 }}>Buy the real thing any time</Say></>;
    case "twodays": return <>{icon("clock")}<Say at={at} size={110}>Still want it<br />in <Mint>two days?</Mint></Say></>;
    case "sim": return <>{icon("repeat")}<Say at={at} size={100}>Money movement<br /><Mint>is simulated.</Mint></Say></>;
    case "wallet": return <>{icon("card")}<Say at={at} size={100}>Stripe,<br /><Mint>test mode.</Mint></Say></>;
    case "nocard": return <>{icon("x")}<Say at={at} size={130}>No card<br /><Mint>is charged.</Mint></Say></>;
  }
};

/** A run of proofs, one per screen. `knew` optionally opens with a full line ("And she knew all along."). */
export const CraveProof: React.FC<{ c: Clock; id: string; items: { at: number; kind: ProofKind }[]; knew?: { a: number; b: number }; head?: { a: number; b: number; text: React.ReactNode } }> = ({ c, id, items, knew, head }) => {
  const end = c.end(id);
  return <>
    {knew ? <Win from={knew.a} to={knew.b}>
      <At x={960} y={370} center w={1700}><Say at={knew.a} size={150} from="scale">She knew<br /><Mint>all along.</Mint></Say></At>
    </Win> : null}
    {head ? <Win from={head.a} to={head.b}>
      <At x={960} y={350} center w={1700}><Say at={head.a} size={130} from="scale">{head.text}</Say></At>
    </Win> : null}
    {items.map((it, i) => {
      const to = items[i + 1]?.at ?? end;
      const segs = proofSegs(it.kind, it.at, to);
      return <Win key={i} from={it.at} to={to}>
        <Whip at={it.at} dir={i % 2 ? -1 : 1}>
          {segs ? <PhoneTake clipId={RUN} segs={segs} x={PX} /> : null}
          <At x={L.x} y={it.kind === "pill" ? 360 : 250} w={L.w}><ProofText kind={it.kind} at={it.at} /></At>
        </Whip>
        {segs ? <TakeLabels clipId={RUN} segs={segs} extra={["cap", "sim", "wallet", "nocard"].includes(it.kind) ? [SIM_LABEL] : []} />
          : <Labels items={[it.kind === "nocard" ? SIM_LABEL : "Live app screenshots · synthetic data", it.kind !== "nocard" ? SIM_LABEL : null]} />}
      </Win>;
    })}
  </>;
};
export const Proof = CraveProof;
void useT; void LIVE_LABEL;
