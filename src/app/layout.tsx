import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "LottoOps — Admin Dashboard",
  description: "Scratch-off lottery display & inventory management",
  applicationName: "LottoOps",
  appleWebApp: { capable: true, title: "LottoOps", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full bg-bg text-text font-body"><ServiceWorkerRegistration />{children}</body>
    </html>
  );
}
