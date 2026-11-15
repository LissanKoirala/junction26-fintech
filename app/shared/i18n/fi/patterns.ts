// Finnish templates for strings that arrive inside data with values baked in (model reasons, engine notes).
// Key = the English template with {placeholders} where the values sit; value = the Finnish with the same placeholders.
// Used only by tData(). Placeholder names must be unique within a key. Longer literal text is tried first.
//   "{times}x your usual {category} purchase": "{times} kertaa tavallinen {category}-ostoksesi"
const patterns: Record<string, string> = {
  // ---------------------------------------------------------------- ML: "Unusual for you" reasons (ml/anomalies). Lowercase category and weekday words are in fi/ml.ts.
  "{times}x your usual {category} purchase": "{times} kertaa tavallista suurempi ostos ({category})",
  "{times}x your typical purchase": "{times} kertaa tavallista ostostasi suurempi",
  "unusual hour for you ({time})": "sinulle epätavallinen kellonaika ({time})",
  "first {category} purchase in {n} days": "ensimmäinen ostos {n} päivään ({category})",
  "you rarely buy {category} ({n} times in the year before)": "harvinainen ostos sinulle ({category}: {n} kertaa edellisenä vuonna)",
  "rare day for you ({day})": "sinulle harvinainen viikonpäivä ({day})",

  // ---------------------------------------------------------------- ML: early-warning reasons (ml/risk drivers: label and display)
  "Your balance equals about {n} months of spending": "Saldosi vastaa noin {n} kuukauden kulutusta",
  "What is left after fixed payments covers about {n}x your usual spending until payday": "Kiinteiden maksujen jälkeen jäävä summa kattaa noin {n} kertaa tavallisen kulutuksesi palkkapäivään asti",
  "After rent of about {rent} and other fixed payments still to come before payday, about {left} is left": "Kun noin {rent} vuokra ja muut kiinteät maksut ennen palkkapäivää on maksettu, jäljelle jää noin {left}",
  "After the fixed payments still to come before payday, about {left} is left": "Kun kiinteät maksut ennen palkkapäivää on maksettu, jäljelle jää noin {left}",
  "Your lowest balance in the last {n} days was {v}": "Alin saldosi viimeisen {n} päivän aikana oli {v}",
  "Your lowest balance last pay cycle was {v}": "Alin saldosi edellisellä palkkajaksolla oli {v}",
  "You spend about {v} a day (last {n} days)": "Käytät noin {v} päivässä (viimeiset {n} päivää)",
  "{n} days below zero in the last {m} months": "{n} päivää miinuksella viimeisen {m} kuukauden aikana",
  "Fridays and Saturdays before payday: {v}": "Perjantait ja lauantait ennen palkkapäivää: {v}",
  "Payday is {n} days away": "Palkkapäivään on {n} päivää",
  "Payday was {n} days ago": "Palkkapäivästä on {n} päivää",
  "Payday was only {n} days ago, so little has been spent yet": "Palkkapäivästä on vasta {n} päivää, joten rahaa on käytetty vielä vähän",
  "Payday was only {n} day ago, so little has been spent yet": "Palkkapäivästä on vasta {n} päivä, joten rahaa on käytetty vielä vähän",
  "Your balance is {v}": "Saldosi on {v}",
  "Purchases in the last {n} days: {v}": "Ostoja viimeisen {n} päivän aikana: {v}",
  "Rent of about {v} is still to come before payday": "Noin {v} vuokra on vielä tulossa ennen palkkapäivää",
  "Fixed payments of about {v} are still to come before payday": "Kiinteitä maksuja on vielä tulossa noin {v} ennen palkkapäivää",
  "About {v} of utility bills are expected before payday": "Laskuja odotetaan noin {v} ennen palkkapäivää",
  "Rent is due in about {n} days": "Vuokran eräpäivään on noin {n} päivää",
  "Your salary is about {v} a month": "Palkkasi on noin {v} kuussa",
  "Your rent is about {v} a month": "Vuokrasi on noin {v} kuussa",
  "Your usual spending until payday is about {v}": "Tavallinen kulutuksesi palkkapäivään asti on noin {v}",
  "{v} of your past pay cycles went below zero": "{v} aiemmista palkkajaksoistasi kävi miinuksella",
  "{v} of your spending happens in the {n} days after payday": "{v} kulutuksestasi osuu {n} päivään palkkapäivän jälkeen",
  "Rent takes about {v} of your salary": "Vuokra vie noin {v} palkastasi",
  "Your monthly spending swings by about {v}": "Kuukausikulutuksesi vaihtelee noin {v}",
  "You have spent {v} less than usual since payday": "Olet käyttänyt palkkapäivän jälkeen {v} tavallista vähemmän",
  "You have spent {v} more than usual since payday": "Olet käyttänyt palkkapäivän jälkeen {v} tavallista enemmän",
  "You have spent {v} since payday": "Olet käyttänyt palkkapäivän jälkeen {v}",
  "Your spending in the last {n} days is {v} below your normal": "Kulutuksesi viimeisen {n} päivän aikana on {v} tavallista pienempi",
  "Your spending in the last {n} days is {v} above your normal": "Kulutuksesi viimeisen {n} päivän aikana on {v} tavallista suurempi",
  "Share of no-spend days: {v}": "Ostottomien päivien osuus: {v}",
  "Weekend share of spending: {v}": "Viikonlopun osuus kulutuksesta: {v}",
  "Day-to-day variability: {v}": "Päivittäinen vaihtelu: {v}",
  "Utilities per day: {v}": "Laskut päivässä: {v}",
  "Salary moved to another bank: {v}": "Palkkaa siirretty toiseen pankkiin: {v}",
  "Day of month: {v}": "Kuukauden päivä: {v}",
  "Age: {v}": "Ikä: {v}",
  "{v} months": "{v} kk",
  "{v} days": "{v} pv",
  "{v}/day": "{v}/pv",
  "{v} of usual": "{v} tavallisesta",
  "{v} of normal": "{v} normaalista",

  // ---------------------------------------------------------------- ML: first-home blockers (ml/home)
  "Equity: about {need} is typical for a {price} home; you have about {have} visible here.": "Omarahoitus: {price} asuntoon tarvitaan tyypillisesti noin {need}; täällä sinulla näkyy noin {have}.",
  "{n} days below zero in the last {m} months; lenders look at a steady buffer.": "{n} päivää miinuksella viimeisen {m} kuukauden aikana; lainanantajat katsovat vakaata puskuria.",
  "No net saving over the last {n} months yet, so the gap is not closing.": "Viimeisen {n} kuukauden aikana ei ole vielä kertynyt nettosäästöä, joten ero ei kaventu.",
  "Rent takes {v} of income, which leaves little room to save.": "Vuokra vie {v} tuloista, joten säästämiseen jää vähän tilaa.",

  // ---------------------------------------------------------------- ML: Two Futures (ml/twins insights and match note)
  "Twins who built a buffer spent about {v} a month less on {what} than twins who slipped.": "Puskuria kasvattaneet käyttivät noin {v} kuussa vähemmän kuin lipsuneet ({what}).",
  "Twins who built a buffer spent about {v} a month more on {what} than twins who slipped.": "Puskuria kasvattaneet käyttivät noin {v} kuussa enemmän kuin lipsuneet ({what}).",
  "Twins who built a buffer invested less, about {v} a month than twins who slipped.": "Puskuria kasvattaneet sijoittivat vähemmän kuin lipsuneet, noin {v} kuussa.",
  "Twins who built a buffer invested {v} a month more than twins who slipped.": "Puskuria kasvattaneet sijoittivat {v} kuussa enemmän kuin lipsuneet.",
  "Card purchases: {a} per month for twins who built a buffer vs {b} for twins who slipped.": "Korttiostot: {a} kuussa puskuria kasvattaneilla, {b} lipsuneilla.",
  "Weekend share of spending: {a} for twins who built a buffer vs {b} for twins who slipped.": "Viikonlopun osuus kulutuksesta: {a} puskuria kasvattaneilla, {b} lipsuneilla.",
  "Extras spent in the {n} days after payday: {a} for twins who built a buffer vs {b} for twins who slipped.": "Ekstrat {n} päivän sisällä palkasta: {a} puskuria kasvattaneilla, {b} lipsuneilla.",
  "Twins are {p} as far from you as a random customer would be (lower = closer match). Matched on {n} behaviour features with income within about ±{w}.":
    "Kaksosten etäisyys sinusta on {p} satunnaisen asiakkaan etäisyydestä (pienempi = parempi osuma). Vertailussa {n} käyttäytymispiirrettä, tulot noin ±{w} sisällä.",
};

export default patterns;
