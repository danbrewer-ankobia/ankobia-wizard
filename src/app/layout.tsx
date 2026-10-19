import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Sparkles } from "@/components/Sparkles";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ankobia Wizard",
  description: "Make slide decks, summaries, instructions and more with AI - no prompting experience needed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3 sm:px-6">
            <span />
            <Link href="/" className="relative isolate flex flex-col items-center px-10">
              <Sparkles variant="logo" />
              <BrandLogo className="h-20 w-auto sm:h-24" />
              <span className="mt-1.5 pl-[0.35em] text-xs font-bold uppercase tracking-[0.35em] text-teal">Wizard</span>
            </Link>
            <Link href="/admin" className="justify-self-end text-sm font-medium text-muted hover:text-navy">
              Admin
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="py-6 text-center text-xs text-muted">
          AI can make mistakes. Review everything before you share it.
        </footer>
      </body>
    </html>
  );
}
