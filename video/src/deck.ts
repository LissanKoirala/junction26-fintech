import type React from "react";
import { S01Opening, S02Data, S03Insight, S13Criteria, S14Close } from "./slides/Story";
import { S04Meet, S04MeetDemo, S05Chat, S06Coach, S11Insights, S12Fit } from "./slides/Product";
import { S07CraveIdea, S08CraveLive, S09CraveHonest } from "./slides/Crave";
import { S10Models } from "./slides/Models";

export type DeckSlide = { id: string; n: number; title: string; seconds: number; component: React.FC };
// Order, ids and durations of the 14 slides. Each renders to its own numbered MP4.
// Every clip ends on a complete, still-readable frame. Narration lines are in narration.json.
// The pitch video (all 14) must stay under 5:00 and the demo video under 2:00 (scripts/finish.sh checks both).
const MEET_SECONDS = 16;
export const deck: DeckSlide[] = [
  { id: "s01-opening", n: 1, title: "Meet Aino", seconds: 15, component: S01Opening },
  { id: "s02-data", n: 2, title: "She is not alone", seconds: 23, component: S02Data },
  { id: "s03-insight", n: 3, title: "The dips are small", seconds: 20, component: S03Insight },
  { id: "s04-meet", n: 4, title: "Meet Vara", seconds: MEET_SECONDS, component: S04Meet },
  { id: "s05-chat", n: 5, title: "Chat with your money", seconds: 23, component: S05Chat },
  { id: "s06-coach", n: 6, title: "A coach that comes to you", seconds: 20, component: S06Coach },
  { id: "s07-crave-idea", n: 7, title: "Crave mode", seconds: 19, component: S07CraveIdea },
  { id: "s08-crave-live", n: 8, title: "Crave mode, live", seconds: 46, component: S08CraveLive },
  { id: "s09-crave-honest", n: 9, title: "Honest by design", seconds: 26, component: S09CraveHonest },
  { id: "s10-models", n: 10, title: "Eight models, tested honestly", seconds: 25, component: S10Models },
  { id: "s11-insights", n: 11, title: "Written up for the judges", seconds: 16, component: S11Insights },
  { id: "s12-fit", n: 12, title: "Built to fit S-mobiili", seconds: 19, component: S12Fit },
  { id: "s13-criteria", n: 13, title: "Five criteria", seconds: 18, component: S13Criteria },
  { id: "s14-close", n: 14, title: "Close", seconds: 9, component: S14Close },
];

// Rendered but not one of the 14 (no number in its file name): the demo video's first slide, slide 04 with the
// line "This is Vara, …" (narration `meet-demo`), because "So we built Vara" only follows slide 03.
// Demo video = d04-meet, 05, 07, 08, 14 (scripts/finish.sh). It keeps the footer "04 / 14", like the other demo clips.
export const extras: DeckSlide[] = [
  { id: "d04-meet", n: 4, title: "Meet Vara (demo opening)", seconds: MEET_SECONDS, component: S04MeetDemo },
];
