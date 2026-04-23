import type { Metadata } from "next";
import { Archivo_Narrow, IBM_Plex_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteFrame } from "@/components/brutalist/SiteFrame";
import { WalletBoot } from "@/components/phantom/WalletBoot";

const display = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});
const serif = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skill Loops Protocol",
  description:
    "A Solana-based protocol where every buyer of an AI agent skill is automatically a potential shareholder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <WalletBoot>
          <SiteFrame>{children}</SiteFrame>
        </WalletBoot>
      </body>
    </html>
  );
}
