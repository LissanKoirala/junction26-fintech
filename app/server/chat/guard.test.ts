import { describe, expect, it } from "vitest";
import { checkProse, extractFigures, userNumbers } from "./guard";

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
  it("accepts amounts the user wrote in the conversation", () => {
    const tools = [{ free_until_payday: 137.12, safe_per_week: 64.03 }];
    const prose = "A 300 € trip is more than the 137 € that is free until payday.";
    expect(checkProse(prose, tools)).toEqual({ verified: false, unverified: ["300 €"] });
    const users = userNumbers(["Can I afford a 300 € weekend trip?"]);
    expect(checkProse(prose, [...tools, users])).toEqual({ verified: true, unverified: [] });
    // bare numbers and Finnish thousands also count; a number nobody wrote is still flagged
    expect(userNumbers(["Onko varaa 1 200 euron reissuun?", "what about 450"])).toEqual(expect.arrayContaining([1200, 450]));
    expect(checkProse("That leaves 520 €.", [...tools, userNumbers(["Can I afford a 300 € trip?"])]).unverified).toEqual(["520 €"]);
  });
});
