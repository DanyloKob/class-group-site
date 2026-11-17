import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "L-23 LIFE",
  description: "Сайт групи L-23",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  themeColor: "#0a0d0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /**
     * DIRECTION (Operate mode, see app/globals.css for the full token
     * rationale): restrained neutrals + one green accent reserved for
     * selection/state; dark only. Phone-width frame lives in
     * components/shell/PhoneFrame.tsx, applied by the (app)
     * layout, not here, so this root stays a plain document shell.
     */
    <html lang="uk" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
