import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/club";
import { cn } from "@/lib/utils";

export function PlayerChats() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["player-chats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("id, updated_at, chat_messages(id, role, content, created_at)")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map((c) => ({
        ...c,
        chat_messages: [...c.chat_messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chat deleted.");
      qc.invalidateQueries({ queryKey: ["player-chats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border bg-card">
      <div className="border-b p-4">
        <p className="font-semibold">Player chats</p>
        <p className="text-sm text-muted-foreground">Questions players asked the help chat on the booking page, newest first.</p>
      </div>
      {isLoading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="p-6 text-sm text-destructive">Couldn't load chats.</p>
      ) : !data?.length ? (
        <p className="py-12 text-center text-muted-foreground">No player chats yet.</p>
      ) : (
        <ul className="divide-y">
          {data.map((c) => {
            const first = c.chat_messages.find((m) => m.role === "user");
            const questions = c.chat_messages.filter((m) => m.role === "user").length;
            const isOpen = openId === c.id;
            return (
              <li key={c.id}>
                <div className="flex items-center gap-2 p-4">
                  <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{first?.content ?? "(empty chat)"}</p>
                      <p className="text-xs text-muted-foreground">
                        {questions} question{questions === 1 ? "" : "s"} · {formatDateTime(c.updated_at)}
                      </p>
                    </div>
                  </button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete chat" disabled={remove.isPending} onClick={() => remove.mutate(c.id)}>
                    <Trash2 />
                  </Button>
                </div>
                {isOpen && (
                  <div className="space-y-2 bg-muted/40 px-4 py-3">
                    {c.chat_messages.map((m) => (
                      <div key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card")}>
                        {m.content}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
