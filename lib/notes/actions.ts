"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { addNote, deleteNote } from "@/lib/db/notes";

export async function addNoteAction(formData: FormData): Promise<void> {
  const patternId = Number(formData.get("patternId"));
  const sectionKey = String(formData.get("sectionKey") ?? "").trim();
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!patternId || !sectionKey || body === "") return;
  addNote(getDb(), patternId, sectionKey, body);
  revalidatePath(`/patterns/${slug}`);
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const noteId = Number(formData.get("noteId"));
  const slug = String(formData.get("slug") ?? "");
  if (!noteId) return;
  deleteNote(getDb(), noteId);
  revalidatePath(`/patterns/${slug}`);
}
