import type { Database } from "@/integrations/supabase/types";

export type SessionSlot = Database["public"]["Enums"]["session_slot"];
export type PaymentType = Database["public"]["Enums"]["payment_type"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type CheckinStatus = Database["public"]["Enums"]["checkin_status"];
export type MembershipType = Database["public"]["Enums"]["membership_type"];

// Court details. Bank details are placeholders — replace with the real ones.
export const CLUB = {
  name: "Smart Arena",
  tagline: "Book your spot on court",
  currency: "NGN",
  openFrom: 7, // first playing hour, 07:00
  openTo: 22, // court closes, 22:00
  lastStart: 21, // latest playing time a player can pick, 21:00
  bank: {
    bankName: "Your Bank",
    accountName: "Smart Arena",
    accountNumber: "0123456789",
  },
};

// Price per session by membership. The server charges the same way.
export const MEMBERSHIP_PRICES: Record<MembershipType, number> = {
  OLD_TIMER: 1000,
  NEW_MEMBER: 2000,
};

export const MEMBERSHIP_LABEL: Record<MembershipType, string> = {
  OLD_TIMER: "Old timer",
  NEW_MEMBER: "New member",
};

export const MEMBERSHIP_HINT: Record<MembershipType, string> = {
  OLD_TIMER: "I've played here before",
  NEW_MEMBER: "First time at the arena",
};

export const MEMBERSHIPS: MembershipType[] = ["OLD_TIMER", "NEW_MEMBER"];

export const SESSIONS: { value: SessionSlot; day: string }[] = [
  { value: "TUESDAY_5PM", day: "Tuesday" },
  { value: "THURSDAY_5PM", day: "Thursday" },
  { value: "SATURDAY", day: "Saturday" },
  { value: "SUNDAY", day: "Sunday" },
];

export function sessionLabel(slot: SessionSlot) {
  return SESSIONS.find((x) => x.value === slot)?.day ?? slot;
}

export function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${suffix}`;
}

// Hourly playing times on offer: 7:00 AM through 9:00 PM.
export const PLAY_TIMES: { value: string; label: string }[] = Array.from(
  { length: CLUB.lastStart - CLUB.openFrom + 1 },
  (_, i) => {
    const hour = CLUB.openFrom + i;
    return { value: `${String(hour).padStart(2, "0")}:00`, label: hourLabel(hour) };
  },
);

export const OPENING_HOURS = `${hourLabel(CLUB.openFrom)} – ${hourLabel(CLUB.openTo)}`;

export function formatPlayTime(time: string | null) {
  if (!time) return "—";
  const hour = Number(time.slice(0, 2));
  return Number.isNaN(hour) ? time : hourLabel(hour);
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
