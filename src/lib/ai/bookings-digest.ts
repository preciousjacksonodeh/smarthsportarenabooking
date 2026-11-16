// Turns booking rows into compact text + exact totals for the admin AI helpers.
// Totals are computed here (not by the AI) so money figures are always right.
import type { Tables } from "@/integrations/supabase/types";
import {
  CHECKIN_STATUS_LABEL,
  MEMBERSHIP_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPE_LABEL,
  SPORT_LABEL,
  formatMoney,
  formatPlayTime,
  hireLabel,
  parseGuests,
  sessionLabel,
} from "@/lib/club";

export type Booking = Tables<"registrations">;

export function bookingLine(r: Booking) {
  const guests = parseGuests(r.guests);
  const who = guests.length ? `${r.full_name} + ${guests.map((g) => g.name).join(", ")}` : r.full_name;
  const kind = r.hire_hours ? hireLabel(r.hire_hours) : MEMBERSHIP_LABEL[r.membership];
  const recorded = r.cash_recorded_by_name
    ? ` | cash recorded by ${r.cash_recorded_by_name}`
    : r.transfer_confirmed_by_name
      ? ` | transfer confirmed by ${r.transfer_confirmed_by_name}`
      : "";
  return [
    r.session_date,
    sessionLabel(r.session),
    formatPlayTime(r.play_time),
    SPORT_LABEL[r.sport],
    who,
    `${1 + guests.length} player(s)`,
    r.phone,
    kind,
    PAYMENT_TYPE_LABEL[r.payment_type],
    PAYMENT_STATUS_LABEL[r.payment_status],
    formatMoney(r.amount_ngn),
    CHECKIN_STATUS_LABEL[r.checkin_status],
    `code ${r.checkin_code}`,
  ].join(" | ") + recorded;
}

export function bookingTotals(rows: Booking[]) {
  const paid = rows.filter((r) => r.payment_status === "PAID");
  const unpaid = rows.filter((r) => r.payment_status !== "PAID");
  return {
    bookings: rows.length,
    players: rows.reduce((n, r) => n + 1 + parseGuests(r.guests).length, 0),
    paidBookings: paid.length,
    collected: paid.reduce((n, r) => n + r.amount_ngn, 0),
    collectedCash: paid.filter((r) => r.payment_type === "CASH_AT_COURT").reduce((n, r) => n + r.amount_ngn, 0),
    collectedTransfer: paid.filter((r) => r.payment_type === "BANK_TRANSFER").reduce((n, r) => n + r.amount_ngn, 0),
    outstanding: unpaid.reduce((n, r) => n + r.amount_ngn, 0),
    unpaidBookings: unpaid.length,
    checkedIn: rows.filter((r) => r.checkin_status === "CHECKED_IN").length,
    basketball: rows.filter((r) => r.sport === "BASKETBALL").length,
    football: rows.filter((r) => r.sport === "FOOTBALL").length,
  };
}

export function totalsText(rows: Booking[]) {
  const t = bookingTotals(rows);
  return [
    `Bookings: ${t.bookings} (${t.players} players; basketball ${t.basketball}, football ${t.football})`,
    `Paid: ${t.paidBookings} bookings, ${formatMoney(t.collected)} collected (cash ${formatMoney(t.collectedCash)}, transfer ${formatMoney(t.collectedTransfer)})`,
    `Not yet paid: ${t.unpaidBookings} bookings, ${formatMoney(t.outstanding)} outstanding`,
    `Checked in: ${t.checkedIn} of ${t.bookings}`,
  ].join("\n");
}

export const BOOKING_COLUMNS =
  "Columns: date | day | time | sport | name(s) | players | phone | membership or hire | payment method | payment status | amount | check-in | code";
