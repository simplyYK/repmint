import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,850,700,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
