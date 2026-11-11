import { describe, expect, it } from "vitest";
import { CLUB, MEMBERSHIP_PRICES, OPENING_HOURS, PLAY_TIMES, formatPlayTime } from "./club";

describe("Smart Arena pricing and playing hours", () => {
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
    expect(CLUB.name).toBe("Smart Arena");
    expect(OPENING_HOURS).toBe("7:00 AM – 10:00 PM");
  });

  it("reads a stored playing time back as a friendly label", () => {
    expect(formatPlayTime("19:00:00")).toBe("7:00 PM");
    expect(formatPlayTime("07:00:00")).toBe("7:00 AM");
  });
});
