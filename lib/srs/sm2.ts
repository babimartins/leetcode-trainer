export interface ReviewState {
  ease: number;
  intervalDays: number;
}

export type Rating = "hard" | "ok" | "easy";

const EASE_FLOOR = 1.3;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function nextReview(state: ReviewState, rating: Rating): ReviewState {
  let ease = state.ease;
  let intervalDays: number;

  if (rating === "hard") {
    ease = Math.max(EASE_FLOOR, round2(ease - 0.2));
  } else if (rating === "easy") {
    ease = round2(ease + 0.15);
  }

  if (state.intervalDays <= 0) {
    intervalDays = rating === "hard" ? 1 : rating === "ok" ? 3 : 4;
  } else if (rating === "hard") {
    intervalDays = Math.max(1, Math.round(state.intervalDays * 1.2));
  } else if (rating === "ok") {
    intervalDays = Math.round(state.intervalDays * ease);
  } else {
    intervalDays = Math.round(state.intervalDays * ease * 1.3);
  }

  return { ease, intervalDays };
}
