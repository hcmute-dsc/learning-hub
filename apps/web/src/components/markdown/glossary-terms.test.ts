import { describe, expect, it } from 'vitest';
import { markFirstUses } from './glossary-terms';

// learning-hub#106: the first use of each new word gets a note; never in code or headings.

type Node = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: object;
  children?: Node[];
};

const text = (value: string): Node => ({ type: 'text', value });
const el = (tagName: string, ...children: Node[]): Node => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});
const root = (...children: Node[]): Node => ({ type: 'root', children });

const INIT = { term: 'init', anchor: 'init' };
const REPO = { term: 'repository', anchor: 'repository' };
const PR = { term: 'pull request', anchor: 'pull-request' };

/** The tree as compact text: dfn shows as [word→anchor]. */
function show(node: Node): string {
  if (node.type === 'text') return node.value ?? '';
  const inner = (node.children ?? []).map(show).join('');
  if (node.tagName === 'dfn')
    return `[${inner}→${(node.properties as { dataGlossary?: string }).dataGlossary}]`;
  return node.type === 'root' ? inner : `<${node.tagName}>${inner}</${node.tagName}>`;
}

describe('markFirstUses', () => {
  it('marks only the first use of each term', () => {
    const tree = root(el('p', text('Lệnh init tạo repository. Chạy init lần nữa vô hại.')));
    expect(show(markFirstUses(tree, [INIT, REPO]))).toBe(
      '<p>Lệnh [init→init] tạo [repository→repository]. Chạy init lần nữa vô hại.</p>',
    );
  });

  it('matches whole words in any case, keeping the text as written', () => {
    const tree = root(el('p', text('initial, reinit, Init.')));
    expect(show(markFirstUses(tree, [INIT]))).toBe('<p>initial, reinit, [Init→init].</p>');
  });

  it('never marks words in code, headings or links, and uses the next plain use', () => {
    const tree = root(
      el('h2', text('init')),
      el('pre', el('code', text('git init'))),
      el('p', el('code', text('init')), text(' và '), el('a', text('init'))),
      el('p', text('Sau đó init.')),
    );
    expect(show(markFirstUses(tree, [INIT]))).toBe(
      '<h2>init</h2><pre><code>git init</code></pre><p><code>init</code> và <a>init</a></p><p>Sau đó [init→init].</p>',
    );
  });

  it('finds terms inside emphasis and lists', () => {
    const tree = root(el('ul', el('li', el('strong', text('Repository')), text(' là kho.'))));
    expect(show(markFirstUses(tree, [REPO]))).toBe(
      '<ul><li><strong>[Repository→repository]</strong> là kho.</li></ul>',
    );
  });

  it('matches terms of several words across any spaces, longest first', () => {
    const pull = { term: 'pull', anchor: 'pull' };
    const tree = root(el('p', text('Mở một pull\nrequest, rồi pull về.')));
    expect(show(markFirstUses(tree, [pull, PR]))).toBe(
      '<p>Mở một [pull\nrequest→pull-request], rồi [pull→pull] về.</p>',
    );
  });

  it('treats regex characters in a term as plain text', () => {
    const head = { term: 'HEAD~1', anchor: 'head-1' };
    const tree = root(el('p', text('HEADx1 khác HEAD~1.')));
    expect(show(markFirstUses(tree, [head]))).toBe('<p>HEADx1 khác [HEAD~1→head-1].</p>');
  });

  it('changes nothing without terms', () => {
    const tree = root(el('p', text('init')));
    expect(show(markFirstUses(tree, []))).toBe('<p>init</p>');
  });
});
