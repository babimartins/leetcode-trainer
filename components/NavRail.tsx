import Link from "next/link";

const LINKS: Array<{ label: string; href: string }> = [
  { label: "Today", href: "/" },
  { label: "Patterns", href: "/patterns" },
  { label: "Problems", href: "/problems" },
  { label: "Review queue", href: "/review" },
  { label: "Stats", href: "/stats" },
  { label: "Settings", href: "/settings" },
];

export function NavRail() {
  return (
    <nav
      style={{
        width: 180,
        borderRight: "1px solid var(--border)",
        background: "var(--panel)",
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: "100vh",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 14 }}>DSA Trainer</div>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{ padding: "8px 10px", borderRadius: 6, color: "var(--fg)" }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
