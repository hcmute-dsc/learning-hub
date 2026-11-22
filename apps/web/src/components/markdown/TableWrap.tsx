'use client';

import { useRef, type ComponentPropsWithoutRef } from 'react';
import { useOverflowFlag } from './use-overflow';

/**
 * A Markdown table. Wide tables scroll inside this box instead of squeezing the columns,
 * the box is reachable by keyboard (FRONTEND-DESIGN §9), and on a phone the edge with
 * more to scroll to fades (learning-hub#103).
 */
export function TableWrap(props: ComponentPropsWithoutRef<'table'>) {
  const ref = useRef<HTMLDivElement>(null);
  useOverflowFlag(ref);
  return (
    <div ref={ref} className="table-wrap" tabIndex={0}>
      <table {...props} />
    </div>
  );
}
