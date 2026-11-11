import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Banknote, Building2, Loader2, ShieldCheck } from "lucide-react";

import { Brand } from "@/components/courtside/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CLUB, SESSIONS, formatMoney, type PaymentType, type SessionSlot } from "@/lib/club";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Register for a court session — Courtside" },
      {
        name: "description",
        content: "Pick Tuesday, Thursday, Saturday or Sunday, choose bank transfer or cash at court, and get your QR check-in pass.",
      },
      { property: "og:title", content: "Register for a court session — Courtside" },
      {
        property: "og:description",
        content: "Pick your session, choose how to pay, and get your QR check-in pass in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

const DOW: Record<SessionSlot, number> = { TUESDAY_5PM: 2, THURSDAY_5PM: 4, SATURDAY: 6, SUNDAY: 0 };

function nextDateLabel(slot: SessionSlot) {
  const lagosToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const diff = (DOW[slot] - lagosToday.getDay() + 7) % 7;
  const d = new Date(lagosToday);
  d.setDate(d.getDate() + diff);
  if (diff === 0) return "Today";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [session, setSession] = useState<SessionSlot | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return toast.error("Pick a session.");
    if (!paymentType) return toast.error("Choose how you'll pay.");
    setSubmitting(true);
    const { data, error } = await supabase.rpc("register_player", {
      _full_name: fullName,
      _phone: phone,
      _session: session,
      _payment_type: paymentType,
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
          <p className="eyebrow text-accent">Weekly sessions · {formatMoney(CLUB.price)}</p>
          <h1 className="font-display mt-4 text-5xl sm:text-6xl xl:text-7xl">
            Book your
            <br />
            spot on <span className="text-accent">court.</span>
          </h1>
          <p className="mt-6 max-w-sm text-lg text-court-foreground/80">
            Register, pay by transfer or cash, and show your QR pass at the gate.
          </p>
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
            <legend className="text-sm font-semibold">Session</legend>
            <div role="radiogroup" aria-label="Session" className="grid grid-cols-2 gap-3">
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
                      "rounded-lg border-2 bg-card p-4 text-left transition-all",
                      active ? "border-primary bg-secondary shadow-ticket" : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="font-display block text-lg">{s.day}</span>
                    <span className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{s.time ?? "All day"}</span>
                      <span className="font-mono text-xs">{nextDateLabel(s.value)}</span>
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
