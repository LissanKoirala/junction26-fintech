// Finnish for: the S-mobiili shell, shared UI kit, baskets explorer, weekly check-in, goal, connect-a-bank, personas, date and format helpers.
// Key = the exact English string used in the code (including {placeholders}); value = the Finnish.
const fi: Record<string, string> = {
  // ---------------------------------------------------------------- UI kit
  Loading: "Ladataan",
  "Loading…": "Ladataan…",
  "Junction 2026 concept · not an official S-Pankki product": "Junction 2026 -konsepti · ei virallinen S-Pankin tuote",
  "App language": "Sovelluksen kieli",
  Close: "Sulje",
  Back: "Takaisin",
  "Close check-in": "Sulje viikkokatsaus",
  "{label} could not be shown": "{label}: näyttäminen ei onnistunut",
  "This part could not be shown": "Tätä osaa ei voitu näyttää",
  "Something went wrong here. The rest of Vara still works.": "Tässä meni jotain pieleen. Muu Vara toimii edelleen.",
  "{what} is part of the real S-mobiili, not this concept demo.": "{what} löytyy oikeasta S-mobiilista, ei tästä konseptidemosta.",
  // ---------------------------------------------------------------- charts
  "Balance forecast to {date}: middle path ends at {end}, 1 in 10 paths below {low}":
    "Saldon ennuste {date} asti: keskimmäinen polku päättyy {end}, joka kymmenes polku alle {low}",
  "Balance until {date}: middle path ends at {end}; on a bad run (1 in 10) the lowest point is {low}.":
    "Saldo {date} asti: keskimmäinen polku päättyy {end}; huonolla tuurilla (1/10) alin kohta on {low}.",
  "likely {v}": "todennäköisesti {v}",
  "range {lo} – {hi}": "vaihteluväli {lo} – {hi}",
  "8 in 10 between": "8/10 välillä",
  Today: "Tänään",
  Now: "Nyt",
  You: "Sinä",
  "You are here": "Olet tässä",
  "Your balance over the last 12 months, now {v}.": "Saldosi viimeisen 12 kuukauden ajalta, nyt {v}.",
  "{label}: ends near {v}.": "{label}: päättyy noin {v}.",
  // ---------------------------------------------------------------- shell
  "Open Vara chat": "Avaa Vara-chat",
  Main: "Päävalikko",
  "demo customer": "demoasiakas",
  "{bank} (simulated)": "{bank} (simuloitu)",
  "Connected via open banking · demo": "Yhdistetty avoimen pankkirajapinnan kautta · demo",
  Simulated: "Simuloitu",
  "Debit and credit": "Debit ja credit",
  Transfers: "Siirrot",
  "Bill payment": "Laskunmaksu",
  Scanning: "Skannaus",
  "Card settings": "Korttiasetukset",
  "Account details": "Tilin tiedot",
  Payments: "Maksut",
  Cards: "Kortit",
  Investments: "Sijoitukset",
  "Bonus ja ostot": "Bonus ja ostot",
  Kuitit: "Kuitit",
  MobilePay: "MobilePay",
  "Your loyalty card, Bonus and purchases live here in the real S-mobiili.": "Oikeassa S-mobiilissa täällä ovat etukorttisi, Bonukset ja ostot.",
  "In S-mobiili": "S-mobiilissa",
  "Purchase breakdown for S Group stores": "S-ryhmän ostosten erittely",
  "Digital receipts": "Sähköiset kuitit",
  "Pay a bill": "Maksa lasku viitteellä",
  "Move money between your accounts": "Siirrä rahaa omien tiliesi välillä",
  "Pay a friend": "Maksa kaverille",
  "Scan a bill barcode": "Skannaa laskun viivakoodi",
  "Payments are not part of this concept demo.": "Maksut eivät kuulu tähän konseptidemoon.",
  // Minä
  "Use an id like CUST01234 or just 1234.": "Käytä tunnusta kuten CUST01234 tai pelkkä 1234.",
  "Choose a demo customer": "Valitse demoasiakas",
  "The dataset has no names. These first names are invented for the demo; every number comes from the customer's real (synthetic) transactions.":
    "Aineistossa ei ole nimiä. Nämä etunimet on keksitty demoa varten; jokainen luku tulee asiakkaan oikeista (synteettisistä) tapahtumista.",
  "Switch to demo customer {name}": "Vaihda demoasiakkaaseen {name}",
  "balance {v}": "saldo {v}",
  Selected: "Valittu",
  "Load any customer": "Lataa mikä tahansa asiakas",
  "Customer id": "Asiakastunnus",
  "{n} customers in the dataset (CUST00001–CUST05100).": "Aineistossa {n} asiakasta (CUST00001–CUST05100).",
  "e.g. CUST01408": "esim. CUST01408",
  "Load customer": "Lataa asiakas",
  "Now showing {id}, age {age} (irregular-income cohort: some figures may look unusual).":
    "Näytetään {id}, ikä {age} (epäsäännölliset tulot: jotkin luvut voivat näyttää oudoilta).",
  "Now showing {id}, age {age}.": "Näytetään {id}, ikä {age}.",
  Language: "Kieli",
  "Switch the app between English and Finnish with EN | FI at the top of the screen. Vara answers in the language you write in: Finnish, Swedish or English. The microphone in the chat listens in the app language.":
    "Vaihda kieli suomen ja englannin välillä näytön yläreunan EN | FI -valinnalla. Vara vastaa sillä kielellä, jolla kirjoitat: suomeksi, ruotsiksi tai englanniksi. Chatin mikrofoni kuuntelee sovelluksen kielellä.",
  "About this demo": "Tietoa demosta",
  'Junction 2026 concept · not an official S-Pankki product. Built on the synthetic transaction dataset of the S-Pankki "Personal Economic Trainer" challenge (5,100 customers, Oct 2024 – Sep 2026). "Today" is 30 Sep 2026.':
    "Junction 2026 -konsepti · ei virallinen S-Pankin tuote. Rakennettu S-Pankin ”Personal Economic Trainer” -haasteen synteettiselle tapahtuma-aineistolle (5 100 asiakasta, loka 2024 – syys 2026). ”Tänään” on 30.9.2026.",
  "Benchmarks: Statistics Finland, Household Budget Survey 2022, price-adjusted (CC BY 4.0). Icons: Lucide (ISC). Font: Schibsted Grotesk (OFL).":
    "Vertailuluvut: Tilastokeskus, kotitalouksien kulutustutkimus 2022, hintakorjattu (CC BY 4.0). Kuvakkeet: Lucide (ISC). Fontti: Schibsted Grotesk (OFL).",
  "Offline demo mode is on (?mock=1): chat and check-in are generated in the browser from the engine.":
    "Offline-demotila on päällä (?mock=1): chat ja viikkokatsaus luodaan selaimessa laskentamoottorilla.",
  // personas (names stay)
  Espoo: "Espoo",
  Vantaa: "Vantaa",
  "Helsinki region": "Helsingin seutu",
  "Rent takes about 65% of her pay": "Vuokra vie noin 65 % palkasta",
  "Lots of tiny purchases, steady saver": "Paljon pieniä ostoksia, tasainen säästäjä",
  "Invests every month while overdrawn": "Sijoittaa joka kuukausi, vaikka saldo käy miinuksella",
  "One big surprise purchase": "Yksi iso yllätysosto",
  "Spends more than he earns": "Kuluttaa enemmän kuin ansaitsee",
  "Most of her money lives in another bank": "Suurin osa rahoista on toisessa pankissa",
};

export default fi;
