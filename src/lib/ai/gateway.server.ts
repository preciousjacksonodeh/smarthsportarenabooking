// Server-only: talks to Lovable AI. Never import this from browser code.
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const AI_MODEL = "openai/gpt-6-astra";

export type Effort = "low" | "medium";

export function requireApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("The AI helper isn't set up yet (missing AI key).");
  return key;
}

// One provider per request: the run-id fetch keeps request-local state.
export function createGateway(initialRunId?: string) {
  const apiKey = requireApiKey();
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { model: provider.responses(AI_MODEL), runIdFetch };
}

export function providerOptions(effort: Effort) {
  return {
    openai: {
      forceReasoning: true,
      reasoningEffort: effort,
      reasoningSummary: "auto",
      store: false,
      include: ["reasoning.encrypted_content"],
    },
  };
}

// Turns gateway failures into a sentence staff or players can act on.
export function friendlyAiError(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  if (status === 402) return "The AI helper has used up its credits. Add credits to the workspace to keep using it.";
  if (status === 429) return "The AI helper is busy right now. Please try again in a minute.";
  if (status === 403) return "The AI helper isn't allowed for this workspace right now.";
  if (status === 401) return "The AI helper isn't set up correctly (key problem).";
  return "The AI helper couldn't answer just now. Please try again.";
}

// One-shot answer: streamed from the gateway, collected here, returned as text.
export async function askOnce(opts: { instructions: string; prompt: string; effort: Effort }) {
  const { model } = createGateway();
  let failure: unknown;
  const result = streamText({
    model,
    instructions: opts.instructions,
    prompt: opts.prompt,
    providerOptions: providerOptions(opts.effort),
    onError: ({ error }) => {
      failure = error;
    },
  });
  let text = "";
  try {
    text = (await result.text).trim();
  } catch (error) {
    failure ??= error;
  }
  if (failure) {
    console.error("[ai] request failed", failure);
    throw new Error(friendlyAiError(failure));
  }
  if (!text) throw new Error("The AI helper gave an empty answer. Please try again.");
  return text;
}
