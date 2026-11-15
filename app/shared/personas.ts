// Featured demo customers. The dataset has no names: `alias` is a made-up first name for the demo only
// and must be presented as such ("demo alias"). Any of the 5,100 customer ids can be loaded by id as well.
export interface Persona {
  id: string;
  alias: string;
  age: number;
  area: string;
  headline: string;
  story: string; // verified facts from the data, for the presenter
  default?: boolean;
}

export const PERSONAS: Persona[] = [
  {
    id: "CUST04754",
    alias: "Aino",
    age: 21,
    area: "Espoo",
    headline: "Rent takes about 65% of her pay",
    story:
      "Salary about 2,000 € a month, rent about 1,280 € (medians, last 12 months). Dipped to −178 € on 27 Sep, the day before the 28 Sep payday. Balance now shows 1,743.50 € but rent is due within days. Still invests about 83 € a month.",
    default: true,
  },
  {
    id: "CUST01408",
    alias: "Eetu",
    age: 18,
    area: "Vantaa",
    headline: "Lots of tiny purchases, steady saver",
    story:
      "Salary about 2,085 € a month, rent about 989 € (medians, last 12 months). 306 purchases under 10 € over two years (about 1,600 € in total). Went to −395 € on 9 Nov 2024, then built the balance up to about 14,400 €.",
  },
  {
    id: "CUST03861",
    alias: "Sara",
    age: 28,
    area: "Helsinki region",
    headline: "Invests every month while overdrawn",
    story:
      "Salary about 1,955 € a month, invests about 274 € a month, yet the balance fell from about 4,900 € (30 Sep 2025) to about 765 € in a year, below zero on 22 days.",
  },
  {
    id: "CUST01349",
    alias: "Leo",
    age: 23,
    area: "Helsinki region",
    headline: "One big surprise purchase",
    story: "Salary about 2,360 € a month, eats out for about 396 € a month (last 12 months) and had one purchase of about 1,180 € (Lifestyle, 8 Apr 2025).",
  },
  {
    id: "CUST00651",
    alias: "Mika",
    age: 53,
    area: "Espoo",
    headline: "Spends more than he earns",
    story:
      "Salary about 5,070 € a month (median, last 12 months). Balance fell from about 9,900 € to about 723 € over two years. 35 transport purchases (about 1,578 €) in September 2026.",
  },
  {
    id: "CUST04375",
    alias: "Oona",
    age: 25,
    area: "Espoo",
    headline: "Most of her money lives in another bank",
    story:
      "About 90% of the salary is transferred out right after payday, so only a slice of spending is visible here. The multi-bank (PSD2) story: connect the other bank for the full picture.",
  },
];

export const DEFAULT_PERSONA = PERSONAS.find((p) => p.default)!;
