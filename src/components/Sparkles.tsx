// Decorative twinkling stars in brand colors. Purely visual (aria-hidden) and
// still when the viewer prefers reduced motion.

const STAR = "M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z";

type Star = { x: number; y: number; size: number; color: string; delay: number; kind?: "star" | "dot" };

const HERO_STARS: Star[] = [
  { x: 4, y: 18, size: 22, color: "#2db091", delay: 0 },
  { x: 11, y: 62, size: 12, color: "#83dbc2", delay: 1.2 },
  { x: 18, y: 8, size: 6, color: "#50c9aa", delay: 0.6, kind: "dot" },
  { x: 24, y: 82, size: 8, color: "#83dbc2", delay: 2.1, kind: "dot" },
  { x: 76, y: 6, size: 14, color: "#50c9aa", delay: 0.9 },
  { x: 84, y: 70, size: 24, color: "#83dbc2", delay: 1.7 },
  { x: 93, y: 28, size: 10, color: "#2db091", delay: 0.3 },
  { x: 68, y: 88, size: 6, color: "#2db091", delay: 2.4, kind: "dot" },
  { x: 97, y: 92, size: 7, color: "#50c9aa", delay: 1.1, kind: "dot" },
  { x: 2, y: 90, size: 9, color: "#50c9aa", delay: 1.9 },
];

const LOGO_STARS: Star[] = [
  { x: 4, y: 20, size: 12, color: "#2db091", delay: 0.4 },
  { x: 14, y: 70, size: 5, color: "#83dbc2", delay: 1.4, kind: "dot" },
  { x: 92, y: 18, size: 9, color: "#50c9aa", delay: 1 },
  { x: 86, y: 76, size: 5, color: "#2db091", delay: 2, kind: "dot" },
];

export function Sparkles({ variant = "hero" }: { variant?: "hero" | "logo" }) {
  const stars = variant === "hero" ? HERO_STARS : LOGO_STARS;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={i}
          className="sparkle absolute"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
        >
          {s.kind === "dot" ? (
            <span className="block h-full w-full rounded-full" style={{ background: s.color }} />
          ) : (
            <svg viewBox="0 0 24 24" className="h-full w-full">
              <path d={STAR} fill={s.color} />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
