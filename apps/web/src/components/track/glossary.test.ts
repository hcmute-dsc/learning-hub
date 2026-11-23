import { describe, expect, it } from 'vitest';
import {
  foldText,
  glossaryGroups,
  glossaryHref,
  glossaryLetter,
  letterId,
  matchesGlossaryQuery,
} from './glossary';

// learning-hub#106: the "Từ vựng" tab of a track.

const term = (name: string, over: object = {}) => ({
  term: name,
  expansion: null,
  literal: null,
  meaning: 'x',
  ...over,
});

describe('glossaryHref', () => {
  it('links to the page, or to one term on it', () => {
    expect(glossaryHref('git')).toBe('/tracks/git/glossary');
    expect(glossaryHref('git', 'pull-request')).toBe('/tracks/git/glossary#pull-request');
  });
});

describe('foldText', () => {
  it('drops Vietnamese marks and case', () => {
    expect(foldText('Khởi tạo ĐƯỜNG')).toBe('khoi tao duong');
  });
});

describe('glossaryLetter', () => {
  it('files terms under A–Z, and anything else under #', () => {
    expect(glossaryLetter('init')).toBe('I');
    expect(glossaryLetter('HEAD')).toBe('H');
    expect(glossaryLetter('.gitignore')).toBe('#');
    expect(glossaryLetter('2FA')).toBe('#');
  });
});

describe('letterId', () => {
  it('gives # a name that works as an id', () => {
    expect(letterId('A')).toBe('letter-A');
    expect(letterId('#')).toBe('letter-other');
  });
});

describe('glossaryGroups', () => {
  it('sorts A–Z ignoring case and puts # last', () => {
    const groups = glossaryGroups([
      term('repository'),
      term('.gitignore'),
      term('Commit'),
      term('branch'),
      term('clone'),
    ]);
    expect(groups.map((g) => [g.letter, g.terms.map((t) => t.term)])).toEqual([
      ['B', ['branch']],
      ['C', ['clone', 'Commit']],
      ['R', ['repository']],
      ['#', ['.gitignore']],
    ]);
  });

  it('is empty for no terms', () => {
    expect(glossaryGroups([])).toEqual([]);
  });
});

describe('matchesGlossaryQuery', () => {
  const init = term('init', {
    expansion: 'initialize',
    literal: 'khởi tạo',
    meaning: 'Tạo thư mục .git',
  });

  it('matches everything for an empty query', () => {
    expect(matchesGlossaryQuery(init, '  ')).toBe(true);
  });

  it('searches the term, full form, literal meaning and meaning, without marks', () => {
    expect(matchesGlossaryQuery(init, 'INIT')).toBe(true);
    expect(matchesGlossaryQuery(init, 'initialize')).toBe(true);
    expect(matchesGlossaryQuery(init, 'khoi tao')).toBe(true);
    expect(matchesGlossaryQuery(init, 'thư mục')).toBe(true);
    expect(matchesGlossaryQuery(init, 'commit')).toBe(false);
  });

  it('needs every word of the query', () => {
    expect(matchesGlossaryQuery(init, 'khởi commit')).toBe(false);
  });
});
