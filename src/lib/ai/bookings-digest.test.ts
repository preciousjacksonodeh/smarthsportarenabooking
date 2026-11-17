import { describe, expect, it } from "vitest";

import { bookingTotals, type Booking } from "./bookings-digest";
import { toWhatsappNumber } from "@/lib/club";

const base = { guests: [], payment_type: "CASH_AT_COURT", checkin_status: "NOT_CHECKED_IN", sport: "BASKETBALL" } as const;
const row = (r: Partial<Booking>) => ({ ...base, ...r }) as Booking;

describe("admin AI totals", () => {
  it("counts only paid bookings as collected and the rest as outstanding", () => {
    const t = bookingTotals([
      row({ payment_status: "PAID", amount_ngn: 2000 }),
      row({ payment_status: "PAID", payment_type: "BANK_TRANSFER", amount_ngn: 20000 }),
      row({ payment_status: "PENDING_BANK_TRANSFER", amount_ngn: 1000 }),
    ]);
    expect(t.collected).toBe(22000);
    expect(t.collectedCash).toBe(2000);
    expect(t.collectedTransfer).toBe(20000);
    expect(t.outstanding).toBe(1000);
  });

  it("counts every listed guest as a player", () => {
    const t = bookingTotals([row({ payment_status: "UNPAID", amount_ngn: 4000, guests: [{ name: "Ada", membership: "OLD_TIMER" }] })]);
    expect(t.players).toBe(2);
  });
});

describe("WhatsApp numbers", () => {
  it("turns a local Nigerian number into the international form", () => {
    expect(toWhatsappNumber("08030000000")).toBe("2348030000000");
    expect(toWhatsappNumber("+234 803 000 0000")).toBe("2348030000000");
  });
});
