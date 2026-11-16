import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CLUB, formatMoney, formatPlayTime, formatSessionDate, PAYMENT_TYPE_LABEL, parseGuests, sessionLabel, SPORT_LABEL } from "@/lib/club";

import { BOOKING_COLUMNS, bookingLine, totalsText, type Booking } from "./bookings-digest";
import { askOnce } from "./gateway.server";
import { arenaFacts } from "./knowledge";

type AuthedContext = { supabase: SupabaseClient<Database>; userId: string };

async function assertAdmin(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Only admins can use the AI helper.");
}

function lagosToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAFF_STYLE = `You help the staff of ${CLUB.name}, a basketball and football court in Lagos. Amounts are in Naira (₦). Be brief and practical. Use short markdown: a bold heading line, then bullets. Never invent bookings, names or numbers that are not in the data. When totals are provided, use them exactly.`;

// 1. Daily summary for one session date.
export const summarizeDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => {
    if (!DATE.test(input?.date ?? "")) throw new Error("Pick a valid date.");
    return { date: input.date };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("registrations")
      .select("*")
      .eq("session_date", data.date)
      .order("play_time");
    if (error) throw new Error("Couldn't load bookings for that day.");
    const list = (rows ?? []) as Booking[];
    if (list.length === 0) return { text: `**No bookings for ${formatSessionDate(data.date)} yet.**` };

    const text = await askOnce({
      effort: "medium",
      instructions: `${STAFF_STYLE}
Write a daily report for the manager. Include: headline numbers, money collected vs still owed, who still needs to pay (name, amount, method), busiest playing times, check-ins, and 1–2 practical tips for the day (e.g. chase pending transfers, prepare change for cash). Max ~180 words.`,
      prompt: `Date: ${formatSessionDate(data.date)} (${data.date})
Exact totals:
${totalsText(list)}

${BOOKING_COLUMNS}
${list.map(bookingLine).join("\n")}`,
    });
    return { text };
  });

// 2. Free-form question about recent and upcoming bookings.
export const askAboutBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { question: string }) => {
    const question = String(input?.question ?? "").trim();
    if (!question) throw new Error("Type a question first.");
    if (question.length > 500) throw new Error("Please keep the question under 500 characters.");
    return { question };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const today = lagosToday();
    const from = shiftDate(today, -30);
    const { data: rows, error } = await context.supabase
      .from("registrations")
      .select("*")
      .gte("session_date", from)
      .order("session_date")
      .order("play_time")
      .limit(600);
    if (error) throw new Error("Couldn't load bookings.");
    const list = (rows ?? []) as Booking[];

    const text = await askOnce({
      effort: "medium",
      instructions: `${STAFF_STYLE}
Answer the staff member's question using only the bookings below (last 30 days and all upcoming). If the data can't answer it, say so plainly. Today in Lagos is ${today}. Arena facts:
${arenaFacts()}`,
      prompt: `Question: ${data.question}

Exact totals for all bookings listed:
${totalsText(list)}

${BOOKING_COLUMNS}
${list.length ? list.map(bookingLine).join("\n") : "(no bookings)"}`,
    });
    return { text };
  });

// 3. WhatsApp reminder for one booking.
export const writeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; kind: "payment" | "session" }) => {
    if (typeof input?.id !== "string" || !input.id) throw new Error("Pick a booking.");
    if (input.kind !== "payment" && input.kind !== "session") throw new Error("Pick a reminder type.");
    return { id: input.id, kind: input.kind };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("registrations").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Couldn't find that booking.");
    const r = row as Booking;
    const guests = parseGuests(r.guests);
    const firstName = r.full_name.split(/\s+/)[0];

    const details = [
      `Player first name: ${firstName}`,
      guests.length ? `Also booked for: ${guests.map((g) => g.name).join(", ")}` : "",
      `Sport: ${SPORT_LABEL[r.sport]}`,
      `When: ${sessionLabel(r.session)} ${formatSessionDate(r.session_date)} at ${formatPlayTime(r.play_time)}`,
      `Amount: ${formatMoney(r.amount_ngn)}`,
      `Payment method: ${PAYMENT_TYPE_LABEL[r.payment_type]}`,
      `Payment status: ${r.payment_status}`,
      `Check-in code: ${r.checkin_code}`,
    ]
      .filter(Boolean)
      .join("\n");

    const goal =
      data.kind === "payment"
        ? r.payment_type === "BANK_TRANSFER"
          ? `Politely remind them to complete the bank transfer: ${CLUB.bank.bankName}, account ${CLUB.bank.accountNumber} (${CLUB.bank.accountName}), then send the receipt on WhatsApp to ${CLUB.contactPhone}.`
          : "Politely remind them to bring the cash to pay at the court before playing."
        : "Remind them of their upcoming session and to show their QR pass or check-in code at the gate.";

    const text = await askOnce({
      effort: "low",
      instructions: `You write short, friendly WhatsApp messages from ${CLUB.name} (Lagos) to players. Plain text only, no markdown, at most 3 short paragraphs and under 70 words. A light, warm Nigerian-English tone is fine; one emoji at most. Sign off as "${CLUB.name}". Use only the details given.`,
      prompt: `${goal}\n\nBooking details:\n${details}\nInquiries: ${CLUB.contactPhone}`,
    });
    return { text, phone: r.phone, name: r.full_name };
  });
