// LogoMark — menara sentry TrendSentry.
//
// The tower takes its colour from the active theme's tokens, not from a prop.
// The old `tone` switch ("cream, because this sits on black") stopped meaning
// anything once the canvas became light: every caller sits on --color-canvas,
// and a cream tower would vanish against it. Deleting the prop removes a
// footgun instead of leaving something that lies.
//
// Colours go through `style`, not the fill/stroke attributes: presentation
// attributes are parsed as SVG values and do NOT resolve var(), so a
// theme-swappable mark has to use CSS declarations.
export default function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="TrendSentry">
      {/* cap */}
      <rect x="12" y="5" width="24" height="6" rx="1.5" style={{ fill: "var(--color-primary)" }} />
      <rect x="9" y="7.5" width="5" height="3.5" rx="1" style={{ fill: "var(--color-primary)" }} />
      <rect x="34" y="7.5" width="5" height="3.5" rx="1" style={{ fill: "var(--color-primary)" }} />
      {/* legs */}
      <path d="M16.5 13 L13.5 41" style={{ stroke: "var(--color-primary)" }} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M24 14 L24 41" style={{ stroke: "var(--color-primary)" }} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M31.5 13 L34.5 41" style={{ stroke: "var(--color-primary)" }} strokeWidth="4.5" strokeLinecap="round" />
      {/* base */}
      <rect x="11" y="41" width="26" height="4" rx="1.5" style={{ fill: "var(--color-primary)" }} />
      {/* brand slash */}
      <polygon points="17,9 23.5,9 19.5,20 14.5,20" style={{ fill: "var(--brand-mint)" }} />
    </svg>
  );
}