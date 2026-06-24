"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { getAppState } from "@/lib/db/appState";
import { getPatternBySlug } from "@/lib/db/patterns";
import { loadPatternContent } from "@/lib/content/loadPattern";
import {
  getOrCreateTutorSession,
  listTutorMessages,
  addTutorMessage,
} from "@/lib/db/tutor";
import { buildTutorSystem } from "@/lib/tutor/prompt";
import { askClaude, type TutorTurn } from "@/lib/tutor/anthropic";

// Canned tutor replies. Shown to the user, but excluded from the history sent
// back to Claude so they never pollute the conversation on a later turn.
const NO_KEY_MESSAGE =
  "No Anthropic API key is set. Add one in Settings to chat with the tutor.";
const ERROR_MESSAGE =
  "Sorry — the tutor request failed. Please try again; if it persists, check your API key in Settings.";

export async function sendTutorMessageAction(
  formData: FormData
): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!slug || body === "") return;

  const db = getDb();
  const pattern = getPatternBySlug(db, slug);
  if (!pattern) return;

  const sessionId = getOrCreateTutorSession(db, "pattern", pattern.id);
  addTutorMessage(db, sessionId, "user", body);

  const apiKey = getAppState(db, "anthropic_api_key");
  if (!apiKey) {
    addTutorMessage(db, sessionId, "assistant", NO_KEY_MESSAGE);
    revalidatePath("/patterns/" + slug);
    return;
  }

  const system = buildTutorSystem(pattern.name, loadPatternContent(slug) ?? "");
  const history: TutorTurn[] = listTutorMessages(db, sessionId)
    .filter((m) => m.content !== NO_KEY_MESSAGE && m.content !== ERROR_MESSAGE)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  let reply: string;
  try {
    reply = await askClaude({ apiKey, system, messages: history });
  } catch (err) {
    console.error("Tutor request failed:", err);
    reply = ERROR_MESSAGE;
  }

  addTutorMessage(db, sessionId, "assistant", reply || "(no response)");
  revalidatePath("/patterns/" + slug);
}
