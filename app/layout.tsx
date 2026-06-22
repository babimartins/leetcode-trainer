import "./globals.css";
import "highlight.js/styles/github-dark.css";
import type { ReactNode } from "react";

export const metadata = { title: "DSA Trainer" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
