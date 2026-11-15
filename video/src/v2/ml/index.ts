/* The ML visuals for the v2 videos. Each fills a 1920×1080 frame with a transparent background, takes no props,
 * and plays its whole animation over the durationInFrames of the <Sequence> it is placed in (about 4–8 s;
 * minSeconds = the shortest length at which it still reads). Deterministic: driven only by the frame number.
 * Every number on screen comes from ml-data.json, which records its source. */
import React from "react";
import { MoneyMap3D } from "./MoneyMap3D";
import { TwoFutures } from "./TwoFutures";
import { Forecast } from "./Forecast";
import { EarlyWarning } from "./EarlyWarning";
import { Peers } from "./Peers";
import { Scorecard } from "./Scorecard";
import { DATA, num, pct } from "./common";

export { MoneyMap3D, TwoFutures, Forecast, EarlyWarning, Peers, Scorecard };

export type Visual = { id: string; component: React.FC; caption: string; model: string; status: "ships" | "experimental" | "app"; seconds: number; minSeconds: number };
export const VISUALS: Visual[] = [
  { id: "map", component: MoneyMap3D, caption: `${num(DATA.n)} customers mapped by spending: Aino is an ${DATA.aino.tribeName}`, model: "Money Map", status: "experimental", seconds: 7, minSeconds: 5 },
  { id: "futures", component: TwoFutures, caption: `Her ${DATA.nTwins} look-alikes, and the two futures they lived`, model: "Two Futures", status: "experimental", seconds: 7, minSeconds: 5.5 },
  { id: "forecast", component: Forecast, caption: "Her balance to payday, with the range 8 in 10 runs fall in", model: "Crystal ball", status: "ships", seconds: 6, minSeconds: 4.5 },
  { id: "risk", component: EarlyWarning, caption: `${pct(DATA.risk.probability)} chance of going below zero in the next ${DATA.risk.horizonDays} days, and why`, model: "Early warning", status: "ships", seconds: 6, minSeconds: 5 },
  { id: "peers", component: Peers, caption: "Aino against the typical customer her age", model: "Peer benchmarks", status: "app", seconds: 6, minSeconds: 5 },
  { id: "scorecard", component: Scorecard, caption: "Eight models tested against a baseline: two ship, six experimental", model: "Model scorecard", status: "app", seconds: 5, minSeconds: 4 },
];
export const CAPTIONS = Object.fromEntries(VISUALS.map(v => [v.id, { caption: v.caption, model: v.model, status: v.status }]));
