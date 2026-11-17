import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FileText, Loader2, MessageSquareText } from "lucide-react";

import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { askAboutBookings, summarizeDay } from "@/lib/ai/admin-ai.functions";

function lagosToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

const EXAMPLES = [
  "Who hasn't paid for this weekend?",
  "Which playing times are busiest?",
  "How much cash did we collect this week?",
  "Which players booked more than once?",
];

export function AdminAiPanel() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <DaySummary />
      <AskBookings />
    </div>
  );
}

function Card({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">{icon}</span>
        <div>
          <h2 className="font-display text-lg">{title}</h2>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Answer({ pending, text, error, waitingLabel }: { pending: boolean; text?: string; error?: Error | null; waitingLabel: string }) {
  if (pending) return <Shimmer className="text-sm">{waitingLabel}</Shimmer>;
  if (error) return <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error.message}</p>;
  if (!text) return null;
  return (
    <div className="rounded-xl border bg-background p-4 text-sm">
      <MessageResponse>{text}</MessageResponse>
    </div>
  );
}

function DaySummary() {
  const [date, setDate] = useState(lagosToday);
  const summarize = useServerFn(summarizeDay);
  const m = useMutation({ mutationFn: (d: string) => summarize({ data: { date: d } }) });
  return (
    <Card icon={<FileText className="size-5" />} title="Day summary" sub="A short report of bookings, money and check-ins for one day.">
      <div className="flex gap-2">
        <Input type="date" aria-label="Session date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 flex-1 bg-background" />
        <Button variant="court" className="h-10" disabled={!date || m.isPending} onClick={() => m.mutate(date)}>
          {m.isPending && <Loader2 className="animate-spin" />}
          Write summary
        </Button>
      </div>
      <Answer pending={m.isPending} text={m.data?.text} error={m.error} waitingLabel="Reading the day's bookings…" />
    </Card>
  );
}

function AskBookings() {
  const [question, setQuestion] = useState("");
  const ask = useServerFn(askAboutBookings);
  const m = useMutation({ mutationFn: (q: string) => ask({ data: { question: q } }) });
  function submit(q: string) {
    const t = q.trim();
    if (!t || m.isPending) return;
    setQuestion(t);
    m.mutate(t);
  }
  return (
    <Card icon={<MessageSquareText className="size-5" />} title="Ask about bookings" sub="Ask in plain words. Looks at the last 30 days and everything upcoming.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="space-y-2"
      >
        <Textarea
          aria-label="Your question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(question);
            }
          }}
          maxLength={500}
          rows={2}
          placeholder="e.g. Who still owes money for Saturday?"
          className="resize-none bg-background"
        />
        <div className="flex flex-wrap items-center gap-2">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              className="rounded-full border border-primary/30 bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:border-primary"
            >
              {q}
            </button>
          ))}
          <Button type="submit" variant="court" size="sm" className="ml-auto" disabled={!question.trim() || m.isPending}>
            {m.isPending && <Loader2 className="animate-spin" />}
            Ask
          </Button>
        </div>
      </form>
      <Answer pending={m.isPending} text={m.data?.text} error={m.error} waitingLabel="Looking through bookings…" />
    </Card>
  );
}
