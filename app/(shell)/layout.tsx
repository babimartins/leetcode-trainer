import type { ReactNode } from "react";
import { NavRail } from "@/components/NavRail";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <NavRail />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
