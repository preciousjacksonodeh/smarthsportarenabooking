import type { CheckinStatus, PaymentStatus, PaymentType } from "./club";

export type ActionInput = {
  payment_type: PaymentType;
  payment_status: PaymentStatus;
  checkin_status: CheckinStatus;
};

/** Which admin buttons a registration row offers. */
export function availableActions(r: ActionInput) {
  const paid = r.payment_status === "PAID";
  return {
    confirmTransfer: !paid && r.payment_type === "BANK_TRANSFER",
    recordCash: !paid,
    checkIn: paid && r.checkin_status === "NOT_CHECKED_IN",
  };
}
