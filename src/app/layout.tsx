import type { Metadata } from "next";
import { Public_Sans, DM_Mono, Teko } from "next/font/google";
import { AuthProvider } from "@/lib/client-auth";
import CookieConsentBanner from "./_components/cookie-consent-banner";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});
const teko = Teko({
  variable: "--font-scoreboard",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FutPoli",
  description: "Gestione, calendario e statistiche per tornei di calcio",
    manifest: "/manifest.json",
    icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
    },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${publicSans.variable} ${dmMono.variable} ${teko.variable}`}>
        <AuthProvider>
          {children}
          <CookieConsentBanner />
        </AuthProvider>
      </body>
    </html>
  );
}