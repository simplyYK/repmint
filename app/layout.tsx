import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepMint | AI Camera Trainer For Goal-Based Workouts",
  description:
    "RepMint is a camera-based training companion for goal-based plans, rep counting, time-under-tension tracking, set review, and progress.",
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
