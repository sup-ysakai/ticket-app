import { describe, expect, it } from 'vitest';
import { addDays, diffInDays, formatDate, formatShortDate, isValidDateString, toLocalDateString } from './date';

describe('date', () => {
  it('ローカル日付を YYYY-MM-DD に変換する', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('存在しない日付や形式違いを不正と判定する', () => {
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2028-02-29')).toBe(true);
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2026/02/01')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });

  it('日数差を月・年をまたいで計算する', () => {
    expect(diffInDays('2026-10-18', '2026-10-18')).toBe(0);
    expect(diffInDays('2026-10-18', '2026-10-25')).toBe(7);
    expect(diffInDays('2026-12-31', '2027-01-01')).toBe(1);
    expect(diffInDays('2026-10-18', '2026-10-17')).toBe(-1);
  });

  it('日付を加算する', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('曜日付きで表示する', () => {
    expect(formatDate('2026-10-18')).toBe('2026/10/18(日)');
    expect(formatDate(null)).toBe('—');
  });

  it('今年の日付は年を省略して短く表示する', () => {
    expect(formatShortDate('2026-10-24', '2026-10-21')).toBe('10/24(土)');
    expect(formatShortDate('2027-01-05', '2026-10-21')).toBe('2027/01/05(火)');
    expect(formatShortDate(null, '2026-10-21')).toBe('—');
  });
});
