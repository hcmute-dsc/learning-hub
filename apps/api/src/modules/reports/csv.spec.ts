import { csvCell, toCsv, UTF8_BOM } from './csv';

describe('csvCell', () => {
  it('leaves plain text and numbers alone, empties null', () => {
    expect(csvCell('sql-30-days')).toBe('sql-30-days');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(2.5)).toBe('2.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
  });

  it.each([
    ['=HYPERLINK("http://x","y")', `"'=HYPERLINK(""http://x"",""y"")"`],
    ['+1+2', "'+1+2"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['＝1+1', "'＝1+1"],
    ['＋1', "'＋1"],
    ['－1', "'－1"],
    ['＠SUM(A1)', "'＠SUM(A1)"],
    ['\tcmd', "'\tcmd"],
    ['\rcmd', `"'\rcmd"`],
  ])('turns the formula %j into text', (input, output) => {
    expect(csvCell(input)).toBe(output);
  });

  it('only checks the first character', () => {
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('2026-11-23')).toBe('2026-11-23');
  });

  it('keeps Vietnamese letters as they are', () => {
    expect(csvCell('Người học 001')).toBe('Người học 001');
  });
});

describe('toCsv', () => {
  const csv = toCsv(['Track', 'Đợt', 'Số'], [['SQL 30 ngày', 'Đợt thử, 11/2026', 3]]);

  it('starts with a UTF-8 byte order mark so Excel reads Vietnamese', () => {
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect([...Buffer.from(csv, 'utf8').subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('writes a header, rows and CRLF line ends', () => {
    expect(csv).toBe(`${UTF8_BOM}Track,Đợt,Số\r\nSQL 30 ngày,"Đợt thử, 11/2026",3\r\n`);
  });

  it('round-trips Vietnamese text through UTF-8 bytes', () => {
    expect(Buffer.from(csv, 'utf8').toString('utf8')).toContain('Đợt thử');
  });
});
