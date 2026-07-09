import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Display face for headlines/wordmark ("Kinetic Precision" design system).
// Bundled at build time via next/font — no runtime CDN request.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080a0d",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://repmint.ai"),
  title: "RepMint | AI Camera Trainer For Goal-Based Workouts",
  description:
    "RepMint is a camera-based training companion for goal-based plans, rep counting, time-under-tension tracking, set review, and progress.",
  icons: { icon: "/brand/logomark.svg" },
  openGraph: {
    title: "RepMint | AI Camera Trainer For Goal-Based Workouts",
    description:
      "RepMint builds a plan around your goal, guides each set with camera-based feedback, and shows what to focus on next.",
    images: ["/images/repmint-hero.png"],
    siteName: "RepMint",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/repmint-hero.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
