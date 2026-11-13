import { describe, expect, it } from "vitest";
import { ACADEMY, ACADEMY_HOURS, CLUB, HIRE_PRICES, MEMBERSHIP_PRICES, bookingTotal, hireFits, playerPrice, OPENING_HOURS, PLAY_TIMES, SESSIONS, SPORT_LABEL, SPORTS, formatPlayTime } from "./club";

describe("Smarth Sport Arena pricing and playing hours", () => {
  it("charges old timers ₦1,000 and new members ₦2,000 per session", () => {
    expect(MEMBERSHIP_PRICES.OLD_TIMER).toBe(1000);
    expect(MEMBERSHIP_PRICES.NEW_MEMBER).toBe(2000);
  });

  it("offers hourly playing times from 7:00 AM to 9:00 PM", () => {
    expect(PLAY_TIMES[0]).toEqual({ value: "07:00", label: "7:00 AM" });
    expect(PLAY_TIMES.at(-1)).toEqual({ value: "21:00", label: "9:00 PM" });
    expect(PLAY_TIMES).toHaveLength(15);
  });

  it("shows the court as open 7:00 AM to 10:00 PM", () => {
    expect(CLUB.name).toBe("Smarth Sport Arena");
    expect(OPENING_HOURS).toBe("7:00 AM – 10:00 PM");
  });

  it("reads a stored playing time back as a friendly label", () => {
    expect(formatPlayTime("19:00:00")).toBe("7:00 PM");
    expect(formatPlayTime("07:00:00")).toBe("7:00 AM");
  });

  it("offers sessions every day, Monday to Sunday", () => {
    expect(SESSIONS.map((s) => s.day)).toEqual([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]);
  });

  it("lets players choose basketball or football", () => {
    expect(SPORTS.map((s) => SPORT_LABEL[s])).toEqual(["Basketball", "Football"]);
  });

  it("lists academy training on Fridays, Saturdays and Sundays, 4:00 PM to 6:00 PM", () => {
    expect(ACADEMY.days).toEqual(["FRIDAY", "SATURDAY", "SUNDAY"]);
    expect(ACADEMY_HOURS).toBe("4:00 PM – 6:00 PM");
  });

  it("charges every football player ₦2,000, old timer or new member", () => {
    expect(playerPrice("FOOTBALL", "OLD_TIMER")).toBe(2000);
    expect(playerPrice("FOOTBALL", "NEW_MEMBER")).toBe(2000);
    expect(playerPrice("BASKETBALL", "OLD_TIMER")).toBe(1000);
  });

  it("prices a football pitch hire at ₦20,000 for 1 hour and ₦35,000 for 2 hours, whatever the group size", () => {
    expect(HIRE_PRICES[1]).toBe(20000);
    expect(HIRE_PRICES[2]).toBe(35000);
    const guests = [{ membership: "OLD_TIMER" as const }, { membership: "NEW_MEMBER" as const }];
    expect(bookingTotal({ sport: "FOOTBALL", membership: "OLD_TIMER", guests, hireHours: 2 })).toBe(35000);
    expect(bookingTotal({ sport: "FOOTBALL", membership: "OLD_TIMER", guests, hireHours: null })).toBe(6000);
  });

  it("only allows a 2-hour hire that ends by 10:00 PM", () => {
    expect(hireFits(2, "20:00")).toBe(true);
    expect(hireFits(2, "21:00")).toBe(false);
    expect(hireFits(1, "21:00")).toBe(true);
  });

  it("uses the arena's bank account and inquiry number", () => {
    expect(CLUB.bank.accountNumber).toBe("0010761765");
    expect(CLUB.contactPhone).toBe("09072163509");
  });
});
