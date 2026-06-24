import type { HeatCell } from "@/lib/heatmap/grid";

export interface HeatmapProps {
  cells: HeatCell[];
}

function cellColor(count: number): string {
  if (count <= 0) return "var(--panel)";
  if (count === 1) return "rgba(16,185,129,0.30)";
  if (count <= 3) return "rgba(16,185,129,0.55)";
  return "rgba(16,185,129,0.85)";
}

export function Heatmap({ cells }: HeatmapProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "repeat(7, 11px)",
        gridAutoFlow: "column",
        gap: 3,
      }}
    >
      {cells.map((c) => (
        <div
          key={c.day}
          data-count={c.count}
          title={`${c.day}: ${c.count}`}
          style={{
            width: 11,
            height: 11,
            borderRadius: 2,
            background: cellColor(c.count),
          }}
        />
      ))}
    </div>
  );
}
