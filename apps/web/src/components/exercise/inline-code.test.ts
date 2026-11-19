import { describe, expect, it } from 'vitest';
import { splitInlineCode } from './inline-code';

describe('splitInlineCode', () => {
  it('keeps text without backticks as one plain part', () => {
    expect(splitInlineCode('Không có code')).toEqual([{ code: false, text: 'Không có code' }]);
  });

  it('turns text between backticks into code', () => {
    expect(splitInlineCode('Discord trả `204 No Content`. Nghĩa là gì?')).toEqual([
      { code: false, text: 'Discord trả ' },
      { code: true, text: '204 No Content' },
      { code: false, text: '. Nghĩa là gì?' },
    ]);
  });

  it('handles code at the start, at the end and several pairs', () => {
    expect(splitInlineCode('`uid` và `slug`')).toEqual([
      { code: true, text: 'uid' },
      { code: false, text: ' và ' },
      { code: true, text: 'slug' },
    ]);
  });

  it('keeps JSON-like code with quotes and braces', () => {
    expect(splitInlineCode('`{"parse": []}`')).toEqual([{ code: true, text: '{"parse": []}' }]);
  });

  it('leaves a lone, unclosed or empty pair of backticks as written', () => {
    expect(splitInlineCode('a ` b')).toEqual([{ code: false, text: 'a ` b' }]);
    expect(splitInlineCode('`a` and `b')).toEqual([
      { code: true, text: 'a' },
      { code: false, text: ' and `b' },
    ]);
    expect(splitInlineCode('``')).toEqual([{ code: false, text: '``' }]);
  });

  it('does not join backticks across lines', () => {
    expect(splitInlineCode('`a\nb`')).toEqual([{ code: false, text: '`a\nb`' }]);
  });

  it('returns one empty plain part for an empty string', () => {
    expect(splitInlineCode('')).toEqual([{ code: false, text: '' }]);
  });
});
