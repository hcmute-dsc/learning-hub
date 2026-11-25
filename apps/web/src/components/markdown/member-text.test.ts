import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';
import { MEMBER_LINK_REL, memberText, type MdNode } from './member-text';

const render = (source: string) =>
  renderToStaticMarkup(createElement(Markdown, { source, from: 'member' }));

describe('memberText', () => {
  it('turns inline html into text, and block html into a paragraph of text', () => {
    const tree: MdNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'html', value: '<b>' }] },
        { type: 'html', value: '<div>' },
      ],
    };
    memberText(tree);
    expect(tree.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '<b>' }] },
      { type: 'paragraph', children: [{ type: 'text', value: '<div>' }] },
    ]);
  });

  it('keeps line breaks, and leaves code alone', () => {
    const tree: MdNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Sai: a\nNên là: b' }] },
        { type: 'code', value: 'x\ny' },
      ],
    };
    memberText(tree);
    expect(tree.children).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Sai: a' },
          { type: 'break' },
          { type: 'text', value: 'Nên là: b' },
        ],
      },
      { type: 'code', value: 'x\ny' },
    ]);
  });
});

describe('Markdown from="member"', () => {
  it('renders Markdown and code blocks', () => {
    const html = render('**Sai:** `x`\n\n```sql\nSELECT 1;\n```');
    expect(html).toContain('<strong>Sai:</strong>');
    expect(html).toContain('<code>x</code>');
    expect(html).toContain('SELECT');
    expect(html).toContain('<pre');
  });

  it('keeps the line break between "Sai" and "Nên là"', () => {
    expect(render('Sai: a\nNên là: b')).toContain('Sai: a<br/>');
  });

  it('shows raw HTML as text, never as elements', () => {
    const html = render('<img src=x onerror=alert(1)> <script>alert(1)</script>\n\n<!-- ẩn -->');
    expect(html).not.toMatch(/<img|<script|<!--/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;!-- ẩn --&gt;');
  });

  it('drops javascript: links and marks the others nofollow', () => {
    const html = render('[x](javascript:alert(1)) [y](https://example.com)');
    expect(html).not.toContain('javascript:');
    expect(html).toContain(`href="https://example.com" rel="${MEMBER_LINK_REL}"`);
  });

  it('shows an image inside a link as a label, never a link in a link', () => {
    const html = render('[![badge](https://x.dev/b.png)](https://x.dev)');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('badge');
    expect(html).not.toContain('<img');
  });

  it('shows an image as a link instead of loading it', () => {
    const html = render('![ảnh lỗi](https://tracker.example/p.png) ![](data:image/png;base64,AA)');
    expect(html).not.toContain('<img');
    expect(html).toContain('href="https://tracker.example/p.png"');
    expect(html).toContain('ảnh lỗi');
    expect(html).not.toContain('data:');
  });
});
