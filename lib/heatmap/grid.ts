import { addDays } from "@/lib/srs/dates";

export interface HeatCell {
  day: string;
  count: number;
}

export function buildHeatmap(
  counts: Record<string, number>,
  endDay: string,
  weeks: number
): HeatCell[] {
  const total = weeks * 7;
  const firstDay = addDays(endDay, -(total - 1));
  const cells: HeatCell[] = [];
  for (let i = 0; i < total; i++) {
    const day = addDays(firstDay, i);
    cells.push({ day, count: counts[day] ?? 0 });
  }
  return cells;
}
