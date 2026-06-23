"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { logAttempt, type Outcome, type Rating } from "@/lib/db/attempts";
import { recordReview } from "@/lib/db/reviews";
import { todayIso } from "@/lib/srs/dates";

const OUTCOMES: Outcome[] = ["solved", "partial", "failed"];
const RATINGS: Rating[] = ["hard", "ok", "easy"];

export async function logAttemptAction(formData: FormData): Promise<void> {
  const problemId = Number(formData.get("problemId"));
  const outcome = String(formData.get("outcome") ?? "") as Outcome;
  if (!problemId || !OUTCOMES.includes(outcome)) return;

  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = RATINGS.includes(ratingRaw as Rating)
    ? (ratingRaw as Rating)
    : null;

  const minutesRaw = String(formData.get("minutes") ?? "").trim();
  const minutes = minutesRaw === "" ? null : Number(minutesRaw);

  const reflection = String(formData.get("reflection") ?? "").trim() || null;
  const usedHint = formData.get("usedHint") != null;

  logAttempt(getDb(), {
    problemId,
    outcome,
    rating,
    minutes:
      minutes != null && Number.isFinite(minutes) && minutes >= 0
        ? Math.round(minutes)
        : null,
    usedHint,
    reflection,
  });

  if (rating) {
    recordReview(getDb(), "problem", problemId, rating, todayIso());
  }

  const revalidate = String(formData.get("revalidate") ?? "") || "/problems";
  revalidatePath(revalidate);
}
