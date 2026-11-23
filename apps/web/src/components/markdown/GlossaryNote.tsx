'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { GlossaryTerm } from '@hub/shared';

/** Space between the word and its note, and between the note and the screen edge. */
const GAP = 6;
const EDGE = 8;

/**
 * The first use of a new word in a lesson (learning-hub#106): a dotted underline, and a short
 * note with its full form, literal meaning and meaning.
 *
 * The word is a button inside <dfn>, so the note opens on tap, click, Enter or Space, not only
 * on hover; `popovertarget` tells screen readers whether it is open. The note is a native
 * popover: it sits above everything (tables and code boxes do
 * not clip it), and Esc or a tap elsewhere closes it. It is placed under the word, kept inside
 * the screen (a phone is 375px wide), and above the word when there is no room below.
 */
export function GlossaryNote({
  term,
  href,
  children,
}: {
  term: GlossaryTerm;
  /** the term on the track's "Từ vựng" page */
  href: string;
  children: ReactNode;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const note = noteRef.current;
    if (!button || !note) return;

    const place = () => {
      const word = button.getBoundingClientRect();
      const width = note.offsetWidth;
      const height = note.offsetHeight;
      const left = Math.max(EDGE, Math.min(word.left, window.innerWidth - width - EDGE));
      const below = word.bottom + GAP;
      const above = word.top - GAP - height;
      const fitsBelow = below + height <= window.innerHeight - EDGE;
      note.style.left = `${left}px`;
      note.style.top = `${fitsBelow || above < EDGE ? below : above}px`;
    };
    const isOpening = (event: Event) =>
      (event as Event & { newState?: string }).newState === 'open';
    // Hidden until placed, so the note never flashes at the browser's default spot.
    const onBeforeToggle = (event: Event) => {
      if (isOpening(event)) note.style.visibility = 'hidden';
    };
    const onToggle = (event: Event) => {
      if (isOpening(event)) {
        place();
        note.style.visibility = '';
        window.addEventListener('scroll', place, { capture: true, passive: true });
        window.addEventListener('resize', place);
      } else {
        window.removeEventListener('scroll', place, { capture: true });
        window.removeEventListener('resize', place);
      }
    };
    note.addEventListener('beforetoggle', onBeforeToggle);
    note.addEventListener('toggle', onToggle);
    return () => {
      note.removeEventListener('beforetoggle', onBeforeToggle);
      note.removeEventListener('toggle', onToggle);
      window.removeEventListener('scroll', place, { capture: true });
      window.removeEventListener('resize', place);
    };
  }, []);

  return (
    <dfn className="glossary-term">
      <button ref={buttonRef} type="button" popoverTarget={id} className="glossary-term-button">
        {children}
      </button>
      <span ref={noteRef} id={id} popover="auto" role="note" className="glossary-note">
        <span className="glossary-note-title">
          <strong lang="en">{term.term}</strong>
          {term.expansion && (
            <>
              {' '}
              = <em lang="en">{term.expansion}</em>
            </>
          )}
        </span>
        {term.literal && (
          <span className="glossary-note-line">
            <span className="muted">Nghĩa đen:</span> {term.literal}
          </span>
        )}
        <span className="glossary-note-line">{term.meaning}</span>
        {term.example && (
          <span className="glossary-note-line">
            <span className="muted">Ví dụ:</span> <code>{term.example}</code>
          </span>
        )}
        <a href={href} className="glossary-note-link">
          Xem trong Từ vựng →
        </a>
      </span>
    </dfn>
  );
}
