import type { CheckinStatus, PaymentStatus } from "./club";

export type PassInput = {
  payment_status: PaymentStatus;
  checkin_status: CheckinStatus;
  checkin_code: string | null;
};

export type PassState = "checked_in" | "ready" | "awaiting_cash" | "pending_transfer" | "unpaid";

/**
 * What a player's public pass may show. The QR pass and 6-digit code appear only
 * after an admin has approved the payment, and disappear once the group is checked in.
 * Mirrors get_public_ticket, which only returns the code in that same window.
 */
export function passView(t: PassInput) {
  const paid = t.payment_status === "PAID";
  const checkedIn = t.checkin_status === "CHECKED_IN";
  const showCode = paid && !checkedIn && !!t.checkin_code;
  const state: PassState = checkedIn
    ? "checked_in"
    : paid
      ? "ready"
      : t.payment_status === "AWAITING_CASH"
        ? "awaiting_cash"
        : t.payment_status === "PENDING_BANK_TRANSFER"
          ? "pending_transfer"
          : "unpaid";
  return { showQr: showCode, showCode, showReceipt: paid, state };
}
