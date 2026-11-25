import { describe, expect, it } from 'vitest';
import { CONTENT_REPORT_CATEGORIES } from '@hub/shared';
import {
  CATEGORY_ICON,
  insertCodeBlock,
  insertTemplate,
  isSubmitShortcut,
  missingField,
  nextStatuses,
  openReportsHref,
  quoteFromSelection,
  reportFiltersFromParams,
  reportFiltersSearch,
  sendErrorText,
  targetKindLabel,
} from './content-report-format';

describe('quoteFromSelection', () => {
  it('keeps the selected text, without blank lines and extra spaces', () => {
    expect(quoteFromSelection('  SELECT *\n\n   FORM users  ')).toBe('SELECT *\nFORM users');
    expect(quoteFromSelection(null)).toBe('');
    expect(quoteFromSelection('   ')).toBe('');
  });

  it('cuts a long selection to 500 characters', () => {
    expect(quoteFromSelection('a'.repeat(900))).toHaveLength(500);
  });
});

describe('sendErrorText', () => {
  it('passes the API message for the daily limit, and explains the other errors', () => {
    expect(sendErrorText({ status: 429, title: 'Bạn đã gửi 10 báo lỗi trong 24 giờ qua.' })).toBe(
      'Bạn đã gửi 10 báo lỗi trong 24 giờ qua.',
    );
    expect(sendErrorText({ status: 429, title: 'Too many requests' })).toContain('Đợi một phút');
    expect(sendErrorText({ status: 401, title: 'x' })).toBe(
      'Phiên đăng nhập đã hết, hãy đăng nhập lại.',
    );
    expect(sendErrorText({ status: 422, title: 'x' })).toContain('mô tả');
    expect(sendErrorText({ status: 404, title: 'x' })).toContain('Tải lại');
    expect(sendErrorText({ status: 0, title: 'Không kết nối được máy chủ.' })).toBe(
      'Không kết nối được máy chủ.',
    );
    expect(sendErrorText({ status: 500, title: 'x' })).toContain('Thử lại');
  });
});

describe('staff filters', () => {
  it('keeps only well-formed filters from the URL', () => {
    expect(reportFiltersFromParams({ track: 'sql-30-days', status: 'open' })).toEqual({
      track: 'sql-30-days',
      status: 'open',
    });
    expect(reportFiltersFromParams({ track: '../x', status: 'closed' })).toEqual({});
    expect(reportFiltersFromParams({ status: ['resolved', 'open'] })).toEqual({
      status: 'resolved',
    });
  });

  it('builds links, and the open reports of one track', () => {
    expect(reportFiltersSearch({})).toBe('');
    expect(reportFiltersSearch({ status: 'dismissed' })).toBe('?status=dismissed');
    expect(openReportsHref('sql')).toBe('/admin/content-reports?track=sql&status=open');
  });
});

describe('nextStatuses', () => {
  it('offers the same moves as the API', () => {
    expect(nextStatuses('open')).toEqual(['in_progress', 'resolved', 'dismissed']);
    expect(nextStatuses('in_progress')).toEqual(['open', 'resolved', 'dismissed']);
    expect(nextStatuses('resolved')).toEqual(['open']);
    expect(nextStatuses('dismissed')).toEqual(['open']);
  });
});

describe('insertCodeBlock', () => {
  it('adds an empty block with the cursor inside', () => {
    expect(insertCodeBlock('', 0, 0)).toEqual({
      value: '```\n\n```',
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it('wraps the selection on lines of its own, and selects the code', () => {
    const edit = insertCodeBlock('Lệnh SELECT 1 sai', 5, 13);
    expect(edit?.value).toBe('Lệnh \n```\nSELECT 1\n```\n sai');
    expect(edit?.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('SELECT 1');
  });

  it('does not add line breaks the text already has', () => {
    expect(insertCodeBlock('a\n\nb', 2, 2)?.value).toBe('a\n```\n\n```\nb');
  });

  it('uses a longer fence when the selection has backticks', () => {
    expect(insertCodeBlock('```x```', 0, 7)?.value).toBe('````\n```x```\n````');
  });

  it('refuses to pass the length limit', () => {
    expect(insertCodeBlock('abc', 3, 3, 8)).toBeNull();
  });
});

describe('insertTemplate', () => {
  it('adds "Sai" and "Nên là" lines with the cursor after "Sai: "', () => {
    const edit = insertTemplate('Ghi chú', 7, 7);
    expect(edit?.value).toBe('Ghi chú\nSai: \nNên là: ');
    expect(edit?.selectionStart).toBe('Ghi chú\nSai: '.length);
    expect(insertTemplate('x', 1, 1, 5)).toBeNull();
  });
});

describe('dialog helpers', () => {
  it('sends with Ctrl+Enter or Cmd+Enter only', () => {
    expect(isSubmitShortcut({ key: 'Enter', ctrlKey: true, metaKey: false })).toBe(true);
    expect(isSubmitShortcut({ key: 'Enter', ctrlKey: false, metaKey: true })).toBe(true);
    expect(isSubmitShortcut({ key: 'Enter', ctrlKey: false, metaKey: false })).toBe(false);
    expect(isSubmitShortcut({ key: 'a', ctrlKey: true, metaKey: false })).toBe(false);
  });

  it('names the first missing field', () => {
    expect(missingField('', 'x')?.field).toBe('category');
    expect(missingField('typo', '  \n')?.field).toBe('description');
    expect(missingField('typo', 'x')).toBeNull();
  });

  it('has an icon for every category, and names the kind of target', () => {
    for (const c of CONTENT_REPORT_CATEGORIES) expect(CATEGORY_ICON[c]).toBeTruthy();
    expect(targetKindLabel('lesson')).toBe('Bài');
    expect(targetKindLabel('exercise')).toBe('Bài');
    expect(targetKindLabel('glossary')).toBe('Trang');
    expect(targetKindLabel('track_page')).toBe('Trang');
  });
});
