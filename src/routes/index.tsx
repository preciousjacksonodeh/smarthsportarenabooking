import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Banknote, Building2, CalendarDays, Clock, Dribbble, Loader2, ShieldCheck, Trophy, Users } from "lucide-react";

import { Brand } from "@/components/courtside/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  ACADEMY,
  ACADEMY_HOURS,
  CLUB,
  MEMBERSHIP_HINT,
  MEMBERSHIP_LABEL,
  MEMBERSHIPS,
  OPENING_HOURS,
  PLAY_TIMES,
  SESSIONS,
  SPORT_LABEL,
  SPORTS,
  hourLabel,
  type MembershipType,
  type PaymentType,
  type SessionSlot,
  type SportType,
} from "@/lib/club";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Register for a court session — Smart Sports Arena" },
      {
        name: "description",
        content:
          "Smart Sports Arena is open 7:00 AM to 10:00 PM. Pick basketball or football, your day and playing time, choose bank transfer or cash at court, and get your QR check-in pass.",
      },
      { property: "og:title", content: "Register for a court session — Smart Sports Arena" },
      {
        property: "og:description",
        content: "Pick your day and playing time, pay by transfer or cash, and get your QR check-in pass in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function nextDateLabel(slot: SessionSlot) {
  const lagosToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const dow = SESSIONS.find((s) => s.value === slot)?.dow ?? 0;
  const diff = (dow - lagosToday.getDay() + 7) % 7;
  const d = new Date(lagosToday);
  d.setDate(d.getDate() + diff);
  if (diff === 0) return "Today";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [sport, setSport] = useState<SportType | null>(null);
  const [session, setSession] = useState<SessionSlot | null>(null);
  const [playTime, setPlayTime] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipType | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sport) {
      toast.error("Pick basketball or football.");
      return;
    }
    if (!session) {
      toast.error("Pick a day.");
      return;
    }
    if (!playTime) {
      toast.error("Pick your playing time.");
      return;
    }
    if (!membership) {
      toast.error("Tell us if you're an old timer or a new member.");
      return;
    }
    if (!paymentType) {
      toast.error("Choose how you'll pay.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("register_player", {
      _full_name: fullName,
      _phone: phone,
      _session: session,
      _payment_type: paymentType,
      _membership: membership,
      _play_time: playTime,
      _sport: sport,
    });
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Something went wrong. Please try again.");
      return;
    }
    navigate({ to: "/ticket/$ref", params: { ref: data } });
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Court panel */}
      <section className="court-surface relative flex flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 lg:min-h-screen lg:py-10">
        <div className="flex items-center justify-between">
          <Brand inverted />
          <Link to="/admin" className="eyebrow text-court-foreground/70 hover:text-court-foreground">
            Admin
          </Link>
        </div>

        <div className="relative py-14 lg:py-0">
          <p className="eyebrow text-accent">Open daily {OPENING_HOURS}</p>
          <h1 className="font-display mt-4 text-5xl sm:text-6xl xl:text-7xl">
            Book your
            <br />
            spot on <span className="text-accent">court.</span>
          </h1>
          <p className="mt-6 max-w-sm text-lg text-court-foreground/80">
            Choose basketball or football, your day and playing time, pay by transfer or cash, and show your QR pass at the gate.
          </p>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-court-foreground">
            {SPORTS.map((sp) => (
              <span key={sp}>{SPORT_LABEL[sp]}</span>
            ))}
            <span>Monday – Sunday</span>
          </p>
          <div className="mt-6 inline-flex items-start gap-3 rounded-lg border border-court-foreground/25 px-4 py-3">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="eyebrow text-accent">Academy training</p>
              <p className="mt-1 text-sm font-semibold text-court-foreground">
                {ACADEMY.dayLabel} · {ACADEMY_HOURS}
              </p>
            </div>
          </div>
        </div>

        <ol className="hidden gap-6 text-sm text-court-foreground/80 sm:grid sm:grid-cols-3">
          {["Register", "Pay", "Scan in"].map((step, i) => (
            <li key={step} className="border-t border-court-foreground/25 pt-3">
              <span className="font-mono text-accent">0{i + 1}</span>
              <p className="mt-1 font-semibold text-court-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Form */}
      <section className="flex items-start justify-center px-5 py-10 sm:px-10 lg:items-center">
        <form onSubmit={onSubmit} className="w-full max-w-lg space-y-8 animate-pop-in">
          <div>
            <p className="eyebrow text-primary">Player registration</p>
            <h2 className="font-display mt-2 text-3xl">Your details</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Tunde Bakare"
                className="h-12 bg-card text-base"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                required
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0803 123 4567"
                className="h-12 bg-card text-base"
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Which sport?</legend>
            <div role="radiogroup" aria-label="Sport" className="grid grid-cols-2 gap-3">
              {SPORTS.map((sp) => {
                const active = sport === sp;
                const Icon = sp === "BASKETBALL" ? Dribbble : Trophy;
                return (
                  <button
                    key={sp}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSport(sp)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-2 bg-card p-4 text-left transition-all",
                      active ? "border-primary bg-secondary shadow-ticket" : "border-border hover:border-primary/40",
                    )}
                  >
                    <Icon className={cn("size-6 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-display text-lg">{SPORT_LABEL[sp]}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Which day?</legend>
            <div role="radiogroup" aria-label="Session day" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SESSIONS.map((s) => {
                const active = session === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSession(s.value)}
                    className={cn(
                      "min-w-0 rounded-lg border-2 bg-card px-3 py-3 text-left transition-all",
                      active ? "border-primary bg-secondary shadow-ticket" : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="font-display block text-base">{s.day}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{nextDateLabel(s.value)}</span>
                  </button>
                );
              })}
            </div>
            {session && ACADEMY.days.includes(session) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                Academy training runs on this day from {ACADEMY_HOURS}.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Playing time</legend>
            <div
              role="radiogroup"
              aria-label="Playing time"
              className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
              {PLAY_TIMES.map((t) => {
                const active = playTime === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPlayTime(t.value)}
                    className={cn(
                      "rounded-lg border-2 px-1 py-2.5 text-center text-sm font-medium transition-all",
                      active
                        ? "border-primary bg-secondary text-foreground shadow-ticket"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Court closes at {hourLabel(CLUB.openTo)} — last playing time is {PLAY_TIMES.at(-1)?.label}.
            </p>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Are you an old timer?</legend>
            <div role="radiogroup" aria-label="Membership" className="grid gap-3 sm:grid-cols-2">
              {MEMBERSHIPS.map((m) => {
                const active = membership === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMembership(m)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border-2 bg-card p-4 text-left transition-all",
                      active ? "border-primary bg-secondary shadow-ticket" : "border-border hover:border-primary/40",
                    )}
                  >
                    <Users className={cn("mt-0.5 size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block font-semibold">{MEMBERSHIP_LABEL[m]}</span>
                      <span className="text-sm text-muted-foreground">{MEMBERSHIP_HINT[m]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">How will you pay?</legend>
            <div role="radiogroup" aria-label="Payment type" className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "BANK_TRANSFER", title: "Bank transfer", hint: "Transfer now, we confirm", Icon: Building2 },
                  { value: "CASH_AT_COURT", title: "Cash at court", hint: "Pay an admin on arrival", Icon: Banknote },
                ] as const
              ).map(({ value, title, hint, Icon }) => {
                const active = paymentType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPaymentType(value)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border-2 bg-card p-4 text-left transition-all",
                      active ? "border-primary bg-secondary shadow-ticket" : "border-border hover:border-primary/40",
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="text-sm text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Get my pass
            <ArrowRight />
          </Button>

          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Your pass includes a QR code and a 6-digit check-in code.
          </p>
        </form>
      </section>
    </div>
  );
}
