import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, Building2, Loader2, LogOut, ScanLine, Search, ShieldOff } from "lucide-react";

import { Brand } from "@/components/courtside/Brand";
import { CheckinStatusPill, PaymentStatusPill } from "@/components/courtside/StatusPill";
import { useAdminActions } from "@/components/courtside/use-admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { availableActions } from "@/lib/admin-actions";
import { meQueryOptions } from "@/lib/auth";
import {
  MEMBERSHIP_LABEL,
  MEMBERSHIPS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPE_LABEL,
  SESSIONS,
  formatDateTime,
  formatMoney,
  formatPlayTime,
  formatSessionDate,
  sessionLabel,
  type MembershipType,
  type PaymentStatus,
  type SessionSlot,
} from "@/lib/club";
import { cn } from "@/lib/utils";

type Registration = Tables<"registrations">;
type Range = "upcoming" | "past" | "all";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Smart Arena" },
      { name: "description", content: "Confirm transfers, record cash payments and check players in for every Smart Arena session." },
      { property: "og:title", content: "Admin dashboard — Smart Arena" },
      { property: "og:description", content: "Smart Arena payments and check-in dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function lagosToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

const registrationsQuery = (range: Range) =>
  queryOptions({
    queryKey: ["registrations", "list", range],
    queryFn: async () => {
      let q = supabase.from("registrations").select("*").order("session_date", { ascending: range !== "past" }).order("created_at", { ascending: false });
      if (range === "upcoming") q = q.gte("session_date", lagosToday());
      if (range === "past") q = q.lt("session_date", lagosToday());
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

function AdminPage() {
  const { data: me, isLoading } = useQuery(meQueryOptions);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (isLoading || !me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="court-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Brand inverted />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-court-foreground/80 sm:inline">{me.displayName}</span>
            <Button size="sm" variant="ghost" className="text-court-foreground hover:bg-court-foreground/10 hover:text-court-foreground" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </header>

      {me.isAdmin ? (
        <Dashboard myId={me.id} />
      ) : (
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <ShieldOff className="mx-auto size-10 text-muted-foreground" />
          <h1 className="font-display mt-4 text-3xl">Waiting for access</h1>
          <p className="mt-2 text-muted-foreground">
            You're signed in as {me.email}. Ask an existing admin to give you access from the Staff tab.
          </p>
        </div>
      )}
    </div>
  );
}

function Dashboard({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>("upcoming");
  const { data: rows = [], isLoading } = useQuery(registrationsQuery(range));

  // Live updates when anyone registers, pays or checks in.
  useEffect(() => {
    const channel = supabase
      .channel(`registrations-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, () => {
        qc.invalidateQueries({ queryKey: ["registrations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <CheckInBar />
      <Tabs defaultValue="players">
        <TabsList>
          <TabsTrigger value="players">Players & payments</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>
        <TabsContent value="players" className="mt-5 space-y-5">
          <div className="flex gap-2">
            {(["upcoming", "past", "all"] as Range[]).map((r) => (
              <Chip key={r} active={range === r} onClick={() => setRange(r)}>
                {r === "upcoming" ? "Upcoming" : r === "past" ? "Past" : "All dates"}
              </Chip>
            ))}
          </div>
          <Stats rows={rows} />
          <RegistrationList rows={rows} loading={isLoading} />
        </TabsContent>
        <TabsContent value="staff" className="mt-5">
          <StaffPanel myId={myId} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

function CheckInBar() {
  const [code, setCode] = useState("");
  const { checkIn } = useAdminActions();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        checkIn.mutate(code, { onSuccess: () => setCode("") });
      }}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-ticket sm:flex-row sm:items-center sm:p-5"
    >
      <div className="flex items-center gap-3 sm:w-56">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <ScanLine className="size-5" />
        </span>
        <div>
          <p className="font-display text-lg">Check in</p>
          <p className="text-xs text-muted-foreground">6-digit code or reference</p>
        </div>
      </div>
      <Input
        aria-label="Check-in code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="text"
        autoComplete="off"
        placeholder="e.g. 482915"
        className="h-12 flex-1 bg-background font-mono text-xl tracking-[0.2em]"
      />
      <Button type="submit" variant="court" size="lg" className="h-12" disabled={checkIn.isPending}>
        {checkIn.isPending && <Loader2 className="animate-spin" />}
        Check in
      </Button>
    </form>
  );
}

function Stats({ rows }: { rows: Registration[] }) {
  const s = useMemo(() => {
    const paid = rows.filter((r) => r.payment_status === "PAID");
    return {
      total: rows.length,
      paid: paid.length,
      collected: paid.reduce((sum, r) => sum + r.amount_ngn, 0),
      paidCash: paid.filter((r) => r.payment_type === "CASH_AT_COURT").length,
      paidTransfer: paid.filter((r) => r.payment_type === "BANK_TRANSFER").length,
      pendingTransfer: rows.filter((r) => r.payment_status === "PENDING_BANK_TRANSFER").length,
      awaitingCash: rows.filter((r) => r.payment_status === "AWAITING_CASH").length,
      unpaid: rows.filter((r) => r.payment_status === "UNPAID").length,
      checkedIn: rows.filter((r) => r.checkin_status === "CHECKED_IN").length,
    };
  }, [rows]);

  const cards = [
    { label: "Registered", value: s.total, sub: `${s.checkedIn} checked in` },
    { label: "Paid", value: s.paid, sub: `${formatMoney(s.collected)} collected` },
    { label: "Pending transfer", value: s.pendingTransfer, sub: `${s.unpaid} not yet sent`, tone: "text-pending" },
    { label: "Awaiting cash", value: s.awaitingCash, sub: `${s.paidCash} cash · ${s.paidTransfer} transfer paid`, tone: "text-awaiting" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card p-4">
          <p className="eyebrow text-muted-foreground">{c.label}</p>
          <p className={cn("font-display mt-2 text-4xl", c.tone)}>{c.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

function RegistrationList({ rows, loading }: { rows: Registration[]; loading: boolean }) {
  const [session, setSession] = useState<SessionSlot | "ALL">("ALL");
  const [membership, setMembership] = useState<MembershipType | "ALL">("ALL");
  const [status, setStatus] = useState<PaymentStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (session === "ALL" || r.session === session) &&
        (membership === "ALL" || r.membership === membership) &&
        (status === "ALL" || r.payment_status === status) &&
        (!q ||
          r.full_name.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.checkin_code.includes(q) ||
          r.qr_reference.toLowerCase().includes(q)),
    );
  }, [rows, session, membership, status, search]);

  return (
    <section className="rounded-2xl border bg-card">
      <div className="space-y-3 border-b p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search players"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, code or reference"
            className="h-10 bg-background pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={session === "ALL"} onClick={() => setSession("ALL")}>All sessions</Chip>
          {SESSIONS.map((s) => (
            <Chip key={s.value} active={session === s.value} onClick={() => setSession(s.value)}>
              {sessionLabel(s.value)}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={membership === "ALL"} onClick={() => setMembership("ALL")}>All players</Chip>
          {MEMBERSHIPS.map((m) => (
            <Chip key={m} active={membership === m} onClick={() => setMembership(m)}>
              {MEMBERSHIP_LABEL[m]}s
            </Chip>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={status === "ALL"} onClick={() => setStatus("ALL")}>Any status</Chip>
          {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((p) => (
            <Chip key={p} active={status === p} onClick={() => setStatus(p)}>
              {PAYMENT_STATUS_LABEL[p]}
            </Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No players match.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Player</th>
                  <th className="px-4 py-3 font-semibold">Session</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Recorded by</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Check-in</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{sessionLabel(r.session)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSessionDate(r.session_date)} · {formatPlayTime(r.play_time)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusPill status={r.payment_status} />
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {r.payment_type === "BANK_TRANSFER" ? <Building2 className="size-3" /> : <Banknote className="size-3" />}
                        {PAYMENT_TYPE_LABEL[r.payment_type]} · {formatMoney(r.amount_ngn)}
                      </p>
                      <p className="text-xs text-muted-foreground">{MEMBERSHIP_LABEL[r.membership]}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <RecordedBy r={r} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold tracking-wider">{r.checkin_code}</p>
                      <p className="font-mono text-[0.68rem] text-muted-foreground">{r.qr_reference}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CheckinStatusPill status={r.checkin_status} />
                      {r.checked_in_at && <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(r.checked_in_at)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y md:hidden">
            {filtered.map((r) => (
              <li key={r.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.phone} · {sessionLabel(r.session)}, {formatSessionDate(r.session_date)} {formatPlayTime(r.play_time)}
                    </p>
                  </div>
                  <p className="font-mono font-bold tracking-wider">{r.checkin_code}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PaymentStatusPill status={r.payment_status} />
                  <CheckinStatusPill status={r.checkin_status} />
                  <span className="text-xs text-muted-foreground">
                    {PAYMENT_TYPE_LABEL[r.payment_type]} · {formatMoney(r.amount_ngn)}
                  </span>
                  <span className="text-xs text-muted-foreground">{MEMBERSHIP_LABEL[r.membership]}</span>
                </div>
                <div className="text-xs">
                  <RecordedBy r={r} />
                </div>
                <RowActions r={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RecordedBy({ r }: { r: Registration }) {
  if (r.cash_recorded_by_name) return <span>Cash · <strong>{r.cash_recorded_by_name}</strong></span>;
  if (r.transfer_confirmed_by_name) return <span className="text-muted-foreground">Transfer · {r.transfer_confirmed_by_name}</span>;
  return <span className="text-muted-foreground">—</span>;
}

function RowActions({ r }: { r: Registration }) {
  const { confirmTransfer, recordCash, checkIn } = useAdminActions();
  const a = availableActions(r);
  const busy = confirmTransfer.isPending || recordCash.isPending || checkIn.isPending;
  if (!a.checkIn && !a.confirmTransfer && !a.recordCash) {
    return <p className="text-right text-xs text-muted-foreground md:text-right">Done</p>;
  }
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {a.confirmTransfer && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => confirmTransfer.mutate(r.id)}>
          Confirm transfer
        </Button>
      )}
      {a.recordCash && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => recordCash.mutate(r.id)}>
          Record cash
        </Button>
      )}
      {a.checkIn && (
        <Button size="sm" variant="court" disabled={busy} onClick={() => checkIn.mutate(r.qr_reference)}>
          Check in
        </Button>
      )}
    </div>
  );
}

function StaffPanel({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, email, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profiles ?? []).map((p) => ({ ...p, isAdmin: admins.has(p.id) }));
    },
  });

  const setAdmin = useMutation({
    mutationFn: async ({ id, make }: { id: string; make: boolean }) => {
      const { error } = await supabase.rpc("admin_set_admin", { _user_id: id, _make_admin: make });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access updated.");
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border bg-card">
      <div className="border-b p-4">
        <p className="font-semibold">Staff accounts</p>
        <p className="text-sm text-muted-foreground">
          New staff create an account on the admin sign-in page, then appear here for you to approve.
        </p>
      </div>
      {isLoading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="divide-y">
          {data?.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {p.display_name} {p.id === myId && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{p.email}</p>
              </div>
              {p.isAdmin ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={setAdmin.isPending}
                  onClick={() => setAdmin.mutate({ id: p.id, make: false })}
                >
                  Remove admin
                </Button>
              ) : (
                <Button size="sm" variant="court" disabled={setAdmin.isPending} onClick={() => setAdmin.mutate({ id: p.id, make: true })}>
                  Make admin
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
