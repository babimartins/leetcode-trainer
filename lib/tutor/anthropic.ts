import Anthropic from "@anthropic-ai/sdk";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export async function askClaude(opts: {
  apiKey: string;
  system: string;
  messages: TutorTurn[];
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: opts.system,
    messages: opts.messages,
  });
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
