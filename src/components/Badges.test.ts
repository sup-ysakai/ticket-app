import { describe, expect, it } from 'vitest';
import { describeDeadline } from './Badges';

describe('describeDeadline（詳細画面の期限の説明）', () => {
  const TODAY = '2026-10-20';
  const open = (dueDate: string | null) => ({ status: 'todo' as const, dueDate });

  it('期限の状態ごとに説明を返す（判定は日付単位）', () => {
    expect(describeDeadline(open('2026-10-17'), TODAY)).toBe('期限を3日過ぎています。');
    expect(describeDeadline(open('2026-10-20'), TODAY)).toBe('今日が期限です。');
    expect(describeDeadline(open('2026-10-27'), TODAY)).toBe('期限まであと7日です。');
    expect(describeDeadline(open('2026-10-28'), TODAY)).toBe('期限まであと8日です。');
    expect(describeDeadline(open(null), TODAY)).toBe('期限は設定されていません。');
  });

  it('完了済みは期限を過ぎていても警告しない', () => {
    expect(describeDeadline({ status: 'done', dueDate: '2026-10-01' }, TODAY)).toBe('完了済みのため、期限の警告は表示しません。');
  });
});
