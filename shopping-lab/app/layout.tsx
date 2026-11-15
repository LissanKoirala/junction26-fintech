import type { Metadata } from "next";
import "./globals.css";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Vara — Shopping Lab",
  description: "A familiar shopping experience. A different kind of checkout. A mobile technology demo for S-mobiili.",
  icons: {
    icon: withBase("/favicon.svg"),
    shortcut: withBase("/favicon.svg"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
