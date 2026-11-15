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
      "Salary about 1,950 € a month, rent about 1,270 €. Dipped to -178 € in the week before the 28 Sep payday. Balance now shows 1,743.50 € but rent is due within days. Still invests about 84 € a month.",
    default: true,
  },
  {
    id: "CUST01408",
    alias: "Eetu",
    age: 18,
    area: "Vantaa",
    headline: "Lots of tiny purchases, steady saver",
    story:
      "Salary about 2,076 € a month, rent about 984 €. 306 purchases under 10 € over two years (about 1,600 € in total). Went to -395 € in Dec 2024, then built the balance up to about 14,400 €.",
  },
  {
    id: "CUST03861",
    alias: "Sara",
    age: 28,
    area: "Helsinki region",
    headline: "Invests every month while overdrawn",
    story:
      "Salary about 1,950 € a month, invests about 270 € a month, yet the balance fell from about 4,800 € to about 765 € in a year with repeated dips below zero.",
  },
  {
    id: "CUST01349",
    alias: "Leo",
    age: 23,
    area: "Helsinki region",
    headline: "One big surprise purchase",
    story: "Salary about 2,480 € a month, eats out for about 295 € a month and had one purchase of about 1,180 €.",
  },
  {
    id: "CUST00651",
    alias: "Mika",
    age: 53,
    area: "Espoo",
    headline: "Spends more than he earns",
    story:
      "Salary about 4,960 € a month. Balance fell from 10,000 € to about 723 € over two years. 35 transport purchases (about 1,578 €) in September 2026.",
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
