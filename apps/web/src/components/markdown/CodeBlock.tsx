'use client';

import { useRef, useState, type ComponentPropsWithoutRef } from 'react';
import { useOverflowFlag } from './use-overflow';

/**
 * A code block of a lesson with a "Chép" (copy) button in its top-right corner.
 * The highlighted code itself is still rendered on the server (rehype-highlight);
 * this only wraps it, and copies the plain text the reader sees.
 */
export function CodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useOverflowFlag(preRef);

  async function copy() {
    const text = preRef.current?.innerText.replace(/\n$/, '') ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // No clipboard access (old browser, plain http): select the code so Ctrl+C works.
      const selection = window.getSelection();
      if (preRef.current && selection) selection.selectAllChildren(preRef.current);
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2000);
  }

  const label = { idle: 'Chép', copied: '✓ Đã chép', failed: 'Bấm Ctrl+C' }[state];
  return (
    <div className="code-block group/code relative">
      <pre ref={preRef} tabIndex={0} {...props} />
      <button
        type="button"
        onClick={copy}
        aria-label="Chép đoạn code"
        className="press absolute top-2 right-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-sans text-xs opacity-80 transition-opacity group-hover/code:opacity-100 hover:border-brand-500 focus-visible:opacity-100 sm:opacity-0"
      >
        <span aria-live="polite">{label}</span>
      </button>
    </div>
  );
}
