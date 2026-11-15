// Formatting helpers for server-built text (cards, concept examples, check-in fallbacks). Finnish money format.
const eurFmt = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0Fmt = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
/** "1 234,56 €" with a real minus sign. */
export const eur = (x: number) => eurFmt.format(x).replace("-", "−");
export const eur0 = (x: number) => eur0Fmt.format(Math.round(x)).replace("-", "−");
export const pct = (x: number, digits = 0) => `${new Intl.NumberFormat("fi-FI", { maximumFractionDigits: digits }).format(x)} %`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dayName = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
