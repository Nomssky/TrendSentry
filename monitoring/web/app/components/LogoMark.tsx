// LogoMark — menara sentry TrendSentry.
// tone="dark": menara ink untuk latar terang. tone="light": menara cream untuk latar gelap.
// Slash lime = aksen brand (identity: obsidian + lime).
export default function LogoMark({
  tone = "light",
  className = "h-9 w-9",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const tower = tone === "dark" ? "#0a1428" : "#f3efe6";
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="TrendSentry">
      {/* cap */}
      <rect x="12" y="5" width="24" height="6" rx="1.5" fill={tower} />
      <rect x="9" y="7.5" width="5" height="3.5" rx="1" fill={tower} />
      <rect x="34" y="7.5" width="5" height="3.5" rx="1" fill={tower} />
      {/* legs */}
      <path d="M16.5 13 L13.5 41" stroke={tower} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M24 14 L24 41" stroke={tower} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M31.5 13 L34.5 41" stroke={tower} strokeWidth="4.5" strokeLinecap="round" />
      {/* base */}
      <rect x="11" y="41" width="26" height="4" rx="1.5" fill={tower} />
      {/* lime slash */}
      <polygon points="17,9 23.5,9 19.5,20 14.5,20" fill="#ccff00" />
    </svg>
  );
}
