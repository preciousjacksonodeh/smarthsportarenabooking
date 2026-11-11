import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Building2, Check, CheckCircle2, Clock, Copy, Loader2, ShieldCheck } from "lucide-react";

import { Brand } from "@/components/courtside/Brand";
import { CheckinStatusPill, PaymentStatusPill } from "@/components/courtside/StatusPill";
import { useAdminActions } from "@/components/courtside/use-admin-actions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { availableActions } from "@/lib/admin-actions";
import { meQueryOptions } from "@/lib/auth";
import {
  CLUB,
  PAYMENT_TYPE_LABEL,
  formatDateTime,
  formatMoney,
  formatSessionDate,
  sessionLabel,
  type PaymentType,
} from "@/lib/club";

const ticketQuery = (ref: string) =>
  queryOptions({
    queryKey: ["ticket", ref],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ticket", { _ref: ref });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

export const Route = createFileRoute("/ticket/$ref")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your court pass — Courtside" },
      { name: "description", content: "Your Courtside session pass with QR code, check-in code and payment status." },
      { property: "og:title", content: "Your court pass — Courtside" },
      { property: "og:description", content: "Show this QR pass at the court to check in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const t = await context.queryClient.ensureQueryData(ticketQuery(params.ref));
    if (!t) throw notFound();
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-4xl">Pass not found</h1>
      <p className="text-muted-foreground">Check the link, or register again.</p>
      <Button asChild variant="court">
        <Link to="/">Register</Link>
      </Button>
    </div>
  ),
  component: TicketPage,
});

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-semibold">{value}</p>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="text-primary" /> : <Copy />}
      </Button>
    </div>
  );
}

function TicketPage() {
  const { ref } = Route.useParams();
  const qc = useQueryClient();
  const { data: t } = useSuspenseQuery({ ...ticketQuery(ref), refetchInterval: 15_000 });
  const { data: me } = useQuery(meQueryOptions);

  const reportSent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("report_transfer_sent", { _ref: ref });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks! An admin will confirm your transfer shortly.");
      qc.invalidateQueries({ queryKey: ["ticket", ref] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const switchType = useMutation({
    mutationFn: async (type: PaymentType) => {
      const { error } = await supabase.rpc("change_payment_type", { _ref: ref, _payment_type: type });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", ref] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!t) return null;
  const ticketUrl = typeof window !== "undefined" ? `${window.location.origin}/ticket/${t.qr_reference}` : t.qr_reference;
  const paid = t.payment_status === "PAID";
  const otherType: PaymentType = t.payment_type === "BANK_TRANSFER" ? "CASH_AT_COURT" : "BANK_TRANSFER";

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Brand />
          <span className="eyebrow text-muted-foreground">Court pass</span>
        </div>

        <article className="overflow-hidden rounded-2xl border bg-card shadow-ticket animate-pop-in">
          <header className="court-surface px-6 pb-6 pt-7">
            <p className="eyebrow text-accent">{formatSessionDate(t.session_date)}</p>
            <h1 className="font-display mt-2 text-4xl">{sessionLabel(t.session)}</h1>
            <p className="mt-3 text-lg font-semibold">{t.full_name}</p>
            <p className="text-sm text-court-foreground/70">{t.phone}</p>
          </header>

          <div className="flex flex-wrap items-center gap-2 px-6 pt-5">
            <PaymentStatusPill status={t.payment_status} />
            <CheckinStatusPill status={t.checkin_status} />
            <span className="ml-auto text-xs text-muted-foreground">{PAYMENT_TYPE_LABEL[t.payment_type]}</span>
          </div>

          <div className="flex flex-col items-center px-6 py-6">
            <div className="rounded-xl border-2 border-foreground/10 bg-card p-4 text-foreground">
              <QRCodeSVG value={ticketUrl} size={196} fgColor="currentColor" bgColor="transparent" level="M" />
            </div>
            <p className="eyebrow mt-5 text-muted-foreground">Check-in code</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-foreground">{t.checkin_code}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">Ref {t.qr_reference}</p>
          </div>

          <div className="ticket-tear mx-6" />

          <section className="space-y-4 px-6 py-6">
            {t.checkin_status === "CHECKED_IN" ? (
              <StateNote icon={<CheckCircle2 className="text-paid" />} title="You're checked in">
                Checked in {formatDateTime(t.checked_in_at)}. Enjoy the session!
              </StateNote>
            ) : paid ? (
              <StateNote icon={<ShieldCheck className="text-paid" />} title="Paid — you're all set">
                Show this QR code or your 6-digit code at the court to check in.
              </StateNote>
            ) : t.payment_status === "AWAITING_CASH" ? (
              <StateNote icon={<Banknote className="text-awaiting" />} title={`Bring ${formatMoney(t.amount_ngn)} cash`}>
                Pay an admin at the court. They'll record your payment and check you in.
              </StateNote>
            ) : t.payment_status === "PENDING_BANK_TRANSFER" ? (
              <StateNote icon={<Clock className="text-pending" />} title="Confirming your transfer">
                We've noted your transfer. This page updates once an admin confirms it.
              </StateNote>
            ) : (
              <>
                <StateNote icon={<Building2 className="text-unpaid" />} title={`Transfer ${formatMoney(t.amount_ngn)}`}>
                  Use your reference as the transfer description, then tap the button below.
                </StateNote>
                <div className="divide-y rounded-lg border bg-muted/50 px-4">
                  <CopyRow label="Bank" value={CLUB.bank.bankName} />
                  <CopyRow label="Account number" value={CLUB.bank.accountNumber} />
                  <CopyRow label="Account name" value={CLUB.bank.accountName} />
                  <CopyRow label="Description / narration" value={t.qr_reference} />
                </div>
                <Button
                  variant="hero"
                  size="xl"
                  className="w-full"
                  disabled={reportSent.isPending}
                  onClick={() => reportSent.mutate()}
                >
                  {reportSent.isPending ? <Loader2 className="animate-spin" /> : null}
                  I've sent the transfer
                </Button>
              </>
            )}

            {!paid && (
              <button
                type="button"
                className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                disabled={switchType.isPending}
                onClick={() => switchType.mutate(otherType)}
              >
                Switch to {PAYMENT_TYPE_LABEL[otherType].toLowerCase()} instead
              </button>
            )}
          </section>
        </article>

        <p className="mt-4 text-center text-xs text-muted-foreground">Bookmark this page — it's your pass.</p>

        {me?.isAdmin && <AdminTicketPanel qrRef={t.qr_reference} />}
      </div>
    </div>
  );
}

function StateNote({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 [&_svg]:size-5">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function AdminTicketPanel({ qrRef }: { qrRef: string }) {
  const { confirmTransfer, recordCash, checkIn } = useAdminActions();
  const { data: row } = useQuery({
    queryKey: ["registrations", "by-ref", qrRef],
    queryFn: async () => {
      const { data, error } = await supabase.from("registrations").select("*").eq("qr_reference", qrRef).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!row) return null;
  const a = availableActions(row);
  const busy = confirmTransfer.isPending || recordCash.isPending || checkIn.isPending;

  return (
    <section className="mt-6 rounded-2xl border-2 border-dashed border-primary/40 bg-secondary p-5">
      <p className="eyebrow text-primary">Admin</p>
      <div className="mt-3 grid gap-2">
        {a.checkIn && (
          <Button variant="court" size="lg" disabled={busy} onClick={() => checkIn.mutate(row.qr_reference)}>
            Check in {row.full_name.split(" ")[0]}
          </Button>
        )}
        {a.confirmTransfer && (
          <Button variant="outline" disabled={busy} onClick={() => confirmTransfer.mutate(row.id)}>
            Confirm bank transfer received
          </Button>
        )}
        {a.recordCash && (
          <Button variant="outline" disabled={busy} onClick={() => recordCash.mutate(row.id)}>
            Record {formatMoney(CLUB.price)} cash payment
          </Button>
        )}
        {!a.checkIn && !a.confirmTransfer && !a.recordCash && (
          <p className="text-sm text-muted-foreground">Paid and checked in. Nothing left to do.</p>
        )}
      </div>
      {row.cash_recorded_by_name && (
        <p className="mt-3 text-xs text-muted-foreground">Cash recorded by {row.cash_recorded_by_name}</p>
      )}
      {row.transfer_confirmed_by_name && (
        <p className="mt-3 text-xs text-muted-foreground">Transfer confirmed by {row.transfer_confirmed_by_name}</p>
      )}
      <Link to="/admin" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
        Open dashboard →
      </Link>
    </section>
  );
}
