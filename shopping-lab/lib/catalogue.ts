import type { Product, ShopId } from './shop-contract';

// Real product facts cached from official public pages. Sizes are explicitly simulated.
// FetchedAt records research retrieval time; source pages may be older cached crawls.
export const CATALOGUE_VERSION = '2026-11-15.3';

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
  },
  {
    "id": "stockx-extra-jordan-4-bred-reimagined",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Jordan 4 Retro Bred Reimagined",
    "brand": "Jordan",
    "category": "Basketball",
    "price": 17800,
    "image": "/products/stockx-extra-jordan-4-bred-reimagined.webp",
    "sourceUrl": "https://stockx.com/de-de/air-jordan-4-retro-bred-reimagined",
    "description": "Real StockX listing · FV5029-006. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-jordan-3-white-cement-reimagined",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Jordan 3 Retro White Cement Reimagined",
    "brand": "Jordan",
    "category": "Basketball",
    "price": 10400,
    "image": "/products/stockx-extra-jordan-3-white-cement-reimagined.webp",
    "sourceUrl": "https://stockx.com/de-de/air-jordan-3-retro-white-cement-reimagined",
    "description": "Real StockX listing · DN3707-100. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-nike-sb-dunk-chicago",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Nike SB Dunk Low J-Pack Chicago",
    "brand": "Nike",
    "category": "Skateboarding",
    "price": 11700,
    "image": "/products/stockx-extra-nike-sb-dunk-chicago.webp",
    "sourceUrl": "https://stockx.com/de-de/nike-sb-dunk-low-j-pack-chicago",
    "description": "Real StockX listing · BQ6817-600. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-adidas-handball-spezial-black",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "adidas Handball Spezial Black Gum",
    "brand": "adidas",
    "category": "Lifestyle",
    "price": 5000,
    "image": "/products/stockx-extra-adidas-handball-spezial-black.webp",
    "sourceUrl": "https://stockx.com/de-de/adidas-handball-spezial-black-gum",
    "description": "Real StockX listing · DB3021. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-adidas-yeezy-350-bone",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "adidas Yeezy Boost 350 V2 Bone",
    "brand": "adidas",
    "category": "Lifestyle",
    "price": 10400,
    "image": "/products/stockx-extra-adidas-yeezy-350-bone.webp",
    "sourceUrl": "https://stockx.com/de-de/adidas-yeezy-boost-350-v2-bone",
    "description": "Real StockX listing · HQ6316. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-nike-p-6000-metallic-silver",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Nike P-6000 Metallic Silver",
    "brand": "Nike",
    "category": "Lifestyle",
    "price": 7500,
    "image": "/products/stockx-extra-nike-p-6000-metallic-silver.webp",
    "sourceUrl": "https://stockx.com/de-de/nike-p-6000-metallic-silver",
    "description": "Real StockX listing · CN0149-001. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:20:45Z"
  },
  {
    "id": "stockx-extra-new-balance-9060-sea-salt",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "New Balance 9060 Sea Salt",
    "brand": "New Balance",
    "category": "Lifestyle",
    "price": 7600,
    "image": "/products/stockx-extra-new-balance-9060-sea-salt.webp",
    "sourceUrl": "https://stockx.com/de-de/new-balance-9060-sea-salt",
    "description": "Real StockX listing · U9060MAC. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-new-balance-2002r-rain-cloud",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "New Balance 2002R Protection Pack Rain Cloud",
    "brand": "New Balance",
    "category": "Lifestyle",
    "price": 7200,
    "image": "/products/stockx-extra-new-balance-2002r-rain-cloud.webp",
    "sourceUrl": "https://stockx.com/de-de/new-balance-m2002-protection-pack-rain-cloud",
    "description": "Real StockX listing · M2002RDA. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-nike-vomero-photon-dust",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Nike Zoom Vomero 5 Photon Dust Metallic Silver (Women's)",
    "brand": "Nike",
    "category": "Running",
    "price": 8400,
    "image": "/products/stockx-extra-nike-vomero-photon-dust.webp",
    "sourceUrl": "https://stockx.com/de-de/nike-zoom-vomero-5-photon-dust-metallic-silver-w",
    "description": "Real StockX listing · FD0884-025. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-asics-gel-nyc-oyster",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "ASICS Gel-NYC Oyster Grey",
    "brand": "ASICS",
    "category": "Running",
    "price": 6700,
    "image": "/products/stockx-extra-asics-gel-nyc-oyster.webp",
    "sourceUrl": "https://stockx.com/de-de/asics-gel-nyc-oyster-grey",
    "description": "Real StockX listing · 1201A789-103. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-puma-speedcat-red",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Puma Speedcat OG Red White",
    "brand": "Puma",
    "category": "Lifestyle",
    "price": 5500,
    "image": "/products/stockx-extra-puma-speedcat-red.webp",
    "sourceUrl": "https://stockx.com/fr-fr/puma-speedcat-og-red-white",
    "description": "Real StockX listing · 398846-02. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-new-balance-530-white-silver",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "New Balance 530 White Silver Navy",
    "brand": "New Balance",
    "category": "Lifestyle",
    "price": 5500,
    "image": "/products/stockx-extra-new-balance-530-white-silver.webp",
    "sourceUrl": "https://stockx.com/de-de/new-balance-530-white-silver-navy",
    "description": "Real StockX listing · MR530SG. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-jordan-4-sb-pine-green",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Jordan 4 Retro SB Pine Green",
    "brand": "Jordan",
    "category": "Skateboarding",
    "price": 21500,
    "image": "/products/stockx-extra-jordan-4-sb-pine-green.webp",
    "sourceUrl": "https://stockx.com/de-de/air-jordan-4-retro-sb-pine-green",
    "description": "Real StockX listing · DR5415-103. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-asics-kayano-14-midnight",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "ASICS Gel-Kayano 14 White Midnight (Women's)",
    "brand": "ASICS",
    "category": "Running",
    "price": 12200,
    "image": "/products/stockx-extra-asics-kayano-14-midnight.webp",
    "sourceUrl": "https://stockx.com/fr-fr/asics-gel-kayano-14-white-midnight-w",
    "description": "Real StockX listing · 1202A056-109. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-nike-air-max-90-infrared",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Nike Air Max 90 Infrared (2020)",
    "brand": "Nike",
    "category": "Lifestyle",
    "price": 10800,
    "image": "/products/stockx-extra-nike-air-max-90-infrared.webp",
    "sourceUrl": "https://stockx.com/fr-fr/nike-air-max-90-infrared-2020",
    "description": "Real StockX listing · CT1685-100. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "stockx-extra-nike-air-max-1-patta-monarch",
    "store": "stockx",
    "merchantName": "StockX",
    "currency": "EUR",
    "name": "Nike Air Max 1 Patta Waves Monarch (without Bracelet)",
    "brand": "Nike",
    "category": "Lifestyle",
    "price": 14200,
    "image": "/products/stockx-extra-nike-air-max-1-patta-monarch.webp",
    "sourceUrl": "https://stockx.com/de-de/nike-air-max-1-patta-monarch",
    "description": "Real StockX listing · DH1348-001. EU 38–44 choices are simulated selections. The recorded EUR starting ask applies to all sizes selected on the source page; actual size prices and fees may differ. No live stock is claimed.",
    "sizes": [
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44"
    ],
    "priceNote": "Cached EUR starting ask · demo sizes · fees may apply",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:19:35Z"
  },
  {
    "id": "zara-extra-satin-jewel-shirt",
    "store": "zara",
    "currency": "EUR",
    "name": "Satin Shirt With Jewel Buttons",
    "brand": "Zara",
    "category": "Shirts",
    "price": 3595,
    "image": "/products/zara-extra-satin-jewel-shirt.webp",
    "sourceUrl": "https://www.zara.com/ie/en/satin-shirt-with-jewel-buttons-p08971581.html",
    "description": "Fluid satin shirt with a classic collar, long sleeves and decorative buttons. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Burgundy"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-oxford-shirt",
    "store": "zara",
    "currency": "EUR",
    "name": "Basic Oxford Shirt",
    "brand": "Zara",
    "category": "Shirts",
    "price": 2595,
    "image": "/products/zara-extra-oxford-shirt.webp",
    "sourceUrl": "https://www.zara.com/ie/en/basic-oxford-shirt-p08741239.html",
    "description": "A long-sleeved Oxford shirt with a V-neck opening and buttoned front. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Sky blue"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-striped-poplin-shirt",
    "store": "zara",
    "currency": "EUR",
    "name": "Basic Poplin Shirt",
    "brand": "Zara",
    "category": "Shirts",
    "price": 2595,
    "image": "/products/zara-extra-striped-poplin-shirt.webp",
    "sourceUrl": "https://www.zara.com/ie/en/basic-poplin-shirt-p08050758.html",
    "description": "Striped poplin shirt with a collar, V-shaped neckline and long sleeves. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Blue/White"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-belted-knit-cardigan",
    "store": "zara",
    "currency": "EUR",
    "name": "Belted Knit Cardigan",
    "brand": "Zara",
    "category": "Knitwear",
    "price": 4595,
    "image": "/products/zara-extra-belted-knit-cardigan.webp",
    "sourceUrl": "https://www.zara.com/ie/en/belted-cardingan-p02756108.html",
    "description": "A high-neck cardigan with roomy sleeves, matching belt and zipped front. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Grey"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-wool-zip-jacket",
    "store": "zara",
    "currency": "EUR",
    "name": "100% Wool Zip-Up Jacket",
    "brand": "Zara",
    "category": "Knitwear",
    "price": 4595,
    "image": "/products/zara-extra-wool-zip-jacket.webp",
    "sourceUrl": "https://www.zara.com/ie/en/100-wool-zip-up-jacket-p02893103.html",
    "description": "A wool knit layer with a high collar, full-length sleeves and ribbed edges. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Mink"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-wool-cardigan",
    "store": "zara",
    "currency": "EUR",
    "name": "100% Wool Plain Knit Cardigan",
    "brand": "Zara",
    "category": "Knitwear",
    "price": 4595,
    "image": "/products/zara-extra-wool-cardigan.webp",
    "sourceUrl": "https://www.zara.com/ie/en/100-wool-plain-knit-cardigan-p02893102.html",
    "description": "Round-neck wool cardigan with long sleeves and buttons down the front. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Navy blue"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-wide-leg-jeans",
    "store": "zara",
    "currency": "EUR",
    "name": "TRF High-Waist Wide-Leg Jeans",
    "brand": "Zara",
    "category": "Jeans",
    "price": 3595,
    "image": "/products/zara-extra-wide-leg-jeans.webp",
    "sourceUrl": "https://www.zara.com/ie/en/wide-leg-fit-high-waist-trf-jeans-p05575229.html",
    "description": "Full-length wide-leg denim with a high rise, five pockets and unfinished hems. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "EU 32",
      "EU 34",
      "EU 36",
      "EU 38",
      "EU 40",
      "EU 42"
    ],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-mom-fit-jeans",
    "store": "zara",
    "currency": "EUR",
    "name": "Z1975 High-Waist Mom Fit Jeans",
    "brand": "Zara",
    "category": "Jeans",
    "price": 2995,
    "image": "/products/zara-extra-mom-fit-jeans.webp",
    "sourceUrl": "https://www.zara.com/ie/en/z1975-high-waist-mom-fit-jeans-p07223225.html",
    "description": "High-rise mom-fit jeans with an ankle-length leg and five-pocket styling. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "EU 32",
      "EU 34",
      "EU 36",
      "EU 38",
      "EU 40",
      "EU 42"
    ],
    "colors": [
      "Indigo"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-straight-leg-jeans",
    "store": "zara",
    "currency": "EUR",
    "name": "TRF Mid-Waist Straight-Leg Jeans",
    "brand": "Zara",
    "category": "Jeans",
    "price": 2995,
    "image": "/products/zara-extra-straight-leg-jeans.webp",
    "sourceUrl": "https://www.zara.com/ie/en/trf-mid-waist-straight-leg-jeans-p00541211.html",
    "description": "Straight-leg denim with a mid rise, belt loops and a button-and-zip closure. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "EU 32",
      "EU 34",
      "EU 36",
      "EU 38",
      "EU 40",
      "EU 42"
    ],
    "colors": [
      "Blue"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-velvet-loafers",
    "store": "zara",
    "currency": "EUR",
    "name": "Soft Velvet Loafers",
    "brand": "Zara",
    "category": "Shoes",
    "price": 3995,
    "image": "/products/zara-extra-velvet-loafers.webp",
    "sourceUrl": "https://www.zara.com/ie/en/soft-velvet-loafers-p11575810.html",
    "description": "Round-toe velvet loafers with a high vamp and a flat, 1 cm sole. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "EU 36",
      "EU 37",
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41"
    ],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-suede-kitten-heels",
    "store": "zara",
    "currency": "EUR",
    "name": "Suede Kitten Heel Shoes",
    "brand": "Zara",
    "category": "Shoes",
    "price": 4595,
    "image": "/products/zara-extra-suede-kitten-heels.webp",
    "sourceUrl": "https://www.zara.com/ie/en/suede-kitten-heel-shoes-p11205910.html",
    "description": "Pointed suede shoes with a cutaway vamp and a 4 cm kitten heel. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "EU 36",
      "EU 37",
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41"
    ],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-patent-heels",
    "store": "zara",
    "currency": "EUR",
    "name": "Patent Heeled Shoes",
    "brand": "Zara",
    "category": "Shoes",
    "price": 3595,
    "image": "/products/zara-extra-patent-heels.webp",
    "sourceUrl": "https://www.zara.com/ie/en/patent-heeled-shoes-p12200910.html",
    "description": "Pointed patent shoes with a rounded vamp and an 8.5 cm stiletto heel. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "EU 36",
      "EU 37",
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41"
    ],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-soft-bomber",
    "store": "zara",
    "currency": "EUR",
    "name": "Soft Bomber Jacket",
    "brand": "Zara",
    "category": "Jackets",
    "price": 3595,
    "image": "/products/zara-extra-soft-bomber.webp",
    "sourceUrl": "https://www.zara.com/ie/en/soft-bomber-jacket-p03046334.html",
    "description": "Soft bomber with a high collar, zipped front, welt pockets and gathered edges. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Beige"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-reversible-jacket",
    "store": "zara",
    "currency": "EUR",
    "name": "Reversible Double-Faced Jacket",
    "brand": "Zara",
    "category": "Jackets",
    "price": 7995,
    "image": "/products/zara-extra-reversible-jacket.webp",
    "sourceUrl": "https://www.zara.com/ie/en/reversible-double-faced-jacket-p08073251.html",
    "description": "Reversible button-front jacket combining a leather-look face and faux-fur texture. Size choices are simulated; live stock is not checked.",
    "sizes": [
      "XS",
      "S",
      "M",
      "L",
      "XL"
    ],
    "colors": [
      "Brown"
    ],
    "priceNote": "Cached Zara Ireland EUR price · size choices simulated",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-embossed-bag",
    "store": "zara",
    "currency": "EUR",
    "name": "Embossed Shoulder Bag",
    "brand": "Zara",
    "category": "Bags",
    "price": 3595,
    "image": "/products/zara-extra-embossed-bag.webp",
    "sourceUrl": "https://www.zara.com/ie/en/embossed-shoulder-bag-p16034910.html",
    "description": "Elongated embossed shoulder bag with a detachable chain and zipped closure. Original merchant catalogue snapshot; live stock is not checked.",
    "sizes": [],
    "colors": [
      "Black"
    ],
    "priceNote": "Cached Zara Ireland EUR price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  },
  {
    "id": "zara-extra-satin-handbag",
    "store": "zara",
    "currency": "EUR",
    "name": "Satin Handbag",
    "brand": "Zara",
    "category": "Bags",
    "price": 2995,
    "image": "/products/zara-extra-satin-handbag.webp",
    "sourceUrl": "https://www.zara.com/ie/en/satin-handbag-p16058810.html",
    "description": "A small satin handbag with a top handle, inner pocket and gathered tassel closure. Original merchant catalogue snapshot; live stock is not checked.",
    "sizes": [],
    "colors": [
      "Lime Green"
    ],
    "priceNote": "Cached Zara Ireland EUR price",
    "priceKind": "snapshot",
    "fetchedAt": "2026-11-15T05:16:49Z"
  }
];

export function getProducts(store: ShopId): Product[] {
  return store === 'generic' ? catalogue : catalogue.filter((product) => product.store === store);
}
