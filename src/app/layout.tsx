import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LottoOps — Admin Dashboard",
  description: "Scratch-off lottery display & inventory management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-bg text-text font-body">{children}</body>
    </html>
  );
}

