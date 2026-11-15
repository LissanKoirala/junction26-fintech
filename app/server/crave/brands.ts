// Real brands, retailers and well-known product lines that a generated Crave shop must never use. Every generated
// shop name, brand, product name, pitch, tag, image prompt and review is checked against this list before it is
// streamed (generate.ts); a hit is removed or replaced with an invented name. Ambiguous everyday words that are also
// brands ("Apple" next to apple pie, "Mango", "Gap", "Switch") are left out on purpose, but their product lines are in.
const TERMS = [
  // sportswear and shoes: brands
  "Nike", "Adidas", "Puma", "Reebok", "Asics", "New Balance", "Saucony", "Brooks Running", "Hoka", "Hoka One One", "On Running", "Mizuno", "Under Armour",
  "Lululemon", "Gymshark", "Fila", "Kappa", "Umbro", "Converse", "Vans", "Salomon", "Merrell", "Timberland", "Dr. Martens", "Doc Martens", "Birkenstock",
  "Crocs", "UGG", "Clarks", "Ecco", "Skechers", "Karhu", "Diadora", "Le Coq Sportif", "Onitsuka Tiger", "Veja", "Allbirds", "Altra", "Inov-8", "La Sportiva",
  "Scarpa", "Lowa", "Teva", "Columbia", "Ellesse", "Sergio Tacchini", "Lotto", "Hummel", "Joma", "Kipsta", "Decathlon", "Kalenji",
  // sportswear and shoes: product lines
  "Cloudfoam", "Ultraboost", "Ultra Boost", "Boost 350", "Yeezy", "Stan Smith", "Samba", "Gazelle", "Spezial", "Handball Spezial", "Forum Low",
  "Campus 00s", "NMD", "Adilette", "Copa Mundial", "Air Max", "Air Force 1", "Air Force One", "Air Jordan", "Jordan", "Nike Dunk", "Dunk Low",
  "Air Huarache", "Cortez", "Pegasus", "Vaporfly", "Alphafly", "Zoom Fly", "Invincible Run", "Blazer Mid", "React Infinity", "Flyknit", "Gel-Kayano",
  "Kayano", "Gel-Nimbus", "Gel-Lyte", "Novablast", "Gel-1130", "Fresh Foam", "FuelCell", "990v6", "Endorphin", "Kinvara", "Clifton", "Bondi",
  "Speedgoat", "Mach 6", "Cloudmonster", "Cloudnova", "Cloudflow", "Cloudsurfer", "Chuck Taylor", "Chuck 70", "Old Skool", "Sk8-Hi", "Authentic Era",
  "Suede Classic", "Club C", "Classic Leather", "Wave Rider", "Speedcross", "XT-6", "Moab", "Jungle Moc", "Arizona Sandal", "Boston Clog",
  // outdoor and fashion
  "Canada Goose", "Moncler", "The North Face", "North Face", "Nuptse", "Patagonia", "Arc'teryx", "Arcteryx", "Fjällräven", "Fjallraven", "Kånken", "Kanken",
  "Haglöfs", "Haglofs", "Halti", "Luhta", "Icepeak", "Rukka", "Reima", "Helly Hansen", "Peak Performance", "Napapijri", "Woolrich", "Barbour", "Burberry",
  "Zara", "H&M", "Uniqlo", "Levi's", "Levis", "Wrangler", "Gucci", "Prada", "Louis Vuitton", "Chanel", "Hermès", "Hermes", "Dior", "Balenciaga", "Versace",
  "Armani", "Hugo Boss", "Ralph Lauren", "Polo Ralph Lauren", "Tommy Hilfiger", "Calvin Klein", "Lacoste", "Acne Studios", "Filippa K", "Arket",
  "Monki", "Massimo Dutti", "Pull&Bear", "Bershka", "Stradivarius", "Primark", "Superdry", "Jack & Jones", "Vero Moda", "Marimekko", "Unikko",
  "Polartec", "Gore-Tex", "GoreTex", "Thinsulate", "Primaloft", "Vibram", "Ray-Ban", "Oakley", "Wayfarer", "Rolex", "Casio", "G-Shock", "Swatch",
  "Seiko", "Tissot", "Fossil", "Daniel Wellington", "Pandora", "Kalevala Koru", "Michael Kors", "Longchamp", "Samsonite", "Rimowa", "Herschel",
  "Eastpak", "JanSport",
  // electronics
  "Sony", "PlayStation", "Xbox", "Nintendo", "Samsung", "Galaxy", "Galaxy Buds", "iPhone", "iPad", "MacBook", "iMac", "Apple Watch", "AirPods", "AirPods Pro",
  "AirPods Max", "EarPods", "HomePod", "Beats by Dre", "Beats Studio", "Beats Solo", "Powerbeats", "Bose", "QuietComfort", "SoundLink", "Sennheiser",
  "Jabra", "Elite 85t", "JBL", "Skullcandy", "Audio-Technica", "Bang & Olufsen", "Beoplay", "Marshall", "Sonos", "Bowers & Wilkins", "Shure",
  "AKG", "Plantronics", "Logitech", "Razer", "Corsair", "SteelSeries", "HyperX", "Keychron", "Ducky", "Cherry MX", "Das Keyboard", "Wooting", 
  "Dell", "Alienware", "Lenovo", "ThinkPad", "Asus", "ROG", "Acer", "Predator Helios", "Microsoft", "Surface Pro", "Intel", "AMD", "Ryzen", "Nvidia", "GeForce",
  "Canon", "Nikon", "Fujifilm", "Leica", "GoPro", "DJI", "Garmin", "Fitbit", "Suunto", "Polar Vantage", "Huawei", "Xiaomi", "OnePlus", "Nokia", "Motorola",
  "Google Pixel", "Pixel Buds", "Chromecast", "Kindle", "Echo Dot", "Alexa", "Fire TV", "Dyson", "Philips", "Braun", "Oral-B", "Bosch", "Siemens",
  "Electrolux", "Miele", "KitchenAid", "Nespresso", "De'Longhi", "DeLonghi", "Smeg", "Tefal", "Moccamaster", "Le Creuset", "Weber", "Roomba", "iRobot",
  "Tesla", "Volvo", "BMW", "Audi", "Mercedes", "Mercedes-Benz", "Porsche", "Ferrari", "Lamborghini", "Toyota", "Volkswagen", "Honda", "Yamaha",
  "Harley-Davidson", "Ducati", "Vespa",
  // home and Nordic brands
  "IKEA", "Jysk", "Artek", "Iittala", "Arabia", "Fiskars", "Finlayson", "Lapuan Kankurit", "Moomin", "Muumi", "Hackman", "Rörstrand", "Georg Jensen",
  "Muuto", "Normann Copenhagen", "Bodum", "Stelton", "Royal Copenhagen", "Kosta Boda", "Orrefors", "Lego", "Barbie", "Hot Wheels", "Nerf",
  "Pokémon", "Pokemon", "Disney", "Marvel", "Star Wars", "Harry Potter", "Hello Kitty",
  // retailers and delivery apps
  "Stockmann", "Prisma", "K-Citymarket", "Citymarket", "K-Market", "S-market", "Lidl", "Alepa", "Tokmanni", "Verkkokauppa", "Gigantti", "Zalando",
  "Amazon", "eBay", "Etsy", "AliExpress", "Temu", "Shein", "Wolt", "Foodora", "Uber Eats", "Deliveroo", "Just Eat", "Intersport", "Partioaitta",
  "Clas Ohlson", "Flying Tiger", "Sokos", "Anttila", "Halonen", "Kekäle", "Motonet", "Biltema", "Bauhaus", "K-Rauta", "Byggmax", "Apotek",
  // food and drink
  "McDonald's", "McDonalds", "Big Mac", "McFlurry", "Happy Meal", "Burger King", "Whopper", "KFC", "Hesburger", "Subway", "Taco Bell", "Domino's", "Dominos",
  "Pizza Hut", "Kotipizza", "Friends & Brgrs", "Five Guys", "Starbucks", "Frappuccino", "Dunkin'", "Dunkin", "Robert's Coffee", "Espresso House",
  "Costa Coffee", "Fazer", "Fazerin Sininen", "Valio", "Paulig", "Juhla Mokka", "Marabou", "Lindt", "Toblerone", "Nutella", "Ferrero", "Coca-Cola",
  "Coke", "Pepsi", "Fanta", "Sprite", "Red Bull", "Nescafé", "Nescafe", "Lavazza", "Illy", "Heinz", "Kellogg's", "Oreo", "Pringles", "Doritos", "Lay's",
  "Haribo", "Ben & Jerry's", "Häagen-Dazs", "Haagen-Dazs", "Magnum", "Kit Kat", "KitKat", "Snickers", "Twix", "M&M's", "Carlsberg", "Heineken", 
  "Absolut", "Koskenkorva", "Lapin Kulta", "Olvi", "Hartwall", "Jaffa", "Ichiran", "Ippudo", "Nissin", "Cup Noodles", "Maggi", "Knorr", "Barilla",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]?").replace(/[\s-]+/g, "[\\s-]?");
// longest first so "Air Jordan" wins over "Jordan"; letters and digits around a term mean a different word
const RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...new Set(TERMS)].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![\\p{L}\\p{N}])`, "giu");

/** The first real brand or product line in `text`, or null. */
export function realBrand(text: string | null | undefined): string | null {
  if (!text) return null;
  RE.lastIndex = 0;
  const m = RE.exec(text);
  return m ? m[0] : null;
}

/** `text` with every real brand or product line removed (spacing tidied). */
export function scrubBrands(text: string): string {
  RE.lastIndex = 0;
  return text.replace(RE, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?)])/g, "$1").replace(/^[\s,.;:–-]+|[\s,;:–-]+$/g, "").trim();
}

export const BRAND_TERM_COUNT = new Set(TERMS).size;
