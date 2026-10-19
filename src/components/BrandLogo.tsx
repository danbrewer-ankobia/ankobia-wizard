// The Ankobia logo with a wizard hat perched on the first "a".
// Coordinates match the 383x154 logo PNG, so the hat stays put at any size.
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-14 -58 397 212" className={className} role="img" aria-label="Ankobia Wizard">
      <image href="/ankobia-logo.png" x="0" y="0" width="383" height="154" />
      <g transform="rotate(-12 34 62)">
        {/* cone, with a floppy tip */}
        <path d="M2 62 C 16 34, 26 -2, 40 -34 C 48 -50, 62 -50, 70 -40 C 60 -40, 54 -30, 54 -14 C 54 14, 60 40, 68 62 Z" fill="#194073" />
        {/* band */}
        <path d="M6 52 C 26 46, 46 46, 64 52 L 67 61 C 46 54.5, 24 54.5, 3 61 Z" fill="#2db091" />
        {/* brim */}
        <ellipse cx="35" cy="62" rx="40" ry="7.5" fill="#164773" />
        {/* stars */}
        <path d="M36 4 l2.6 5.6 6 .6-4.6 4 1.4 6-5.4-3.2-5.4 3.2 1.4-6-4.6-4 6-.6z" fill="#83dbc2" />
        <path d="M24 30 l1.8 3.8 4 .4-3 2.7 .9 4-3.7-2.1-3.7 2.1.9-4-3-2.7 4-.4z" fill="#50c9aa" />
        <circle cx="46" cy="34" r="2.4" fill="#83dbc2" />
        <circle cx="44" cy="-18" r="2" fill="#83dbc2" />
        <circle cx="69" cy="-41" r="4" fill="#2db091" />
      </g>
    </svg>
  );
}
