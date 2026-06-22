"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { setAppState } from "@/lib/db/appState";

export async function saveApiKey(formData: FormData): Promise<void> {
  const key = String(formData.get("apiKey") ?? "").trim();
  // A blank submit is a no-op — don't silently clear a previously-saved key.
  if (key === "") return;
  setAppState(getDb(), "anthropic_api_key", key);
  revalidatePath("/settings");
}
