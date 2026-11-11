import { describe, expect, it } from "vitest";
import { availableActions } from "./admin-actions";

describe("availableActions", () => {
  it("only lets paid players be checked in", () => {
    expect(
      availableActions({ payment_type: "CASH_AT_COURT", payment_status: "AWAITING_CASH", checkin_status: "NOT_CHECKED_IN" }).checkIn,
    ).toBe(false);
    expect(
      availableActions({ payment_type: "CASH_AT_COURT", payment_status: "PAID", checkin_status: "NOT_CHECKED_IN" }).checkIn,
    ).toBe(true);
  });

  it("does not check in someone twice", () => {
    expect(
      availableActions({ payment_type: "BANK_TRANSFER", payment_status: "PAID", checkin_status: "CHECKED_IN" }).checkIn,
    ).toBe(false);
  });

  it("offers transfer confirmation only for unpaid bank transfers", () => {
    expect(
      availableActions({ payment_type: "BANK_TRANSFER", payment_status: "PENDING_BANK_TRANSFER", checkin_status: "NOT_CHECKED_IN" }).confirmTransfer,
    ).toBe(true);
    expect(
      availableActions({ payment_type: "CASH_AT_COURT", payment_status: "AWAITING_CASH", checkin_status: "NOT_CHECKED_IN" }).confirmTransfer,
    ).toBe(false);
  });

  it("lets admins record cash for anyone who has not paid, and nobody who has", () => {
    expect(
      availableActions({ payment_type: "BANK_TRANSFER", payment_status: "UNPAID", checkin_status: "NOT_CHECKED_IN" }).recordCash,
    ).toBe(true);
    expect(
      availableActions({ payment_type: "CASH_AT_COURT", payment_status: "PAID", checkin_status: "NOT_CHECKED_IN" }).recordCash,
    ).toBe(false);
  });
});
