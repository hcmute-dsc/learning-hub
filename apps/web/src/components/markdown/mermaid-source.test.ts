import { describe, expect, it } from 'vitest';
import { mermaidSource } from './mermaid-source';

const text = (value: string) => ({ type: 'text', value });
const pre = (className: string[], ...children: { type: string; value?: string }[]) => ({
  type: 'element',
  tagName: 'pre',
  children: [{ type: 'element', tagName: 'code', properties: { className }, children }],
});

describe('mermaidSource', () => {
  it('returns the source of a mermaid fence without the trailing newline', () => {
    expect(mermaidSource(pre(['language-mermaid'], text('flowchart LR\n  A --> B\n')))).toBe(
      'flowchart LR\n  A --> B',
    );
  });

  it('joins text split into several nodes', () => {
    expect(mermaidSource(pre(['language-mermaid'], text('graph TD\n'), text('A-->B')))).toBe(
      'graph TD\nA-->B',
    );
  });

  it('ignores other code blocks and empty input', () => {
    expect(mermaidSource(pre(['language-sql'], text('SELECT 1')))).toBeNull();
    expect(mermaidSource(pre([], text('plain')))).toBeNull();
    expect(mermaidSource(undefined)).toBeNull();
  });
});
