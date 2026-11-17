import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle } from "lucide-react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { writeReminder } from "@/lib/ai/admin-ai.functions";
import { whatsappTo } from "@/lib/club";
import { cn } from "@/lib/utils";

type Kind = "payment" | "session";

export function ReminderButton({ r }: { r: { id: string; full_name: string; phone: string; payment_status: string } }) {
  const paid = r.payment_status === "PAID";
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(paid ? "session" : "payment");
  const [text, setText] = useState("");
  const write = useServerFn(writeReminder);
  const m = useMutation({
    mutationFn: (k: Kind) => write({ data: { id: r.id, kind: k } }),
    onSuccess: (res) => setText(res.text),
  });

  function generate(k: Kind) {
    setKind(k);
    setText("");
    m.mutate(k);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !text && !m.isPending) generate(kind);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <MessageCircle /> Reminder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp reminder</DialogTitle>
          <DialogDescription>
            For {r.full_name} · {r.phone}. Edit if you like, then open WhatsApp to send.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {(["payment", "session"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={m.isPending || (k === "payment" && paid)}
              onClick={() => generate(k)}
              aria-pressed={kind === k}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
                kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
              )}
            >
              {k === "payment" ? "Payment reminder" : "Session reminder"}
            </button>
          ))}
        </div>
        {m.isPending ? (
          <div className="grid h-36 place-items-center rounded-md border bg-background">
            <Shimmer className="text-sm">Writing message…</Shimmer>
          </div>
        ) : m.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{m.error.message}</p>
        ) : (
          <Textarea aria-label="Reminder message" value={text} onChange={(e) => setText(e.target.value)} rows={7} className="bg-background" />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" disabled={m.isPending} onClick={() => generate(kind)}>
            {m.isPending && <Loader2 className="animate-spin" />}
            Write again
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!text}
            onClick={() => {
              void navigator.clipboard.writeText(text);
              toast.success("Message copied.");
            }}
          >
            <Copy /> Copy
          </Button>
          <Button asChild variant="court" size="sm" className={cn(!text && "pointer-events-none opacity-50")}>
            <a href={text ? whatsappTo(r.phone, text) : undefined} target="_blank" rel="noreferrer">
              <MessageCircle /> Open WhatsApp
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
