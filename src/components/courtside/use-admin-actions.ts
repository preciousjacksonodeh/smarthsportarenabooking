import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    };

export function useAdminActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["registrations"] });
    qc.invalidateQueries({ queryKey: ["ticket"] });
  };

  const confirmTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_confirm_transfer", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bank transfer confirmed — marked as paid.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordCash = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_record_cash", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cash payment recorded under your name.");
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
            `${res.full_name} checked in · ${sessionLabel(res.session)} ${formatPlayTime(res.play_time ?? null)}`,
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
