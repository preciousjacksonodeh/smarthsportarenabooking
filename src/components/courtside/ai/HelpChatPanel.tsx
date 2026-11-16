import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import logo from "@/assets/smart_sports_arena_logo.png.asset.json";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { getPlayerChat } from "@/lib/ai/player-chat.functions";
import { CLUB } from "@/lib/club";

import { CloseChatButton } from "./HelpChat";

const STORAGE_KEY = "ssa-help-chat-id";

const SUGGESTIONS = [
  "What time are you open?",
  "How do I pay by transfer?",
  "How much is pitch hire?",
  "Can I book for my friends?",
];

function readOrCreateChatId() {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}

export default function HelpChatPanel({ onClose }: { onClose: () => void }) {
  // This panel only mounts in the browser (after a click), so localStorage is safe here.
  const [chatId, setChatId] = useState(() => readOrCreateChatId());
  const [restored, setRestored] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRestored(null);
    getPlayerChat({ data: { conversationId: chatId } })
      .then((rows) => {
        if (cancelled) return;
        setRestored(rows.map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text", text: m.content }] })));
      })
      .catch(() => !cancelled && setRestored([]));
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  function startOver() {
    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    setChatId(id);
  }

  return (
    <>
      <header className="court-surface flex items-center gap-3 px-4 py-3">
        <img src={logo.url} alt="" width={36} height={36} className="size-9 rounded-full bg-card object-cover ring-2 ring-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base leading-tight text-court-foreground">Arena helper</p>
          <p className="truncate text-xs text-court-foreground/75">Questions about booking & paying</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={startOver}
          className="text-court-foreground hover:bg-court-foreground/10 hover:text-court-foreground"
        >
          <RotateCcw /> Start over
        </Button>
        <CloseChatButton onClick={onClose} />
      </header>
      {restored === null ? (
        <div className="flex flex-1 items-center justify-center">
          <Shimmer>Loading chat…</Shimmer>
        </div>
      ) : (
        <ChatWindow key={chatId} chatId={chatId} initialMessages={restored} />
      )}
    </>
  );
}

function ChatWindow({ chatId, initialMessages }: { chatId: string; initialMessages: UIMessage[] }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { conversationId: chatId } }),
    [chatId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ id: chatId, messages: initialMessages, transport });
  const busy = status === "submitted" || status === "streaming";
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t });
  }

  const last = messages[messages.length - 1];
  const waiting = status === "submitted" || (status === "streaming" && last?.role === "assistant" && !last.parts.some((p) => p.type === "text" && p.text));

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className="gap-5">
          {messages.length === 0 && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-foreground">
                Hi! Ask me anything about booking a session at {CLUB.name}: opening times, paying, group bookings or pitch hire.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-primary/30 bg-secondary px-3 py-1.5 text-left text-xs font-medium text-secondary-foreground transition-colors hover:border-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
            if (!text) return null;
            return (
              <Message key={m.id} from={m.role}>
                <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{text}</p> : <MessageResponse>{text}</MessageResponse>}
                </MessageContent>
              </Message>
            );
          })}
          {waiting && <Shimmer className="text-sm">Thinking…</Shimmer>}
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {readableError(error)} You can also call {CLUB.contactPhone}.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t p-3">
        <PromptInput onSubmit={({ text }) => send(text)}>
          <PromptInputTextarea ref={inputRef} placeholder="Type your question…" maxLength={1000} autoFocus />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

function readableError(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return error.message && error.message.length < 200 ? error.message : "Something went wrong.";
}
