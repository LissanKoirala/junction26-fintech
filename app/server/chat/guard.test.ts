import { describe, expect, it } from "vitest";
import { checkProse, extractFigures } from "./guard";

describe("number guard", () => {
  it("parses fi-FI and English money and percentages", () => {
    const f = extractFigures("Käytit 224,22 € ravintoloihin, vuokra 1 277 €. You spent €1,743.50 and 22% less, about 65 euros.");
    expect(f.map((x) => [x.kind, x.value])).toEqual([
      ["eur", 224.22],
      ["eur", 1277],
      ["eur", 65],
      ["eur", 1743.5],
      ["pct", 22],
    ]);
  });
  it("accepts rounded figures from tool results and flags invented ones", () => {
    const src = [{ total: 224.22, deltaPct: -22.44, share: 0.573, rent: 1277.37 }];
    expect(checkProse("About 224 € (22% less). Rent 1 277,37 €, 57 % of spending.", src)).toEqual({ verified: true, unverified: [] });
    const bad = checkProse("You could save 1 500 € a year, 30 % of it.", src);
    expect(bad.verified).toBe(false);
    expect(bad.unverified).toEqual(["1 500 €", "30 %"]);
  });
});
