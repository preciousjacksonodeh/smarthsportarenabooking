import { createServerFn } from "@tanstack/react-start";

import { loadChat } from "./chat.server";

// Public: returns one player's saved chat. The chat id is a random code only their browser knows.
export const getPlayerChat = createServerFn({ method: "POST" })
  .inputValidator((input: { conversationId: string }) => {
    if (typeof input?.conversationId !== "string") throw new Error("Invalid chat.");
    return { conversationId: input.conversationId };
  })
  .handler(async ({ data }) => loadChat(data.conversationId));
