import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, MessageCircle, Printer } from "lucide-react";

import logo from "@/assets/smart_sports_arena_logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQueryOptions } from "@/lib/auth";
import {
  CLUB,
  MEMBERSHIP_LABEL,
  PAYMENT_TYPE_LABEL,
  SPORT_LABEL,
  formatDateTime,
  formatMoney,
  formatPlayTime,
  formatSessionDate,
  hireLabel,
  parseGuests,
  whatsappLink,
} from "@/lib/club";

const receiptQuery = (ref: string) =>
  queryOptions({
    queryKey: ["ticket", ref],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_ticket", { _ref: ref });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

export const Route = createFileRoute("/receipt/$ref")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Payment receipt — Smarth Sport Arena" },
      { name: "description", content: "Your Smarth Sport Arena payment receipt for a basketball or football session." },
      { property: "og:title", content: "Payment receipt — Smarth Sport Arena" },
      { property: "og:description", content: "Proof of payment for your Smarth Sport Arena booking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const t = await context.queryClient.ensureQueryData(receiptQuery(params.ref));
    if (!t) throw notFound();
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-4xl">Receipt not found</h1>
      <p className="text-muted-foreground">Check the link on your pass.</p>
      <Button asChild variant="court">
        <Link to="/">Book a session</Link>
      </Button>
    </div>
  ),
  component: ReceiptPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function ReceiptPage() {
  const { ref } = Route.useParams();
  const { data: t } = useSuspenseQuery(receiptQuery(ref));
  const { data: me } = useQuery(meQueryOptions);
  const isAdmin = !!me?.isAdmin;
  // Phone, every player's name and the receiving admin are staff-only details.
  const { data: full } = useQuery({
    queryKey: ["registrations", "by-ref", t?.qr_reference ?? ref],
    enabled: isAdmin && !!t,
    queryFn: async () => {
      const { data, error } = await supabase.from("registrations").select("*").eq("qr_reference", t!.qr_reference).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!t) return null;
  const guests = full ? parseGuests(full.guests) : [];
  const receivedBy = full ? (full.cash_recorded_by_name ?? full.transfer_confirmed_by_name) : null;

  if (t.payment_status !== "PAID") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-4xl">No receipt yet</h1>
        <p className="max-w-sm text-muted-foreground">
          Your receipt appears here once an admin confirms your payment of {formatMoney(t.amount_ngn)}.
        </p>
        <Button asChild variant="court">
          <Link to="/ticket/$ref" params={{ ref: t.qr_reference }}>
            Back to my pass
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:py-10 print:p-0">
      <div className="mx-auto mb-5 flex max-w-md flex-wrap items-center justify-between gap-2 print:hidden">
        {isAdmin ? (
          <Link to="/admin" className="text-sm font-semibold text-primary hover:underline">
            ← Dashboard
          </Link>
        ) : (
          <Link to="/ticket/$ref" params={{ ref: t.qr_reference }} className="text-sm font-semibold text-primary hover:underline">
            ← My pass
          </Link>
        )}
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={whatsappLink(
                `${CLUB.name} payment receipt ${t.qr_reference}: ${formatMoney(t.amount_ngn)} paid on ${formatDateTime(t.paid_at)} for ${SPORT_LABEL[t.sport]}, ${formatSessionDate(t.session_date)} ${formatPlayTime(t.play_time)}.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Share
            </a>
          </Button>
          <Button variant="court" size="sm" onClick={() => window.print()}>
            <Printer /> Print / save PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-ticket print:max-w-none print:border-0 print:shadow-none">
        <header className="flex items-center gap-3 border-b pb-4">
          <img src={logo.url} alt={`${CLUB.name} logo`} width={48} height={48} className="size-12 rounded-full object-cover" />
          <div>
            <p className="font-display text-xl">{CLUB.name}</p>
            <p className="text-xs text-muted-foreground">Inquiries: {CLUB.contactPhone}</p>
          </div>
        </header>

        <div className="py-5 text-center">
          <p className="eyebrow text-muted-foreground">Payment receipt</p>
          <p className="font-display mt-2 text-4xl">{formatMoney(t.amount_ngn)}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-paid">
            <CheckCircle2 className="size-4" /> Paid
          </p>
        </div>

        <dl className="divide-y border-y">
          <Row label="Receipt no." value={<span className="font-mono">{t.qr_reference}</span>} />
          <Row label="Paid on" value={formatDateTime(t.paid_at)} />
          <Row label="Payment method" value={PAYMENT_TYPE_LABEL[t.payment_type]} />
          {receivedBy && <Row label="Received by" value={receivedBy} />}
          <Row label="Paid by" value={full ? `${full.full_name} · ${full.phone}` : t.holder_name} />
          <Row label="Sport" value={SPORT_LABEL[t.sport]} />
          <Row
            label="Session"
            value={`${formatSessionDate(t.session_date)}, ${formatPlayTime(t.play_time)}`}
          />
          <Row
            label="Booking"
            value={t.hire_hours ? hireLabel(t.hire_hours) : t.guest_count > 0 ? `${t.guest_count + 1} players` : MEMBERSHIP_LABEL[t.membership]}
          />
        </dl>

        {guests.length > 0 && (
          <div className="pt-4 text-sm">
            <p className="font-semibold">Players</p>
            <ol className="mt-1 list-decimal pl-5 text-muted-foreground">
              <li>{full?.full_name}</li>
              {guests.map((g, i) => (
                <li key={i}>{g.name}</li>
              ))}
            </ol>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Thank you for playing at {CLUB.name}. For more inquiries, contact {CLUB.contactPhone}.
        </p>
      </article>
    </div>
  );
}
