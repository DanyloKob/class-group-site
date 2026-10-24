import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { isValidHexColor, pickInkForAccent } from "@/lib/color";
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
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const store = await cookies();
  const theme = store.get("l23_theme")?.value === "LIGHT" ? "light" : "dark";

  // Read from a cookie (not a DB lookup) for the same reason theme is - this
  // layout wraps every page, so it stays a no-query render even for guests.
  const accentCookie = store.get("l23_accent")?.value;
  const accentColor = accentCookie && isValidHexColor(accentCookie) ? accentCookie : null;

  return (
    /**
     * DIRECTION (Operate mode, see app/globals.css for the full token
     * rationale): restrained neutrals + one green accent reserved for
     * selection/state; dark is the product default. Phone-width frame lives
     * in components/shell/PhoneFrame.tsx, applied by the (app) and (auth)
     * layouts, not here, so this root stays a plain document shell.
     */
    <html lang="uk" data-theme={theme} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {accentColor && (
          <style>{`:root { --color-accent: ${accentColor}; --color-accent-ink: ${pickInkForAccent(accentColor)}; }`}</style>
        )}
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
