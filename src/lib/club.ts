import type { Database } from "@/integrations/supabase/types";

export type SessionSlot = Database["public"]["Enums"]["session_slot"];
export type PaymentType = Database["public"]["Enums"]["payment_type"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type CheckinStatus = Database["public"]["Enums"]["checkin_status"];

// Placeholder club details — replace with the real ones.
export const CLUB = {
  name: "Courtside",
  tagline: "Book your spot on court",
  price: 5000,
  currency: "NGN",
  bank: {
    bankName: "Your Bank",
    accountName: "Courtside Sports Club",
    accountNumber: "0123456789",
  },
};

export const SESSIONS: { value: SessionSlot; day: string; time?: string }[] = [
  { value: "TUESDAY_5PM", day: "Tuesday", time: "5 PM" },
  { value: "THURSDAY_5PM", day: "Thursday", time: "5 PM" },
  { value: "SATURDAY", day: "Saturday" },
  { value: "SUNDAY", day: "Sunday" },
];

export function sessionLabel(slot: SessionSlot) {
  const s = SESSIONS.find((x) => x.value === slot);
  if (!s) return slot;
  return s.time ? `${s.day} ${s.time}` : s.day;
}

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH_AT_COURT: "Cash at court",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PENDING_BANK_TRANSFER: "Pending bank transfer",
  AWAITING_CASH: "Awaiting cash",
  PAID: "Paid",
};

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = {
  NOT_CHECKED_IN: "Not checked in",
  CHECKED_IN: "Checked in",
};

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: CLUB.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSessionDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
