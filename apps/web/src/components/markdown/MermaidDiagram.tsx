'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/** Smallest scale a diagram is shrunk to so it fits the column; below it, it scrolls. */
const MIN_SCALE = 0.7;

/**
 * Draws one ```mermaid block of a lesson (flowcharts, ER diagrams, sequences…).
 *
 * The Mermaid library is large, so it is loaded only on pages that have a diagram,
 * and only in the browser. Until it is drawn, or if the source has an error, the
 * reader sees the diagram source as a code block, so nothing is ever blank.
 *
 * SECURITY §3: lesson content is untrusted. securityLevel "strict" makes Mermaid clean
 * every label and turns off click handlers and HTML labels before it returns the SVG.
 *
 * The diagram follows the color scheme (<html data-theme> from /settings, else the
 * device) and is drawn again when it changes.
 */
export function MermaidDiagram({ code }: { code: string }) {
  const baseId = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = boxRef.current?.querySelector('svg');
    if (el) fitToColumn(el);
  }, [svg]);

  useEffect(() => {
    let cancelled = false;
    let round = 0;

    async function draw() {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDark() ? 'dark' : 'default',
          fontFamily: getComputedStyle(document.body).fontFamily,
          // Natural size in px; fitToColumn() below decides how much to shrink it.
          flowchart: { useMaxWidth: false },
          sequence: { useMaxWidth: false },
          er: { useMaxWidth: false },
          state: { useMaxWidth: false },
          class: { useMaxWidth: false },
        });
        round += 1;
        const result = await mermaid.render(`${baseId}-${round}`, code);
        if (!cancelled) {
          setSvg(result.svg);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void draw();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', draw);
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    return () => {
      cancelled = true;
      media.removeEventListener('change', draw);
      observer.disconnect();
    };
  }, [baseId, code]);

  if (!svg) {
    return (
      <div>
        <pre tabIndex={0}>
          <code>{code}</code>
        </pre>
        {failed && (
          <p className="muted mt-1 text-xs">Không vẽ được sơ đồ này, đang hiện mã nguồn của nó.</p>
        )}
      </div>
    );
  }

  return (
    <figure className="mermaid-figure">
      <div
        ref={boxRef}
        className="mermaid-diagram"
        role="img"
        aria-label="Sơ đồ (mã nguồn ở mục bên dưới)"
        tabIndex={0}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <details className="mt-2 text-sm">
        <summary className="muted cursor-pointer">Xem mã sơ đồ</summary>
        <pre tabIndex={0}>
          <code>{code}</code>
        </pre>
      </details>
    </figure>
  );
}

function isDark(): boolean {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Shrinks a wide diagram to the text column, but never below MIN_SCALE of its natural
 * size: fitting a long flowchart completely made its labels unreadable (17/11/2026).
 * Anything still wider scrolls inside .mermaid-diagram.
 */
function fitToColumn(svg: SVGSVGElement) {
  const natural = svg.viewBox.baseVal?.width || svg.getBoundingClientRect().width;
  if (!natural) return;
  svg.removeAttribute('height');
  svg.style.height = 'auto';
  svg.style.maxWidth = `${natural}px`;
  svg.style.width = `max(100%, ${Math.round(natural * MIN_SCALE)}px)`;
}
