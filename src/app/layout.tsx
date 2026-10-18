import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import {
  Bitcount_Prop_Single, Bricolage_Grotesque, DM_Sans, Fraunces, Geist, Geist_Mono, Pixelify_Sans, Silkscreen, Space_Grotesk,
} from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DEFAULT_THEME, THEME_COOKIE, isThemeId } from "@/lib/themes";

// One family per design role; only the default design's fonts are preloaded.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], preload: false });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], preload: false });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], preload: false });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], preload: false });
const silkscreen = Silkscreen({ variable: "--font-silkscreen", weight: ["400", "700"], subsets: ["latin"], preload: false });
const pixelify = Pixelify_Sans({ variable: "--font-pixelify", subsets: ["latin"], preload: false });
const bitcount = Bitcount_Prop_Single({ variable: "--font-bitcount", subsets: ["latin"], preload: false, adjustFontFallback: false });

const fontVars = [geist, geistMono, fraunces, dmSans, bricolage, spaceGrotesk, silkscreen, pixelify, bitcount].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: "SafeTreat — safer trick-or-treating",
  description: "Report unsafe candy and incidents, plan safe trick-or-treat routes, and get warned if your route had a problem.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isThemeId(saved) ? saved : DEFAULT_THEME;
  return (
    <html lang="en" data-theme={theme} className={fontVars}>
      <body className="flex min-h-dvh flex-col antialiased">
        <ThemeProvider initial={theme}>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[3000] btn-primary">Skip to content</a>
          <Nav />
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
