import type { Database } from "@/integrations/supabase/types";

export type SessionSlot = Database["public"]["Enums"]["session_slot"];
export type PaymentType = Database["public"]["Enums"]["payment_type"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type CheckinStatus = Database["public"]["Enums"]["checkin_status"];
export type MembershipType = Database["public"]["Enums"]["membership_type"];
export type SportType = Database["public"]["Enums"]["sport_type"];

// Court details.
export const CLUB = {
  name: "Smarth Sport Arena",
  bookingTitle: "Smarth Sport Arena Booking",
  tagline: "Book your spot on court",
  currency: "NGN",
  openFrom: 7, // first playing hour, 07:00
  openTo: 22, // court closes, 22:00
  lastStart: 21, // latest playing time a player can pick, 21:00
  bank: {
    bankName: "TAJ Bank",
    accountName: "Smarth Sport Arena",
    accountNumber: "0010761765",
  },
  contactPhone: "09072163509",
};

// Opens a WhatsApp chat with the arena's contact number.
export function whatsappLink(text?: string) {
  const intl = `234${CLUB.contactPhone.replace(/^0/, "")}`;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// Price per session by membership. The server charges the same way.
export const MEMBERSHIP_PRICES: Record<MembershipType, number> = {
  OLD_TIMER: 1000,
  NEW_MEMBER: 2000,
};

// Football: old timers and new members both pay this per session.
export const FOOTBALL_PRICE = 2000;

// Hiring the whole football pitch: flat price by hours, whatever the group size.
export type HireHours = 1 | 2;
export const HIRE_PRICES: Record<HireHours, number> = { 1: 20000, 2: 35000 };
export const HIRE_OPTIONS: HireHours[] = [1, 2];
// A 2-hour hire must finish by closing time.
export function hireFits(hours: HireHours, playTime: string) {
  return Number(playTime.slice(0, 2)) + hours <= CLUB.openTo;
}

// Price for one player per session — mirrors register_player on the server.
export function playerPrice(sport: SportType, membership: MembershipType) {
  return sport === "FOOTBALL" ? FOOTBALL_PRICE : MEMBERSHIP_PRICES[membership];
}

// Total owed for a booking — mirrors register_player on the server.
export function bookingTotal(b: {
  sport: SportType;
  membership: MembershipType;
  guests: { membership: MembershipType }[];
  hireHours: HireHours | null;
}) {
  if (b.hireHours) return HIRE_PRICES[b.hireHours];
  return [b.membership, ...b.guests.map((g) => g.membership)].reduce((sum, m) => sum + playerPrice(b.sport, m), 0);
}

export function hireLabel(hours: number) {
  return `Pitch hire · ${hours} hour${hours === 1 ? "" : "s"}`;
}

export const MEMBERSHIP_LABEL: Record<MembershipType, string> = {
  OLD_TIMER: "Old timer",
  NEW_MEMBER: "New member",
};

export const MEMBERSHIP_HINT: Record<MembershipType, string> = {
  OLD_TIMER: "I've played here before",
  NEW_MEMBER: "First time at the arena",
};

export const MEMBERSHIPS: MembershipType[] = ["OLD_TIMER", "NEW_MEMBER"];

// Group bookings: one payer can add up to this many extra players.
export const MAX_GUESTS = 9;

export type Guest = { name: string; membership: MembershipType };

// Reads the stored list of extra players, ignoring anything malformed.
export function parseGuests(value: unknown): Guest[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((g) => {
    if (!g || typeof g !== "object") return [];
    const { name, membership } = g as Record<string, unknown>;
    if (typeof name !== "string" || (membership !== "OLD_TIMER" && membership !== "NEW_MEMBER")) return [];
    return [{ name, membership }];
  });
}

// Every day of the week. Tuesday/Thursday keep their original stored names.
export const SESSIONS: { value: SessionSlot; day: string; dow: number }[] = [
  { value: "MONDAY", day: "Monday", dow: 1 },
  { value: "TUESDAY_5PM", day: "Tuesday", dow: 2 },
  { value: "WEDNESDAY", day: "Wednesday", dow: 3 },
  { value: "THURSDAY_5PM", day: "Thursday", dow: 4 },
  { value: "FRIDAY", day: "Friday", dow: 5 },
  { value: "SATURDAY", day: "Saturday", dow: 6 },
  { value: "SUNDAY", day: "Sunday", dow: 0 },
];

// Academy training runs on these days and hours (shown to players as info only).
export const ACADEMY = {
  days: ["FRIDAY", "SATURDAY", "SUNDAY"] as SessionSlot[],
  dayLabel: "Fridays, Saturdays & Sundays",
  fromHour: 16,
  toHour: 18,
};

export const SPORTS: SportType[] = ["BASKETBALL", "FOOTBALL"];

export const SPORT_LABEL: Record<SportType, string> = {
  BASKETBALL: "Basketball",
  FOOTBALL: "Football",
};

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

export const ACADEMY_HOURS = `${hourLabel(ACADEMY.fromHour)} – ${hourLabel(ACADEMY.toHour)}`;

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

// WhatsApp chat link to any Nigerian number (0803... → 234803...).
export function toWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

export function whatsappTo(phone: string, text: string) {
  return `https://wa.me/${toWhatsappNumber(phone)}?text=${encodeURIComponent(text)}`;
}
