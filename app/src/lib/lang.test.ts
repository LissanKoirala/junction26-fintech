// Language regressions: text built outside t() must follow the selected language, and state written in one language
// must not be shown in the other.
import { afterEach, describe, expect, it } from "vitest";
import { setLang, t } from "@shared/i18n";
import { dateDM, dateFi } from "./format";
import { chatThread } from "@/features/chat/store";

afterEach(() => setLang("en"));

describe("dates follow the app language", () => {
  it("full dates", () => {
    expect(dateFi("2026-09-30")).toBe("30 Sep 2026");
    setLang("fi");
    expect(dateFi("2026-09-30")).toBe("30.9.2026");
  });
  it("day and month", () => {
    expect(dateDM("2026-10-15")).toBe("15 Oct");
    setLang("fi");
    expect(dateDM("2026-10-15")).toBe("15.10.");
  });
});

describe("bank shell labels", () => {
  it("are English keys with the S-mobiili Finnish names", () => {
    expect(t("Home")).toBe("Home");
    setLang("fi");
    expect([t("Home"), t("Payment"), t("Bank"), t("Me"), t("Pay a bill"), t("As of {date}", { date: "30.9.2026" })]).toEqual([
      "Koti", "Maksu", "Pankki", "Minä", "Maksa lasku", "Tilanne 30.9.2026",
    ]);
  });
});

describe("chat threads", () => {
  it("are kept per customer and language", () => {
    expect(chatThread("CUST04754", "en")).not.toBe(chatThread("CUST04754", "fi"));
    expect(chatThread("CUST04754", "en")).not.toBe(chatThread("CUST01408", "en"));
  });
});
