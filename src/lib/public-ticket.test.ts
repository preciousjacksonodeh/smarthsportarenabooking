import { describe, expect, it } from "vitest";
import { passView } from "./public-ticket";

describe("passView — QR pass only after an admin approves payment", () => {
  it("hides the QR pass and code while a bank transfer is unpaid", () => {
    const v = passView({ payment_status: "UNPAID", checkin_status: "NOT_CHECKED_IN", checkin_code: null });
    expect(v.showQr).toBe(false);
    expect(v.showCode).toBe(false);
  });

  it("hides the QR pass while a reported transfer waits for admin approval", () => {
    const v = passView({ payment_status: "PENDING_BANK_TRANSFER", checkin_status: "NOT_CHECKED_IN", checkin_code: null });
    expect(v.showQr).toBe(false);
    expect(v.state).toBe("pending_transfer");
  });

  it("hides the QR pass while cash has not been recorded by an admin", () => {
    const v = passView({ payment_status: "AWAITING_CASH", checkin_status: "NOT_CHECKED_IN", checkin_code: null });
    expect(v.showQr).toBe(false);
  });

  it("never shows the QR pass for an unpaid booking, even if a code slipped through", () => {
    expect(passView({ payment_status: "UNPAID", checkin_status: "NOT_CHECKED_IN", checkin_code: "123456" }).showCode).toBe(false);
  });

  it("shows the QR pass and code once an admin has approved the payment", () => {
    const v = passView({ payment_status: "PAID", checkin_status: "NOT_CHECKED_IN", checkin_code: "123456" });
    expect(v.showQr).toBe(true);
    expect(v.showCode).toBe(true);
  });

  it("stops showing the code after check-in", () => {
    const v = passView({ payment_status: "PAID", checkin_status: "CHECKED_IN", checkin_code: null });
    expect(v.showCode).toBe(false);
    expect(v.state).toBe("checked_in");
  });

  it("offers a receipt only for paid bookings", () => {
    expect(passView({ payment_status: "PAID", checkin_status: "NOT_CHECKED_IN", checkin_code: "1" }).showReceipt).toBe(true);
    expect(passView({ payment_status: "PENDING_BANK_TRANSFER", checkin_status: "NOT_CHECKED_IN", checkin_code: null }).showReceipt).toBe(false);
  });
});
