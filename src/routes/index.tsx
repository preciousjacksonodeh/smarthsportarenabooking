import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Banknote, Building2, CalendarDays, Clock, Dribbble, Loader2, Phone, ShieldCheck, Trophy, UserPlus, Users, X } from "lucide-react";

import { Brand } from "@/components/courtside/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  ACADEMY,
  ACADEMY_HOURS,
  CLUB,
  HIRE_OPTIONS,
  HIRE_PRICES,
  MEMBERSHIP_HINT,
  MEMBERSHIP_LABEL,
  MAX_GUESTS,
  MEMBERSHIPS,
  OPENING_HOURS,
  PLAY_TIMES,
  SESSIONS,
  SPORT_LABEL,
  SPORTS,
  formatMoney,
  hireFits,
  hourLabel,
  type HireHours,
  type Guest,
  type MembershipType,
  type PaymentType,
  type SessionSlot,
  type SportType,
} from "@/lib/club";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Register for a court session — Smarth Sport Arena" },
      {
        name: "description",
        content:
          "Smarth Sport Arena is open 7:00 AM to 10:00 PM. Pick basketball or football, your day and playing time, choose bank transfer or cash at court, and get your QR check-in pass.",
      },
      { property: "og:title", content: "Register for a court session — Smarth Sport Arena" },
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
  const [hireHours, setHireHours] = useState<HireHours | null>(null);
  const [guests, setGuests] = useState<{ name: string; membership: MembershipType | null }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function updateGuest(i: number, patch: Partial<{ name: string; membership: MembershipType | null }>) {
    setGuests((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  }

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
    if (hireHours && !hireFits(hireHours, playTime)) {
      toast.error(`A ${hireHours}-hour hire must finish by ${hourLabel(CLUB.openTo)}. Pick an earlier time.`);
      return;
    }
    if (!membership) {
      toast.error("Tell us if you're an old timer or a new member.");
      return;
    }
    for (const [i, g] of guests.entries()) {
      if (g.name.trim().length < 2) {
        toast.error(`Enter the full name of player ${i + 2}.`);
        return;
      }
      if (!g.membership) {
        toast.error(`Is ${g.name.trim()} an old timer or a new member?`);
        return;
      }
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
      _guests: guests.map((g): Guest => ({ name: g.name.trim(), membership: g.membership as MembershipType })),
      ...(sport === "FOOTBALL" && hireHours ? { _hire_hours: hireHours } : {}),
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
            Show your QR pass at the gate.
          </p>
          <p className="mt-2 text-sm text-court-foreground/80">
            Inquiries:{" "}
            <a href={`tel:${CLUB.contactPhone}`} className="font-semibold text-court-foreground hover:text-accent">
              {CLUB.contactPhone}
            </a>
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
                    onClick={() => {
                      setSport(sp);
                      if (sp !== "FOOTBALL") setHireHours(null);
                    }}
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

          {sport === "FOOTBALL" && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Booking type</legend>
              <div role="radiogroup" aria-label="Booking type" className="grid gap-3 sm:grid-cols-3">
                {([null, ...HIRE_OPTIONS] as (HireHours | null)[]).map((h) => {
                  const active = hireHours === h;
                  return (
                    <button
                      key={h ?? "player"}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setHireHours(h)}
                      className={cn(
                        "rounded-lg border-2 bg-card p-3 text-left transition-all",
                        active ? "border-primary bg-secondary shadow-ticket" : "border-border hover:border-primary/40",
                      )}
                    >
                      <span className="block font-semibold">{h ? `Hire pitch · ${h} hour${h === 1 ? "" : "s"}` : "Pay per player"}</span>
                      <span className="text-sm text-muted-foreground">
                        {h ? `${formatMoney(HIRE_PRICES[h])} flat` : "Join a session"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {hireHours && (
                <p className="text-xs text-muted-foreground">
                  The whole pitch is yours for {hireHours} hour{hireHours === 1 ? "" : "s"}. List your players below if you like — the price stays the same.
                </p>
              )}
            </fieldset>
          )}

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
                const blocked = hireHours !== null && !hireFits(hireHours, t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={blocked}
                    onClick={() => setPlayTime(t.value)}
                    className={cn(
                      "rounded-lg border-2 px-1 py-2.5 text-center text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
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
            <legend className="text-sm font-semibold">
              {hireHours ? "Who's playing with you?" : "Paying for other players too?"}
            </legend>
            <p className="text-sm text-muted-foreground">
              Add each friend's name. You pay once and one pass checks the whole group in.
            </p>
            {guests.length > 0 && (
              <ol className="space-y-3">
                {guests.map((g, i) => (
                  <li key={i} className="space-y-2 rounded-lg border-2 border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{i + 2}</span>
                      <Input
                        aria-label={`Player ${i + 2} full name`}
                        required
                        value={g.name}
                        onChange={(e) => updateGuest(i, { name: e.target.value })}
                        placeholder="Player's full name"
                        className="h-11 bg-background text-base"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove player ${i + 2}`}
                        onClick={() => setGuests((gs) => gs.filter((_, j) => j !== i))}
                      >
                        <X />
                      </Button>
                    </div>
                    <div role="radiogroup" aria-label={`Player ${i + 2} membership`} className="grid grid-cols-2 gap-2">
                      {MEMBERSHIPS.map((m) => {
                        const active = g.membership === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => updateGuest(i, { membership: m })}
                            className={cn(
                              "rounded-md border-2 px-2 py-2 text-sm font-medium transition-all",
                              active
                                ? "border-primary bg-secondary text-foreground"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40",
                            )}
                          >
                            {MEMBERSHIP_LABEL[m]}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {guests.length < MAX_GUESTS && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setGuests((gs) => [...gs, { name: "", membership: null }])}
              >
                <UserPlus />
                Add a player
              </Button>
            )}
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
            {guests.length > 0 ? `Get our pass (${guests.length + 1} players)` : "Get my pass"}
            <ArrowRight />
          </Button>

          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Your pass includes a QR code and a 6-digit check-in code.
          </p>
          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Phone className="size-3.5" />
            For more inquiries, contact
            <a href={`tel:${CLUB.contactPhone}`} className="font-semibold text-foreground hover:text-primary">
              {CLUB.contactPhone}
            </a>
          </p>
        </form>
      </section>
    </div>
  );
}
