// Player help chat: streams answers and saves every question and answer for staff.
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { createGateway, friendlyAiError, providerOptions } from "./gateway.server";
import { playerChatInstructions } from "./knowledge";
import { getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./run-id.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QUESTION_CHARS = 1000;
const HISTORY_LIMIT = 20;

function textOf(message: UIMessage) {
  return message.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("")
    .trim();
}

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function handleChat(request: Request) {
  let body: { messages?: unknown; conversationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("Invalid request.");
  }
  const { conversationId } = body;
  if (typeof conversationId !== "string" || !UUID.test(conversationId)) return bad("Invalid chat.");
  if (!Array.isArray(body.messages) || body.messages.length === 0) return bad("No message.");

  const messages = (body.messages as UIMessage[]).slice(-HISTORY_LIMIT);
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !Array.isArray(last.parts)) return bad("No question.");
  const question = textOf(last);
  if (!question) return bad("Please type a question.");
  if (question.length > MAX_QUESTION_CHARS) return bad(`Please keep questions under ${MAX_QUESTION_CHARS} characters.`);
  if (messages.some((m) => m.role !== "user" && m.role !== "assistant")) return bad("Invalid chat.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Save the question before answering so staff see it even if the AI fails.
  const now = new Date().toISOString();
  const { error: convError } = await supabaseAdmin
    .from("chat_conversations")
    .upsert({ id: conversationId, updated_at: now }, { onConflict: "id" });
  if (convError) {
    console.error("[chat] could not save conversation", convError);
    return bad("Chat is unavailable right now. Please try again.", 500);
  }
  const { error: qError } = await supabaseAdmin
    .from("chat_messages")
    .insert({ conversation_id: conversationId, role: "user", content: question });
  if (qError) {
    console.error("[chat] could not save question", qError);
    return bad("Chat is unavailable right now. Please try again.", 500);
  }

  let gateway: ReturnType<typeof createGateway>;
  try {
    gateway = createGateway(getLovableAiGatewayRunId(request));
  } catch (error) {
    console.error("[chat]", error);
    return bad(error instanceof Error ? error.message : "Chat is unavailable.", 500);
  }

  const result = streamText({
    model: gateway.model,
    instructions: playerChatInstructions(),
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: providerOptions("low"),
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onError: (error) => {
      console.error("[chat] AI error", error);
      return friendlyAiError(error);
    },
    onEnd: async ({ messages: all, isAborted }) => {
      const reply = all[all.length - 1];
      if (!reply || reply.role !== "assistant") return;
      const answer = textOf(reply);
      if (!answer) return;
      const { error } = await supabaseAdmin.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: isAborted ? `${answer} …(stopped)` : answer,
      });
      if (error) console.error("[chat] could not save answer", error);
      await supabaseAdmin.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    },
  });

  return withLovableAiGatewayRunIdHeader(response, gateway.runIdFetch);
}

// Loads a saved chat so a returning player sees their earlier messages.
export async function loadChat(conversationId: string) {
  if (!UUID.test(conversationId)) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at")
    .limit(100);
  if (error) {
    console.error("[chat] could not load chat", error);
    return [];
  }
  return data.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }));
}
