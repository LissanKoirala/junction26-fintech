import type { Product, ShopId } from './shop-contract';

// Real product facts cached from official public pages. Sizes are explicitly simulated.
// FetchedAt records research retrieval time; source pages may be older cached crawls.
export const CATALOGUE_VERSION = '2026-11-15.2';

export const catalogue: Product[] = [
  {
    "id": "food-chicken-breast",
    "store": "ubereats",
    "name": "Chicken Breast Sandwich",
    "brand": "Supermac’s",
    "category": "Burgers",
    "price": 795,
    "image": "/products/food-chicken-breast.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "food-beef-5oz",
    "store": "ubereats",
    "name": "Supermac's 5oz Burger",
    "brand": "Supermac’s",
    "category": "Burgers",
    "price": 795,
    "image": "/products/food-beef-5oz.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "food-mighty-mac",
    "store": "ubereats",
    "name": "Mighty Mac Burger",
    "brand": "Supermac’s",
    "category": "Burgers",
    "price": 625,
    "image": "/products/food-mighty-mac.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "food-veggie-burger",
    "store": "ubereats",
    "name": "Veggie Burger",
    "brand": "Supermac’s",
    "category": "Burgers",
    "price": 675,
    "image": "/products/food-veggie-burger.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "food-fries",
    "store": "ubereats",
    "name": "Fries",
    "brand": "Supermac’s",
    "category": "Sides",
    "price": 295,
    "image": "/products/food-fries.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "food-taco-fries",
    "store": "ubereats",
    "name": "Taco Fries",
    "brand": "Supermac’s",
    "category": "Sides",
    "price": 575,
    "image": "/products/food-taco-fries.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "food-chocolate-shake",
    "store": "ubereats",
    "name": "Chocolate Milkshake",
    "brand": "Supermac’s",
    "category": "Drinks",
    "price": 395,
    "image": "/products/food-chocolate-shake.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "food-margherita",
    "store": "ubereats",
    "name": "Margherita Pizza",
    "brand": "Supermac’s",
    "category": "Pizza",
    "price": 1195,
    "image": "/products/food-margherita.webp",
    "sourceUrl": "https://order.supermacs.ie/menu/burgers",
    "description": "Real item from Supermac’s Headford Road, Galway collection menu. Regular is a simulated selection. No live stock or delivery quote is checked.",
    "sizes": [
      "Regular"
    ],
    "priceNote": "Galway collection menu · from price",
    "priceKind": "from",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "stockx-panda",
    "store": "stockx",
    "name": "Nike Dunk Low Retro White Black Panda",
    "brand": "Nike",
    "category": "Lifestyle",
    "price": 5200,
    "image": "/products/stockx-panda.webp",
    "sourceUrl": "https://stockx.com/de-de/nike-dunk-low-retro-white-black-2021",
    "description": "Real StockX listing · DD1391-100. EU size choices are simulated. The price is a cached all-size starting ask. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "White/Black"
    ],
    "priceNote": "Cached Germany ask · all sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "stockx-af1",
    "store": "stockx",
    "name": "Nike Air Force 1 Low '07 White",
    "brand": "Nike",
    "category": "Lifestyle",
    "price": 7800,
    "image": "/products/stockx-af1.webp",
    "sourceUrl": "https://stockx.com/de-de/nike-air-force-1-low-white-07",
    "description": "Real StockX listing · 315122-111/CW2288-111. EU size choices are simulated. The price is a cached all-size starting ask. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "White/White"
    ],
    "priceNote": "Cached Germany ask · all sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "stockx-samba",
    "store": "stockx",
    "name": "adidas Samba OG Cloud White Core Black",
    "brand": "adidas",
    "category": "Lifestyle",
    "price": 3600,
    "image": "/products/stockx-samba.webp",
    "sourceUrl": "https://stockx.com/fr-fr/adidas-samba-og-cloud-white-core-black",
    "description": "Real StockX listing · BZ0057/B75806. EU size choices are simulated. The price is a cached all-size starting ask. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "Cloud White/Core Black"
    ],
    "priceNote": "Cached France ask · all sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T02:00:33Z"
  },
  {
    "id": "stockx-campus",
    "store": "stockx",
    "name": "adidas Campus 00s Core Black",
    "brand": "adidas",
    "category": "Lifestyle",
    "price": 2500,
    "image": "/products/stockx-campus.webp",
    "sourceUrl": "https://stockx.com/fr-fr/adidas-campus-00s-core-black",
    "description": "Real StockX listing · HQ8708. EU size choices are simulated. The price is a cached all-size starting ask. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "Core Black"
    ],
    "priceNote": "Cached France ask · all sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T02:00:33Z"
  },
  {
    "id": "stockx-nb550",
    "store": "stockx",
    "name": "New Balance 550 White Green",
    "brand": "New Balance",
    "category": "Lifestyle",
    "price": 5000,
    "image": "/products/stockx-nb550.webp",
    "sourceUrl": "https://stockx.com/es-es/new-balance-550-white-green",
    "description": "Real StockX listing · BB550WT1. EU size choices are simulated. The price is a cached all-size starting ask. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "White/Green"
    ],
    "priceNote": "Cached Spain ask · all sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T02:00:33Z"
  },
  {
    "id": "stockx-asics1130",
    "store": "stockx",
    "name": "ASICS Gel-1130 White Clay Canyon",
    "brand": "ASICS",
    "category": "Lifestyle",
    "price": 12500,
    "image": "/products/stockx-asics1130.webp",
    "sourceUrl": "https://stockx.com/asics-gel-1130-white-clay-canyon",
    "description": "Real StockX listing · 1201A256-113. EU size choices are simulated. The price is a demo estimate. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "White/Clay Canyon"
    ],
    "priceNote": "Demo price",
    "priceKind": "estimate",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "stockx-j4",
    "store": "stockx",
    "name": "Jordan 4 Retro Military Blue (2024)",
    "brand": "Jordan",
    "category": "Basketball",
    "price": 14800,
    "image": "/products/stockx-j4.webp",
    "sourceUrl": "https://stockx.com/de-de/air-jordan-4-retro-military-blue-2024",
    "description": "Real StockX listing · FV5029-141. EU size choices are simulated. The price is a cached all-size starting ask. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "Off-White/Military Blue/Neutral Grey"
    ],
    "priceNote": "Cached Germany ask · all sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "stockx-mocha",
    "store": "stockx",
    "name": "Jordan 1 Retro Low OG Mocha",
    "brand": "Jordan",
    "category": "Lifestyle",
    "price": 18000,
    "image": "/products/stockx-mocha.webp",
    "sourceUrl": "https://stockx.com/air-jordan-1-retro-low-og-mocha",
    "description": "Real StockX listing · CZ0790-102. EU size choices are simulated. The price is a demo estimate. No live stock is checked.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "colors": [
      "Mocha"
    ],
    "priceNote": "Demo price",
    "priceKind": "estimate",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-4772-246-251",
    "store": "zara",
    "name": "Playsuit With Shoulder Pads",
    "brand": "Zara",
    "category": "Playsuits",
    "price": 4595,
    "image": "/products/zara-4772-246-251.webp",
    "sourceUrl": "https://www.zara.com/ie/en/shoulder-pad-playsuit-p04772246.html",
    "description": "Real Zara Ireland product in oyster-white. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Oyster-white"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-4772-253-600",
    "store": "zara",
    "name": "Velvet Halter Dress",
    "brand": "Zara",
    "category": "Dresses",
    "price": 3595,
    "image": "/products/zara-4772-253-600.webp",
    "sourceUrl": "https://www.zara.com/ie/en/velvet-halter-dress-p04772253.html",
    "description": "Real Zara Ireland product in red. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Red"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-4764-206-800",
    "store": "zara",
    "name": "Satin Midi Dress With Rhinestone Frog Fastening",
    "brand": "Zara",
    "category": "Dresses",
    "price": 4595,
    "image": "/products/zara-4764-206-800.webp",
    "sourceUrl": "https://www.zara.com/ie/en/satin-midi-dress-with-frog-fastening-and-rhinestones-p04764206.html",
    "description": "Real Zara Ireland product in black. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-4661-304-800",
    "store": "zara",
    "name": "Midi Dress With Draped Detail",
    "brand": "Zara",
    "category": "Dresses",
    "price": 3995,
    "image": "/products/zara-4661-304-800.webp",
    "sourceUrl": "https://www.zara.com/ie/en/midi-dress-with-draped-detail-p04661304.html",
    "description": "Real Zara Ireland product in black. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-0085-813-409",
    "store": "zara",
    "name": "Flocked Halter Neck Long Dress",
    "brand": "Zara",
    "category": "Dresses",
    "price": 3595,
    "image": "/products/zara-0085-813-409.webp",
    "sourceUrl": "https://www.zara.com/ie/en/flocked-halter-neck-maxi-dress-p00085813.html",
    "description": "Real Zara Ireland product in petrol blue. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Petrol blue"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-7874-444-800",
    "store": "zara",
    "name": "Voluminous Seamed Mini Dress",
    "brand": "Zara",
    "category": "Dresses",
    "price": 3995,
    "image": "/products/zara-7874-444-800.webp",
    "sourceUrl": "https://www.zara.com/ie/en/voluminous-seamed-mini-dress-p07874444.html",
    "description": "Real Zara Ireland product in black. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-4772-395-303",
    "store": "zara",
    "name": "Corsetry-Inspired Metallic Effect Mini Dress",
    "brand": "Zara",
    "category": "Dresses",
    "price": 3595,
    "image": "/products/zara-4772-395-303.webp",
    "sourceUrl": "https://www.zara.com/ie/en/metallic-effect-corsetry-inspired-mini-dress-p04772395.html",
    "description": "Real Zara Ireland product in golden. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Golden"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  },
  {
    "id": "zara-0085-814-745",
    "store": "zara",
    "name": "Long Halter Foulard Flocked Dress",
    "brand": "Zara",
    "category": "Dresses",
    "price": 3595,
    "image": "/products/zara-0085-814-745.webp",
    "sourceUrl": "https://www.zara.com/ie/en/long-flocked-halter-foulard-dress-p00085814.html",
    "description": "Real Zara Ireland product in toffee. Size choices are simulated. No live size availability is checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Toffee"
    ],
    "priceNote": "Cached Ireland price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T01:42:01Z"
  }
];

export function getProducts(store: ShopId): Product[] {
  return store === 'generic' ? catalogue : catalogue.filter((product) => product.store === store);
}
