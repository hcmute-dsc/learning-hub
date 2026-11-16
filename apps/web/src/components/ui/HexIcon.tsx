/**
 * Hexagon badge for a track, in the spirit of Exercism's track icons. The label is a
 * short text (e.g. "SQL", "Git") from lib/track-icon.ts, so no image per track is needed.
 */
export function HexIcon({
  label,
  size = 56,
  className = '',
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <polygon
          points="50,3 93,27 93,73 50,97 7,73 7,27"
          className="fill-brand-50 stroke-brand-500"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="relative font-mono font-bold text-brand-700"
        style={{ fontSize: size * (label.length > 3 ? 0.22 : 0.28) }}
      >
        {label}
      </span>
    </span>
  );
}
