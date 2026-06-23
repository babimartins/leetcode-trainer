import type Database from "better-sqlite3";
import { nextReview, type ReviewState, type Rating } from "@/lib/srs/sm2";
import { addDays } from "@/lib/srs/dates";

export type ItemType = "problem" | "pattern";

export interface DueItem {
  item_type: string;
  item_id: number;
  title: string;
  slug: string | null;
  lc_url: string | null;
  difficulty: string | null;
  due_date: string;
}

export function getReviewState(
  db: Database.Database,
  itemType: ItemType,
  itemId: number
): ReviewState {
  const row = db
    .prepare(
      "SELECT ease, interval_days FROM reviews WHERE item_type = ? AND item_id = ?"
    )
    .get(itemType, itemId) as
    | { ease: number; interval_days: number }
    | undefined;
  if (!row) return { ease: 2.5, intervalDays: 0 };
  return { ease: row.ease, intervalDays: row.interval_days };
}

export function recordReview(
  db: Database.Database,
  itemType: ItemType,
  itemId: number,
  rating: Rating,
  today: string
): void {
  const next = nextReview(getReviewState(db, itemType, itemId), rating);
  const dueDate = addDays(today, next.intervalDays);
  db.prepare(
    `INSERT INTO reviews (item_type, item_id, ease, interval_days, due_date, last_reviewed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_type, item_id) DO UPDATE SET
       ease = excluded.ease,
       interval_days = excluded.interval_days,
       due_date = excluded.due_date,
       last_reviewed = excluded.last_reviewed`
  ).run(itemType, itemId, next.ease, next.intervalDays, dueDate, today);
}

export function getDueItems(db: Database.Database, today: string): DueItem[] {
  return db
    .prepare(
      `SELECT r.item_type, r.item_id, p.title AS title, NULL AS slug,
              p.lc_url AS lc_url, p.difficulty AS difficulty, r.due_date AS due_date
         FROM reviews r JOIN problems p ON p.id = r.item_id
        WHERE r.item_type = 'problem' AND r.due_date IS NOT NULL AND r.due_date <= ?
       UNION ALL
       SELECT r.item_type, r.item_id, pa.name AS title, pa.slug AS slug,
              NULL AS lc_url, NULL AS difficulty, r.due_date AS due_date
         FROM reviews r JOIN patterns pa ON pa.id = r.item_id
        WHERE r.item_type = 'pattern' AND r.due_date IS NOT NULL AND r.due_date <= ?
       ORDER BY due_date`
    )
    .all(today, today) as DueItem[];
}
