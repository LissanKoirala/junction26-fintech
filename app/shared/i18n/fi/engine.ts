// Finnish for: sentences and labels produced by app/shared/engine (bases, notes, equivalents, basket and category names, status labels).
// Key = the exact English string used in the code (including {placeholders}); value = the Finnish.
const fi: Record<string, string> = {
  // ---------------------------------------------------------------- baskets (domain.json)
  "Fixed musts": "Kiinteät pakolliset",
  "Surprise musts": "Yllättävät pakolliset",
  "Everyday extras": "Arjen ekstrat",
  "Mandatory and regular": "Pakollinen ja säännöllinen",
  "Mandatory but irregular": "Pakollinen mutta epäsäännöllinen",
  "Everyday spending that slips through your fingers": "Arjen kulutus, joka valuu huomaamatta",
  rent: "vuokra",
  "a broken washing machine": "hajonnut pesukone",
  coffees: "kahvit",

  // ---------------------------------------------------------------- categories (domain.json)
  Groceries: "Ruokaostokset",
  "Eating out": "Ulkona syöminen",
  Transport: "Liikkuminen",
  Entertainment: "Viihde",
  Health: "Terveys",
  "Home & tech": "Koti ja tekniikka",
  "Shopping & lifestyle": "Ostokset ja vapaa-aika",
  Travel: "Matkailu",
  Utilities: "Laskut",
  Housing: "Asuminen",
  Salary: "Palkka",
  "Other income": "Muut tulot",
  Investing: "Sijoittaminen",
  "Investment withdrawal": "Sijoitusten nosto",
  "Transfer to another account": "Siirto toiselle tilille",

  // ---------------------------------------------------------------- merchant types (domain.json mcc)
  Supermarket: "Supermarket",
  "Convenience store": "Lähikauppa",
  "Butcher & deli": "Liha- ja herkkukauppa",
  "Dairy & bakery shop": "Leipomo- ja maitokauppa",
  Restaurant: "Ravintola",
  "Fast food & cafe": "Pikaruoka ja kahvila",
  "Bar & pub": "Baari ja pubi",
  "Public transport": "Joukkoliikenne",
  Taxi: "Taksi",
  "Service station": "Huoltoasema",
  Fuel: "Polttoaine",
  Parking: "Pysäköinti",
  Cinema: "Elokuvateatteri",
  "Concerts & theatre": "Konsertit ja teatteri",
  Attractions: "Nähtävyydet",
  "Amusement park": "Huvipuisto",
  Recreation: "Vapaa-aika",
  Pharmacy: "Apteekki",
  Doctor: "Lääkäri",
  Dentist: "Hammaslääkäri",
  "Health services": "Terveyspalvelut",
  "Home supplies": "Kodintarvikkeet",
  "Hardware store": "Rautakauppa",
  Furniture: "Huonekalut",
  Electronics: "Elektroniikka",
  "Computers & software": "Tietokoneet ja ohjelmistot",
  Clothing: "Vaatteet",
  "Sports gear": "Urheiluvälineet",
  Bookshop: "Kirjakauppa",
  "Hobbies & games": "Harrastukset ja pelit",
  "Specialty shop": "Erikoisliike",
  Flights: "Lennot",
  "Travel agency": "Matkatoimisto",
  Hotel: "Hotelli",
  "Car rental": "Autovuokraamo",
  "Unknown merchant type": "Tuntematon kauppatyyppi",

  // ---------------------------------------------------------------- periods
  "This week ({from}–{to})": "Tämä viikko ({from}–{to})",
  "Last week ({from}–{to})": "Viime viikko ({from}–{to})",
  "{range} (month to date)": "{range} (kuukausi tähän asti)",
  "Last 30 days ({range})": "Viimeiset 30 päivää ({range})",
  "Last 90 days ({range})": "Viimeiset 90 päivää ({range})",
  "{year} so far": "{year} tähän asti",
  "All data ({range})": "Kaikki tiedot ({range})",

  // ---------------------------------------------------------------- recurring items and payday
  "Your income is irregular, so Vara plans for the next 30 days.": "Tulosi ovat epäsäännöllisiä, joten Vara suunnittelee seuraavat 30 päivää.",
  "No regular monthly salary in the last 6 months, so Vara plans for the next 30 days.":
    "Viimeisen 6 kuukauden aikana ei ole tullut säännöllistä kuukausipalkkaa, joten Vara suunnittelee seuraavat 30 päivää.",
  "You were paid on the 15th in {n} of the last {m} months; the other months it came at the end of the month.":
    "Palkka tuli 15. päivä {n} kertaa viimeisen {m} kuukauden aikana; muina kuukausina se tuli kuun lopussa.",
  "You were paid on the 15th in each of the last {m} months.": "Palkka on tullut 15. päivä jokaisena viimeisestä {m} kuukaudesta.",
  "Your salary usually arrives around day {day} of the month.": "Palkkasi tulee yleensä kuun {day}. päivän tienoilla.",
  "Income is irregular, so Vara plans for the next 30 days instead of predicting a payday.":
    "Tulot ovat epäsäännöllisiä, joten Vara suunnittelee seuraavat 30 päivää eikä arvaa palkkapäivää.",
  "Income is irregular: no steady monthly salary in the last 6 months.": "Tulot ovat epäsäännöllisiä: viimeisen 6 kuukauden aikana ei ole tullut tasaista kuukausipalkkaa.",
  "Income (irregular)": "Tulot (epäsäännölliset)",
  "Rent / housing": "Vuokra / asuminen",
  "Some months have no housing payment in the data (a gap in the data, not a missed payment).":
    "Joiltain kuukausilta asumismaksu puuttuu tiedoista (aukko tiedoissa, ei maksamaton vuokra).",
  "Utilities (electricity, water, internet …)": "Laskut (sähkö, vesi, netti …)",
  "About {n} bills a month; budgeted as a monthly total.": "Noin {n} laskua kuussa; budjetoitu kuukauden yhteissummana.",
  "Usually {n} day after payday.": "Yleensä {n} päivä palkkapäivän jälkeen.",
  "Usually {n} days after payday.": "Yleensä {n} päivää palkkapäivän jälkeen.",
  "Weekly average over the last 3 full months.": "Viikkokeskiarvo viimeiseltä 3 täydeltä kuukaudelta.",

  // ---------------------------------------------------------------- safe to spend
  "{n} day": "{n} päivä",
  "{n} days": "{n} päivää",
  "Median of your last 6 housing payments, usually paid between day {from} and {to} of the month.":
    "Viimeisen 6 asumismaksusi mediaani, yleensä maksettu kuun {from}.–{to}. päivänä.",
  "Median of your last 6 housing payments, usually paid between day {from} and {to} of the month, adjusted by {delta} in this scenario.":
    "Viimeisen 6 asumismaksusi mediaani, yleensä maksettu kuun {from}.–{to}. päivänä, tässä skenaariossa muutettuna {delta}.",
  "Your utilities average {amount} a month (the {n} of the last {m} months that had bills), pro-rated for {days}.":
    "Laskusi ovat keskimäärin {amount} kuussa (ne {n} viimeisestä {m} kuukaudesta, joilla oli laskuja), suhteutettuna jaksoon ({days}).",
  "You spend about {amount} a week on groceries (last 3 full months), so {days} need about this much.":
    "Käytät ruokaostoksiin noin {amount} viikossa (viimeiset 3 täyttä kuukautta), joten {days} vaatii suunnilleen tämän verran.",
  "Getting around and other fixed musts": "Liikkuminen ja muut kiinteät pakolliset",
  "Public transport, fuel and other fixed-must purchases average {amount} a week (last 3 full months).":
    "Joukkoliikenne, polttoaine ja muut kiinteät pakolliset ostot ovat keskimäärin {amount} viikossa (viimeiset 3 täyttä kuukautta).",
  "Your usual investment deposit": "Tavallinen sijoituksesi",
  "You usually invest this amount a few days after payday, and it has not gone out yet this month.":
    "Sijoitat yleensä tämän summan muutama päivä palkkapäivän jälkeen, eikä se ole vielä lähtenyt tässä kuussa.",
  "Savings goal: {name}": "Säästötavoite: {name}",
  '{amount} a month toward "{name}", pro-rated for {days}.': "{amount} kuussa tavoitteeseen ”{name}”, suhteutettuna jaksoon ({days}).",
  "Extra saving (scenario)": "Lisäsäästö (skenaario)",
  "{amount} a month moved to savings, pro-rated for {days}.": "{amount} kuussa säästöön, suhteutettuna jaksoon ({days}).",
  "Safety buffer": "Puskuri",
  "The buffer you chose to keep untouched.": "Puskuri, jonka valitsit pitää koskemattomana.",
  "A cushion for surprise musts: 10% of the income that stays on this account (at least 50 €).":
    "Puskuri yllättäviin pakollisiin: 10 % tälle tilille jäävistä tuloista (vähintään 50 €).",
  "A cushion for surprise musts: 10% of your monthly income (at least 50 €).": "Puskuri yllättäviin pakollisiin: 10 % kuukausituloistasi (vähintään 50 €).",
  "Pay usually comes on the 15th. In {n} of the last {m} months it came at the end of the month; your cushion covers that.":
    "Palkka tulee yleensä 15. päivä. Viimeisen {m} kuukauden aikana se tuli {n} kertaa kuun lopussa; puskurisi kattaa sen.",
  "Pay has come on the 15th in each of the last {m} months. If it ever comes at the end of the month, your cushion covers that.":
    "Palkka on tullut 15. päivä jokaisena viimeisestä {m} kuukaudesta. Jos se joskus tulee vasta kuun lopussa, puskurisi kattaa sen.",
  "Pay usually comes on the 15th. In {n} of the last {m} months it came at the end of the month, so Vara keeps {amount} aside in case it does.":
    "Palkka tulee yleensä 15. päivä. Viimeisen {m} kuukauden aikana se tuli {n} kertaa kuun lopussa, joten Vara pitää sivussa {amount} siltä varalta.",
  "Pay has come on the 15th in each of the last {m} months. Vara still keeps {amount} aside in case it comes at the end of the month.":
    "Palkka on tullut 15. päivä jokaisena viimeisestä {m} kuukaudesta. Vara pitää silti sivussa {amount} siltä varalta, että se tulee kuun lopussa.",
  "In case pay comes late": "Jos palkka myöhästyy",
  "If pay comes on {late} instead of {date}, the {n} extra days of fixed musts need about {extra}. Your cushion covers {buffer}, so Vara keeps the rest aside.":
    "Jos palkka tulee {late} eikä {date}, {n} lisäpäivän kiinteät pakolliset vievät noin {extra}. Puskurisi kattaa {buffer}, joten Vara pitää loput sivussa.",
  "Balance today": "Saldo tänään",
  "Free until payday": "Vapaana palkkapäivään asti",
  "Weeks until payday ({days})": "Viikkoja palkkapäivään ({days})",
  "Safe to spend per week": "Käyttövaraa viikossa",
  "Most of this is savings you have already built up. Your everyday extras usually take about {amount} a week; staying near that keeps the cushion growing.":
    "Suurin osa tästä on jo kertyneitä säästöjäsi. Arjen ekstroihisi menee yleensä noin {amount} viikossa; kun pysyt lähellä sitä, puskuri kasvaa.",
  "The musts coming before payday are bigger than your balance. Small cuts now, or moving a bill, can stop the account going below zero.":
    "Ennen palkkapäivää tulevat pakolliset ovat saldoasi suuremmat. Pienet karsinnat nyt tai laskun siirtäminen voivat estää saldoa käymästä miinuksella.",
  "Most of your salary moves to another account right after payday, so this only covers the money in this account.":
    "Suurin osa palkastasi siirtyy toiselle tilille heti palkkapäivänä, joten tämä koskee vain tämän tilin rahoja.",

  // ---------------------------------------------------------------- what-if
  "All spending": "Kaikki kulutus",
  "about {n} weeks of your groceries per year": "noin {n} viikon ruokaostokset vuodessa",
  "about {pct}% of a month's rent, every month": "noin {pct} % kuukauden vuokrasta, joka kuukausi",
  "about {n} months of your utility bills per year": "noin {n} kuukauden laskut vuodessa",
  "{amount} more spending every month": "{amount} enemmän kulutusta joka kuukausi",
  "Monthly average of {range} ({n} full month)": "Kuukausikeskiarvo: {range} ({n} täysi kuukausi)",
  "Monthly average of {range} ({n} full months)": "Kuukausikeskiarvo: {range} ({n} täyttä kuukautta)",

  // ---------------------------------------------------------------- spending queries
  "{category} (no merchant code)": "{category} (ei kauppakoodia)",
  "Week of {day}": "Viikko alkaen {day}",
  "No merchant id": "Ei kauppiastunnusta",
  "Period: {label} ({from} to {to})": "Ajanjakso: {label} ({from}–{to})",
  "Category: {list}": "Luokka: {list}",
  "Merchant type: {list}": "Kauppatyyppi: {list}",
  "Basket: {list}": "Kori: {list}",
  "Amount at least {amount}": "Summa vähintään {amount}",
  "Amount at most {amount}": "Summa enintään {amount}",
  "Weekdays: {list}": "Viikonpäivät: {list}",
  "Spending only (rent, bills and card purchases; saving and transfers excluded)": "Vain kulutus (vuokra, laskut ja korttiostot; säästöt ja siirrot eivät mukana)",
  "Grouped by {what}": "Ryhmitelty: {what}",
  category: "luokka",
  mcc: "kauppatyyppi",
  basket: "kori",
  month: "kuukausi",
  week: "viikko",
  day: "päivä",
  weekday: "viikonpäivä",
  merchant: "kauppias",
  hour: "tunti",
};

export default fi;
