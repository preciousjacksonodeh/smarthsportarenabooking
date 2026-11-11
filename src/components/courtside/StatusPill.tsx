import { cn } from "@/lib/utils";
import { CHECKIN_STATUS_LABEL, PAYMENT_STATUS_LABEL, type CheckinStatus, type PaymentStatus } from "@/lib/club";

const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  PAID: "status-paid",
  PENDING_BANK_TRANSFER: "status-pending",
  AWAITING_CASH: "status-awaiting",
  UNPAID: "status-unpaid",
};

const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider whitespace-nowrap";

export function PaymentStatusPill({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <span className={cn(base, PAYMENT_CLASS[status], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function CheckinStatusPill({ status, className }: { status: CheckinStatus; className?: string }) {
  return (
    <span className={cn(base, status === "CHECKED_IN" ? "status-paid" : "bg-muted text-muted-foreground", className)}>
      {CHECKIN_STATUS_LABEL[status]}
    </span>
  );
}
