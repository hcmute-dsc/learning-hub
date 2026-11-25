import { isSafeLinkUrl, issueMarkdown } from './issue-markdown';

const Z = '​';

describe('issueMarkdown', () => {
  it('keeps ordinary Markdown as it is', () => {
    const text = '**Sai:** câu đầu\n\n- một\n- hai\n\n> trích';
    expect(issueMarkdown(text)).toBe(text);
  });

  it('stops @mentions and team mentions from pinging anyone', () => {
    const out = issueMarkdown('Hỏi @user và @hcmute-dsc/mentors nhé');
    expect(out).toBe(`Hỏi @${Z}user và @${Z}hcmute-dsc/mentors nhé`);
    expect(out).not.toMatch(/@[A-Za-z0-9]/);
  });

  it('stops #12, GH-12 and owner/repo#12 from linking to issues', () => {
    expect(issueMarkdown('Xem #12, gh-7 và hcmute-dsc/learning-hub#121')).toBe(
      `Xem #${Z}12, gh${Z}-7 và hcmute-dsc/learning-hub#${Z}121`,
    );
    // A heading is not a reference.
    expect(issueMarkdown('# Tiêu đề')).toBe('# Tiêu đề');
  });

  it('leaves URLs alone', () => {
    const text = 'https://medium.com/@someone/post#12 và www.example.com/@a';
    expect(issueMarkdown(text)).toBe(text);
  });

  it('shows HTML as text: <img onerror>, <script>, comments', () => {
    expect(issueMarkdown('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)>');
    expect(issueMarkdown('<script>alert(1)</script>')).toBe('&lt;script>alert(1)&lt;/script>');
    expect(issueMarkdown('a <!-- ẩn --> b')).toBe('a &lt;!-- ẩn --> b');
    expect(issueMarkdown('<details>\n<summary>x</summary>')).not.toContain('<');
  });

  it('keeps a < that a backslash already made plain text', () => {
    expect(issueMarkdown('a \\<b> c')).toBe('a \\<b> c');
    expect(issueMarkdown('a \\\\<b>')).toBe('a \\\\&lt;b>');
  });

  it('keeps fenced code blocks intact, without touching what is inside', () => {
    const text = 'Lệnh sai:\n\n```sql\nSELECT * FORM users; -- @admin #12 <b>\n```\n\nhết';
    expect(issueMarkdown(text)).toBe(text);
  });

  it('re-fences a block containing ``` or ~~~ so it cannot be closed early', () => {
    const out = issueMarkdown('~~~~md\n```\n~~~\n@user <b>\n~~~~\nsau @x');
    expect(out).toBe(`\`\`\`\`md\n\`\`\`\n~~~\n@user <b>\n\`\`\`\`\nsau @${Z}x`);
  });

  it('closes an unclosed fence at the end of the text', () => {
    const out = issueMarkdown('trước @a\n```js\nconsole.log("@b")');
    expect(out).toBe(`trước @${Z}a\n\`\`\`js\nconsole.log("@b")\n\`\`\``);
  });

  it('drops an info string that is not a plain language name', () => {
    expect(issueMarkdown('```<img src=x>\ncode\n```')).toBe('```\ncode\n```');
    expect(issueMarkdown('``` c++ extra\nx\n```')).toBe('```c++\nx\n```');
  });

  it('treats ``` with a backtick in its info string as text, like CommonMark', () => {
    expect(issueMarkdown('``` a`b <i>')).toBe('``` a`b &lt;i>');
  });

  it('removes the opening fence indentation from the code', () => {
    expect(issueMarkdown('  ```\n  a\n    b\n  ```')).toBe('```\na\n  b\n```');
  });

  it('keeps inline code as it is when the code spans are certain', () => {
    expect(issueMarkdown('Dùng `<div>` thay `<span>`')).toBe('Dùng `<div>` thay `<span>`');
    expect(issueMarkdown('Dùng ``a ` <b>`` ở đây')).toBe('Dùng ``a ` <b>`` ở đây');
  });

  it('escapes inside inline code when a backtick could pair differently', () => {
    // GitHub pairs the first ` with the one on the next line, so <img> would be HTML.
    expect(issueMarkdown('`a\n`<img>`')).toBe('`a\n`&lt;img>`');
    // A backslash-escaped backtick does not open a span.
    expect(issueMarkdown('\\`<b>`')).toBe('\\`&lt;b>`');
    // In a table row the | splits the cell before code spans are found.
    expect(issueMarkdown('| `a | <b>` |')).toBe('| `a | &lt;b>` |');
  });

  it('judges each paragraph on its own', () => {
    expect(issueMarkdown('`a\n\n`<b>`')).toBe('`a\n\n`<b>`');
  });

  it('drops javascript: and data: links but keeps their text', () => {
    expect(issueMarkdown('[x](javascript:alert(1))')).toBe('[x]');
    expect(issueMarkdown('![a](data:image/png;base64,AAAA) sau')).toBe('![a] sau');
    expect(issueMarkdown('[x](<javascript:alert(1)>)')).toBe('[x]');
    expect(issueMarkdown('[x](\njavascript:alert(1) "t")')).toBe('[x]');
    expect(issueMarkdown('[x](&#106;avascript:alert(1))')).toBe('[x]');
    expect(issueMarkdown('[x](JaVaScRiPt:alert(1))')).toBe('[x]');
  });

  it('keeps http(s), mailto and relative links', () => {
    const text = '[a](https://x.dev/a_(b)) [b](mailto:x@y.z) [c](/lessons/1) [d](#muc)';
    expect(issueMarkdown(text)).toBe(
      '[a](https://x.dev/a_(b)) [b](mailto:x@y.z) [c](/lessons/1) [d](#muc)',
    );
  });

  it('turns a reference definition with an unsafe URL into text', () => {
    expect(issueMarkdown('[x]: javascript:alert(1)')).toBe('\\[x]: javascript:alert(1)');
    expect(issueMarkdown('[x]: https://ok.dev')).toBe('[x]: https://ok.dev');
  });

  it('accepts Windows line endings', () => {
    expect(issueMarkdown('a\r\n```\r\nb\r\n```')).toBe('a\n```\nb\n```');
  });

  it('handles very long input quickly', () => {
    const text = `${'@a <b> #1 `c` [x](javascript:y) '.repeat(20000)}\n\`\`\`\nx${'`'.repeat(5000)}`;
    const started = Date.now();
    const out = issueMarkdown(text);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(out).not.toMatch(/@[a-z]/);
    expect(out).not.toContain('javascript:y)');
    expect(out.endsWith(`${'`'.repeat(5001)}`)).toBe(true);
  });
});

describe('isSafeLinkUrl', () => {
  it('allows web, mail and relative links only', () => {
    expect(isSafeLinkUrl('https://a.dev')).toBe(true);
    expect(isSafeLinkUrl('HTTP://a.dev')).toBe(true);
    expect(isSafeLinkUrl('mailto:a@b.c')).toBe(true);
    expect(isSafeLinkUrl('../x?y=1')).toBe(true);
    expect(isSafeLinkUrl('')).toBe(true);
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeLinkUrl('data:text/html,x')).toBe(false);
    expect(isSafeLinkUrl('vbscript:x')).toBe(false);
    expect(isSafeLinkUrl('javascript&#58;x')).toBe(false);
    expect(isSafeLinkUrl('javascript\\:x')).toBe(false);
  });
});
