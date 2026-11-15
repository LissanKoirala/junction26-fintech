import { describe, expect, it } from "vitest";
import { capCravePrice, CRAVE_PRICE_CAP, deliveryWhen, shortenAtWord } from "./crave";

describe("deliveryWhen", () => {
  it("keeps the time and drops the promotion", () => {
    expect(deliveryWhen("Free delivery tomorrow")).toBe("Tomorrow");
    expect(deliveryWhen("Ilmainen toimitus huomenna")).toBe("Huomenna");
    expect(deliveryWhen("Delivery in 6-8 weeks")).toBe("In 6-8 weeks");
    expect(deliveryWhen("Arrives Thursday")).toBe("Thursday");
    expect(deliveryWhen("25-35 min")).toBe("25-35 min");
    expect(deliveryWhen("Delivery in 1-3 days, free over 49 €")).toBe("In 1-3 days");
    expect(deliveryWhen("Free delivery")).toBe("");
    expect(deliveryWhen(undefined)).toBe("");
  });
});

describe("shortenAtWord", () => {
  it("never cuts a word in half", () => {
    expect(shortenAtWord("Delivery in 6-8 weeks, registration handled for you", 40)).toBe("Delivery in 6-8 weeks, registration…");
    expect(shortenAtWord("Short text", 40)).toBe("Short text");
    expect(shortenAtWord("Supercalifragilisticexpialidocious", 10).length).toBeLessThanOrEqual(10);
  });
});

describe("capCravePrice", () => {
  it("leaves normal prices alone and keeps capped prices distinct, ordered and under the cap", () => {
    expect(capCravePrice(149.95)).toBe(149.95);
    expect(capCravePrice(3999)).toBe(3999);
    const cars = [75000, 89990, 110000].map(capCravePrice);
    expect(new Set(cars).size).toBe(3);
    expect(cars[0]).toBeLessThan(cars[1]);
    expect(cars[1]).toBeLessThan(cars[2]);
    for (const c of cars) expect(c).toBeLessThan(CRAVE_PRICE_CAP);
  });
});
