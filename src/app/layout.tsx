import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kirby Learning Academy",
    template: "%s | Kirby Learning Academy",
  },
  description:
    "Enterprise learning management system for Kirby Corporation — compliance, certification, and workforce development.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <SessionProvider>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
