import { describe, expect, it } from 'vitest';
import {
  nextStatuses,
  openReportsHref,
  quoteFromSelection,
  reportFiltersFromParams,
  reportFiltersSearch,
  sendErrorText,
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
