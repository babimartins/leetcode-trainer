"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { recordReview, type ItemType } from "@/lib/db/reviews";
import { todayIso } from "@/lib/srs/dates";
import type { Rating } from "@/lib/srs/sm2";

const ITEM_TYPES: ItemType[] = ["problem", "pattern"];
const RATINGS: Rating[] = ["hard", "ok", "easy"];

export async function recordReviewAction(formData: FormData): Promise<void> {
  const itemType = String(formData.get("itemType") ?? "") as ItemType;
  const itemId = Number(formData.get("itemId"));
  const rating = String(formData.get("rating") ?? "") as Rating;
  if (!ITEM_TYPES.includes(itemType) || !itemId || !RATINGS.includes(rating)) {
    return;
  }
  recordReview(getDb(), itemType, itemId, rating, todayIso());
  const revalidate = String(formData.get("revalidate") ?? "") || "/review";
  revalidatePath(revalidate);
}

export async function recordPatternReviewAction(
  formData: FormData
): Promise<void> {
  const patternId = Number(formData.get("patternId"));
  const slug = String(formData.get("slug") ?? "");
  const rating = String(formData.get("rating") ?? "") as Rating;
  if (!patternId || !RATINGS.includes(rating)) return;
  recordReview(getDb(), "pattern", patternId, rating, todayIso());
  revalidatePath("/patterns/" + slug);
}
