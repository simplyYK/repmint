"use client";

// Lightweight, on-brand SVG avatars. Flat, geometric, and theme-colored so they
// fit the dark RepMint UI. Six options spanning masculine/feminine presentations.

import { useId } from "react";

export type AvatarDef = {
  id: string;
  label: string;
  group: "Masc" | "Fem";
  bg: [string, string];
  shirt: string;
  skin: string;
  hair: string;
  style: "short" | "buzz" | "beard" | "long" | "ponytail" | "bob";
};

export const AVATARS: AvatarDef[] = [
  { id: "ember", label: "Ember", group: "Masc", bg: ["#2a1a12", "#0d0a08"], shirt: "#ff8a5b", skin: "#e7b48c", hair: "#2b2320", style: "short" },
  { id: "slate", label: "Slate", group: "Masc", bg: ["#12202a", "#080d10"], shirt: "#5bc7ff", skin: "#c98f66", hair: "#141414", style: "buzz" },
  { id: "clay", label: "Clay", group: "Masc", bg: ["#28210f", "#0c0a06"], shirt: "#e6c15b", skin: "#d9a273", hair: "#3a2a1c", style: "beard" },
  { id: "mint", label: "Mint", group: "Fem", bg: ["#0f2a24", "#07100e"], shirt: "#48e5c2", skin: "#e8b892", hair: "#22181a", style: "long" },
  { id: "violet", label: "Violet", group: "Fem", bg: ["#1e142a", "#0b0810"], shirt: "#b487ff", skin: "#cf9a70", hair: "#1c1524", style: "ponytail" },
  { id: "rose", label: "Rose", group: "Fem", bg: ["#2a1220", "#0f0810"], shirt: "#ff7aa8", skin: "#e9b78f", hair: "#2a1c22", style: "bob" },
];

export function getAvatar(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

function Hair({ style, hair }: { style: AvatarDef["style"]; hair: string }) {
  switch (style) {
    case "buzz":
      return <path d="M31 42 A19 19 0 0 1 69 42 L64 40 A15 15 0 0 0 36 40 Z" fill={hair} opacity="0.92" />;
    case "beard":
      return (
        <>
          <path d="M30 44 A20 20 0 0 1 70 44 L64 41 A15 15 0 0 0 36 41 Z" fill={hair} />
          <path d="M34 52 Q34 70 50 70 Q66 70 66 52 Q66 60 50 62 Q34 60 34 52 Z" fill={hair} opacity="0.9" />
        </>
      );
    case "long":
      return (
        <>
          <path d="M28 44 Q28 22 50 22 Q72 22 72 44 L72 66 Q72 60 66 58 L66 44 A16 16 0 0 0 34 44 L34 58 Q28 60 28 66 Z" fill={hair} />
        </>
      );
    case "ponytail":
      return (
        <>
          <path d="M70 40 Q80 46 76 64 Q74 72 68 70 Q73 58 70 48 Z" fill={hair} />
          <path d="M31 44 A19 19 0 0 1 69 44 L63 41 A15 15 0 0 0 37 41 Z" fill={hair} />
        </>
      );
    case "bob":
      return (
        <path d="M29 46 Q29 23 50 23 Q71 23 71 46 L71 58 Q71 52 65 52 L65 44 A15 15 0 0 0 35 44 L35 52 Q29 52 29 58 Z" fill={hair} />
      );
    default: // short
      return <path d="M32 42 Q30 24 50 24 Q70 24 68 42 L63 40 A15 15 0 0 0 37 40 Z" fill={hair} />;
  }
}

export function AvatarIcon({ id, size = 44 }: { id: string; size?: number }) {
  const a = getAvatar(id);
  const uid = useId().replace(/:/g, "");
  const gid = `av-${uid}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={a.label} style={{ display: "block" }}>
      <defs>
        <radialGradient id={gid} cx="50%" cy="34%" r="80%">
          <stop offset="0%" stopColor={a.bg[0]} />
          <stop offset="100%" stopColor={a.bg[1]} />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${gid}-clip)`}>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        {/* shoulders */}
        <ellipse cx="50" cy="99" rx="34" ry="24" fill={a.shirt} opacity="0.9" />
        <rect x="45" y="60" width="10" height="12" rx="4" fill={a.skin} />
        {/* head */}
        <ellipse cx="50" cy="45" rx="20" ry="21" fill={a.skin} />
        {/* face */}
        <ellipse cx="43" cy="45" rx="1.9" ry="2.4" fill="#20161a" />
        <ellipse cx="57" cy="45" rx="1.9" ry="2.4" fill="#20161a" />
        <path d="M45 53 Q50 56 55 53" stroke="#20161a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* hair last where it should overlay */}
        <Hair style={a.style} hair={a.hair} />
      </g>
      <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
    </svg>
  );
}
