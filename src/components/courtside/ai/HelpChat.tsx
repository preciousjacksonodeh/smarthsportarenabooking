import { lazy, Suspense, useState } from "react";
import { Loader2, MessageCircleQuestion, X } from "lucide-react";

import { Button } from "@/components/ui/button";

// The chat window (and its markdown renderer) only downloads when a player opens it.
const HelpChatPanel = lazy(() => import("./HelpChatPanel"));

export function HelpChat() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:h-[600px] sm:max-h-[calc(100dvh-2.5rem)] sm:w-[400px] sm:rounded-2xl">
          <Suspense
            fallback={
              <div className="grid flex-1 place-items-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <HelpChatPanel onClose={() => setOpen(false)} />
          </Suspense>
        </div>
      )}
      {!open && (
        <Button
          type="button"
          variant="hero"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 h-12 gap-2 rounded-full px-5 shadow-lg sm:right-6 sm:bottom-6"
        >
          <MessageCircleQuestion className="!size-5" />
          Ask a question
        </Button>
      )}
    </>
  );
}

export function CloseChatButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label="Close chat"
      onClick={onClick}
      className="text-court-foreground hover:bg-court-foreground/10 hover:text-court-foreground"
    >
      <X />
    </Button>
  );
}
