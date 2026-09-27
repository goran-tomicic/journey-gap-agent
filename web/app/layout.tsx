import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Journey Gap Agent",
  description: "Flags gaps, ownership conflicts, and channel mismatches in a cross-team journey.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
