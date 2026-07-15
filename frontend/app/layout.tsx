import type { Metadata } from "next";
import { Inter, Geist_Mono, Newsreader, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/components/SessionProvider";
import Nav from "@/components/Nav";
import "./globals.css";

// Warm, literary body face — reads like a collected recipe journal, not a SaaS product.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Modern grotesque for planner/brand headlines (Kitchen hero + nav wordmark); recipes stay serif.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
// Editorial display serif for headings — calm, premium-lifestyle feel.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Bake Me Up 🍞",
  description:
    "Your AI baking companion — decides what to bake with you, then coaches you through it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${newsreader.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <SessionProvider>
            <Nav />
            <div className="flex-1">{children}</div>
          </SessionProvider>
        </TooltipProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
