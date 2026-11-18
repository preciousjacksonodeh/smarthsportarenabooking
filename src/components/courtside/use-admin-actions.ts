import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPlayTime, sessionLabel, type SessionSlot } from "@/lib/club";

type CheckInResult =
  | { result: "not_found" }
  | {
      result: "not_paid";
      id: string;
      full_name: string;
      payment_status: string;
      session: SessionSlot;
      play_time?: string;
    }
  | {
      result: "already";
      id: string;
      full_name: string;
      checked_in_at: string;
      session: SessionSlot;
      play_time?: string;
    }
  | {
      result: "checked_in";
      id: string;
      full_name: string;
      session: SessionSlot;
      play_time?: string;
      amount_ngn?: number;
      party_size?: number;
    };

export function useAdminActions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const receiptAction = (ref: string) => ({
    label: "View receipt",
    onClick: () => navigate({ to: "/receipt/$ref", params: { ref } }),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["registrations"] });
    qc.invalidateQueries({ queryKey: ["ticket"] });
  };

  const confirmTransfer = useMutation({
    mutationFn: async ({ id }: { id: string; ref: string }) => {
      const { error } = await supabase.rpc("admin_confirm_transfer", { _id: id });
      if (error) throw error;
    },
    onSuccess: (_d, { ref }) => {
      toast.success("Transfer approved — QR pass unlocked and receipt ready.", { action: receiptAction(ref) });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordCash = useMutation({
    mutationFn: async ({ id }: { id: string; ref: string }) => {
      const { error } = await supabase.rpc("admin_record_cash", { _id: id });
      if (error) throw error;
    },
    onSuccess: (_d, { ref }) => {
      toast.success("Cash approved under your name — QR pass unlocked and receipt ready.", { action: receiptAction(ref) });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkIn = useMutation({
    mutationFn: async (lookup: string) => {
      const { data, error } = await supabase.rpc("admin_check_in", { _lookup: lookup });
      if (error) throw error;
      return data as unknown as CheckInResult;
    },
    onSuccess: (res) => {
      refresh();
      switch (res.result) {
        case "checked_in":
          toast.success(
            `${res.full_name}${res.party_size && res.party_size > 1 ? ` + ${res.party_size - 1} more` : ""} checked in · ${sessionLabel(res.session)} ${formatPlayTime(res.play_time ?? null)}`,
          );
          break;
        case "already":
          toast.warning(`${res.full_name} is already checked in.`);
          break;
        case "not_paid":
          toast.error(`${res.full_name} hasn't paid yet. Record the payment first.`);
          break;
        default:
          toast.error("No player found with that code.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { confirmTransfer, recordCash, checkIn };
}
