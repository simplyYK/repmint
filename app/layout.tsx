import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepMint | Webcam Squat Coach",
  description:
    "RepMint is a browser-based demo for live squat rep counting, form scoring, and practical coaching cues from a webcam session.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
