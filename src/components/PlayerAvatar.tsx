"use client";

import React from "react";

interface PlayerAvatarProps {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  teamName?: string | null;
  teamConference?: string | null;
  className?: string;
}

// 1. Curated color palettes
const SKIN_TONES = [
  "#e6a57e", // Warm Tan (Standard Filipino)
  "#c6865c", // Rich Brown
  "#f0c2a2", // Light Olive
  "#d4956a", // Deep Tan
  "#f7d5c0", // Light Cream
  "#b0754c", // Dark Bronze
];

const HAIR_COLORS = [
  "#111111", // Jet Black
  "#261e1a", // Dark Espresso
  "#3d2d26", // Auburn / Dark Brown
  "#8a5c38", // Caramel Highlight
];

// 2. Map of team names to sports jersey color palettes (primary & secondary)
const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  "Spurs": { primary: "#27272a", secondary: "#a1a1aa" }, // Black & Silver
  "Capitals": { primary: "#1d4ed8", secondary: "#dc2626" }, // Blue & Red
  "Supremos": { primary: "#991b1b", secondary: "#fbbf24" }, // Crimson & Gold
  "Durians": { primary: "#65a30d", secondary: "#facc15" }, // Lime Green & Yellow
  "Centurions": { primary: "#6b21a8", secondary: "#facc15" }, // Purple & Yellow
  "Valientes": { primary: "#1d4ed8", secondary: "#ffffff" }, // Blue & White
  "Generals": { primary: "#065f46", secondary: "#fbbf24" }, // Forest Green & Gold
  "Pirates": { primary: "#18181b", secondary: "#f97316" }, // Black & Orange
  "Strikers": { primary: "#1e3a8a", secondary: "#facc15" }, // Navy & Yellow
  "Monarchs": { primary: "#581c87", secondary: "#fbbf24" }, // Deep Purple & Gold
  "Stallions": { primary: "#881337", secondary: "#ffffff" }, // Burgundy & White
  "Tigers": { primary: "#ea580c", secondary: "#18181b" }, // Orange & Black
  "Skyscrapers": { primary: "#0369a1", secondary: "#f3f4f6" }, // Steel Blue & Gray
  "Voyagers": { primary: "#1e3a8a", secondary: "#06b6d4" }, // Navy & Cyan
  "Golden Eagles": { primary: "#eab308", secondary: "#1e3a8a" }, // Gold & Navy
  "Patriots": { primary: "#dc2626", secondary: "#1d4ed8" }, // Red & Blue
  "Shoemakers": { primary: "#78350f", secondary: "#fef3c7" }, // Amber Brown & Cream
  "Warriors": { primary: "#1d4ed8", secondary: "#facc15" }, // Royal Blue & Yellow
  "Sugar Kings": { primary: "#db2777", secondary: "#ffffff" }, // Pink & White
  "Knights": { primary: "#d97706", secondary: "#e5e7eb" }, // Gold & Silver
  "Royals": { primary: "#1d4ed8", secondary: "#fbbf24" }, // Blue & Gold
  "Lions": { primary: "#eab308", secondary: "#18181b" }, // Yellow & Black
  "Pilgrims": { primary: "#14532d", secondary: "#ffffff" }, // Dark Green & White
  "Liberators": { primary: "#f97316", secondary: "#ffffff" }, // Orange & White
  "Sugarcane": { primary: "#16a34a", secondary: "#facc15" }, // Green & Yellow
  "Harvesters": { primary: "#ea580c", secondary: "#15803d" }, // Orange & Green
  "Chiefs": { primary: "#b91c1c", secondary: "#ffffff" }, // Red & White
  "Industrialists": { primary: "#4b5563", secondary: "#f97316" }, // Slate & Orange
  "Loggers": { primary: "#1b4332", secondary: "#78350f" }, // Forest Green & Brown
};

// 3. String hashing utility
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function PlayerAvatar({
  playerId,
  firstName,
  lastName,
  position,
  teamName,
  teamConference,
  className = "w-full h-full",
}: PlayerAvatarProps) {
  // Compute deterministic seed based on playerId
  const seed = hashString(playerId || `${firstName} ${lastName}`);

  // Resolve player specific variations
  const skinTone = SKIN_TONES[seed % SKIN_TONES.length];
  const hairColor = HAIR_COLORS[(seed >> 2) % HAIR_COLORS.length];
  const hairStyleIndex = (seed >> 4) % 6; // 6 hairstyles
  const mouthStyleIndex = (seed >> 6) % 3; // 3 mouth expressions
  const eyeStyleIndex = (seed >> 8) % 3; // 3 eye styles

  // Resolve jersey colors
  let primaryColor = "#4b5563"; // Default practice jersey Gray
  let secondaryColor = "#d1d5db"; // Default practice jersey Light Gray

  if (teamName) {
    // Exact team lookup
    const colors = TEAM_COLORS[teamName];
    if (colors) {
      primaryColor = colors.primary;
      secondaryColor = colors.secondary;
    } else {
      // Fallback based on conference
      if (teamConference === "Luzon") {
        primaryColor = "#b91c1c"; // Luzon Crimson Red
        secondaryColor = "#facc15"; // Gold
      } else if (teamConference === "VisMin") {
        primaryColor = "#0369a1"; // CDO/VisMin Sky Blue
        secondaryColor = "#ffffff"; // White
      }
    }
  }

  // Define SVG elements
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Soft radial background gradient */}
        <radialGradient id={`bgGrad-${playerId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>

        {/* Dynamic drop shadow filter */}
        <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* 1. Background Frame */}
      <rect width="100" height="100" rx="16" fill={`url(#bgGrad-${playerId})`} stroke="#1e1e24" strokeWidth="1" />

      {/* Background ring for a sports card feel */}
      <circle cx="50" cy="50" r="38" fill="none" stroke={primaryColor} strokeWidth="1" strokeOpacity="0.25" />
      <circle cx="50" cy="50" r="38" fill="none" stroke={secondaryColor} strokeWidth="0.5" strokeDasharray="3 3" strokeOpacity="0.3" />

      {/* 2. Neck */}
      <rect x="44" y="60" width="12" height="16" rx="2" fill={skinTone} />
      {/* Neck Chin Shadow */}
      <path d="M 44 60 L 50 67 L 56 60 Z" fill="#000000" opacity="0.15" />

      {/* 3. Basketball Jersey (Torso) */}
      <g filter="url(#soft-shadow)">
        {/* Torso Base */}
        <path
          d="M 22 96 C 22 78, 32 74, 50 74 C 68 74, 78 78, 78 96 Z"
          fill={primaryColor}
        />
        {/* Shoulder straps cuts */}
        <path d="M 32 75 C 32 75, 36 88, 50 88 C 64 88, 68 75, 68 75 Z" fill={`url(#bgGrad-${playerId})`} />
        {/* Jersey Collar V-Neck Trim */}
        <path
          d="M 40 75 L 50 84 L 60 75 L 56 75 L 50 81 L 44 75 Z"
          fill={secondaryColor}
        />
        {/* Left Strap Trim */}
        <path d="M 28 77 C 28 77, 30 83, 34 83 C 38 83, 39 77, 39 77 L 35 77 C 35 77, 34 80, 32 80 C 30 80, 30 77, 30 77 Z" fill={secondaryColor} opacity="0.8" />
        {/* Right Strap Trim */}
        <path d="M 61 77 C 61 77, 62 83, 66 83 C 70 83, 72 77, 72 77 L 70 77 C 70 77, 70 80, 68 80 C 66 80, 65 77, 65 77 Z" fill={secondaryColor} opacity="0.8" />
      </g>

      {/* 4. Ears */}
      <circle cx="34" cy="50" r="4.5" fill={skinTone} />
      <circle cx="66" cy="50" r="4.5" fill={skinTone} />
      {/* Inner Ear detail */}
      <path d="M 34.5 49 C 33.5 49, 33 50, 33.5 51" stroke="#000000" strokeWidth="0.5" opacity="0.15" fill="none" />
      <path d="M 65.5 49 C 66.5 49, 67 50, 66.5 51" stroke="#000000" strokeWidth="0.5" opacity="0.15" fill="none" />

      {/* 5. Face Outline */}
      {/* Dynamic cheek shape based on seed */}
      <path
        d="M 36 44 C 36 30, 64 30, 64 44 C 64 54, 60 62, 50 62 C 40 62, 36 54, 36 44 Z"
        fill={skinTone}
        filter="url(#soft-shadow)"
      />

      {/* 6. Eyes & Eyebrows */}
      <g>
        {/* Left Eyebrow */}
        <path
          d={
            eyeStyleIndex === 1
              ? "M 39 41 Q 43 38 46 42" // Angry/Fierce
              : eyeStyleIndex === 2
              ? "M 40 40 Q 43 37 47 39" // Confident
              : "M 40 41 Q 43 39 47 41" // Neutral
          }
          stroke="#1f1e24"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Right Eyebrow */}
        <path
          d={
            eyeStyleIndex === 1
              ? "M 61 41 Q 57 38 54 42" // Angry/Fierce
              : eyeStyleIndex === 2
              ? "M 60 40 Q 57 37 53 39" // Confident
              : "M 60 41 Q 57 39 53 41" // Neutral
          }
          stroke="#1f1e24"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left Eye */}
        <ellipse cx="43" cy="45" rx="3" ry="1.8" fill="#ffffff" stroke="#1f1e24" strokeWidth="0.5" />
        <circle cx="43" cy="45" r="1.5" fill="#2d1e18" /> {/* Pupil */}
        <circle cx="43.8" cy="44.2" r="0.5" fill="#ffffff" /> {/* Highlight */}

        {/* Right Eye */}
        <ellipse cx="57" cy="45" rx="3" ry="1.8" fill="#ffffff" stroke="#1f1e24" strokeWidth="0.5" />
        <circle cx="57" cy="45" r="1.5" fill="#2d1e18" /> {/* Pupil */}
        <circle cx="56.2" cy="44.2" r="0.5" fill="#ffffff" /> {/* Highlight */}
      </g>

      {/* 7. Nose */}
      <path d="M 49.5 45 L 49.5 51 Q 49.5 53 50.5 53" stroke="#000000" strokeWidth="0.8" opacity="0.25" fill="none" strokeLinecap="round" />

      {/* 8. Mouth */}
      <path
        d={
          mouthStyleIndex === 0
            ? "M 46 55 Q 50 59 54 55" // Smile
            : mouthStyleIndex === 1
            ? "M 45 56 L 55 56" // Determined Line
            : "M 47 55 C 47 55, 50 57, 53 55" // Soft Smirk
        }
        stroke="#1f1e24"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* 9. Hair Layer */}
      <g>
        {/* Buzz Cut */}
        {hairStyleIndex === 0 && (
          <path
            d="M 36 41 C 36 30, 64 30, 64 41 C 64 39, 61 36, 50 36 C 39 36, 36 39, 36 41 Z"
            fill={hairColor}
          />
        )}

        {/* Short Fade / Crops */}
        {hairStyleIndex === 1 && (
          <path
            d="M 35 39 C 35 24, 65 24, 65 39 C 65 37, 62 31, 50 31 C 38 31, 35 37, 35 39 Z"
            fill={hairColor}
          />
        )}

        {/* Parted Sweep */}
        {hairStyleIndex === 2 && (
          <g>
            <path
              d="M 35 38 C 36 22, 64 22, 65 38 C 62 26, 44 26, 35 38 Z"
              fill={hairColor}
            />
            {/* Swoop Fringe */}
            <path d="M 35 38 Q 45 36 50 41 Q 44 41 38 43 Z" fill={hairColor} />
          </g>
        )}

        {/* Curly Crop / Textured */}
        {hairStyleIndex === 3 && (
          <path
            d="M 35 39 Q 37 32 42 33 Q 46 27 50 30 Q 55 26 59 31 Q 64 30 65 39 C 62 32, 59 33, 50 33 C 41 33, 38 32, 35 39 Z"
            fill={hairColor}
          />
        )}

        {/* High Spiky Cut */}
        {hairStyleIndex === 4 && (
          <path
            d="M 35 39 C 35 26, 65 26, 65 39 L 63 32 Q 58 29 50 33 Q 42 29 37 32 Z"
            fill={hairColor}
          />
        )}

        {/* Top Knot / Bun */}
        {hairStyleIndex === 5 && (
          <g>
            {/* Bun */}
            <circle cx="50" cy="24" r="4" fill={hairColor} />
            {/* Shaved / Under layer */}
            <path
              d="M 36 42 C 36 31, 64 31, 64 42 C 63 37, 60 33, 50 33 C 40 33, 37 37, 36 42 Z"
              fill={hairColor}
            />
          </g>
        )}
      </g>

      {/* Position Badge overlay in the corner */}
      <rect x="3" y="3" width="16" height="8" rx="3" fill="#18181b" opacity="0.8" stroke="#27272a" strokeWidth="0.5" />
      <text x="11" y="9" textAnchor="middle" fill="#a1a1aa" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">
        {position}
      </text>
    </svg>
  );
}
