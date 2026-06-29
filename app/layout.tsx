import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepMint | Form Coach In Your Pocket",
  description:
    "RepMint is a camera-based form coach for rep counting, movement feedback, set review, and trainer-style cues across everyday exercises.",
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
