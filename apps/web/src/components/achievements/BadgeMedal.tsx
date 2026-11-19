import type { CSSProperties } from 'react';
import { badgeTone, type BadgeCard } from './achievements';

/**
 * The round medal of one badge (learning-hub#74): a gradient in the badge's own colour
 * (BADGE_TONES), a light inner ring and a soft glow, with the emoji in the middle.
 * A locked badge is a grey dashed disc with a faded emoji. Purely decorative: the title
 * and date next to it carry the meaning, so it is hidden from screen readers.
 * Styles: `.badge-medal` in globals.css.
 */
export function BadgeMedal({ card, size = 'md' }: { card: BadgeCard; size?: 'sm' | 'md' }) {
  const earned = card.awardedAt !== null;
  return (
    <span
      aria-hidden
      data-size={size}
      data-locked={earned ? undefined : ''}
      className="badge-medal"
      style={badgeStyle(card.code)}
    >
      <span className="badge-medal-icon">{card.icon}</span>
    </span>
  );
}

/** CSS variables for a badge's colour, set on the medal or on the whole tile. */
export function badgeStyle(code: string): CSSProperties {
  const tone = badgeTone(code);
  return { '--badge-from': tone.from, '--badge-to': tone.to } as CSSProperties;
}
