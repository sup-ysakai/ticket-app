import { describe, expect, it } from 'vitest';
import { createEmptyTicketInput } from '../constants/ticket';
import { INPUT_LIMITS, normalizeTicketInput, validateTicketInput } from './validation';

const valid = () => ({ ...createEmptyTicketInput(), title: '仕様書の作成' });

describe('validateTicketInput', () => {
  it('正しい入力ではエラーなし', () => {
    expect(validateTicketInput(valid())).toEqual({});
  });

  it('タイトル必須（空白のみも不可）', () => {
    expect(validateTicketInput(normalizeTicketInput({ ...valid(), title: '   ' })).title).toBeDefined();
  });

  it('文字数の上限を超えるとエラー', () => {
    const errors = validateTicketInput({ ...valid(), title: 'あ'.repeat(INPUT_LIMITS.title + 1) });
    expect(errors.title).toContain(`${INPUT_LIMITS.title}文字以内`);
  });

  it('担当者必須', () => {
    expect(validateTicketInput(normalizeTicketInput({ ...valid(), assignee: ' ' })).assignee).toBeDefined();
  });

  it('期限日が開始予定日より前ならエラー', () => {
    const errors = validateTicketInput({ ...valid(), startDate: '2026-10-20', dueDate: '2026-10-19' });
    expect(errors.dueDate).toBeDefined();
    expect(validateTicketInput({ ...valid(), startDate: '2026-10-20', dueDate: '2026-10-20' })).toEqual({});
  });

  it('不正な日付・選択肢外の値はエラー', () => {
    const errors = validateTicketInput({
      ...valid(),
      dueDate: '2026-02-30',
      status: 'unknown' as never,
      category: '雑務' as never,
    });
    expect(Object.keys(errors).sort()).toEqual(['category', 'dueDate', 'status']);
  });

  it('正規化で前後の空白を除去し、空の日付を null にする', () => {
    const n = normalizeTicketInput({ ...valid(), title: '  件名  ', dueDate: '' as unknown as null });
    expect(n.title).toBe('件名');
    expect(n.dueDate).toBeNull();
  });
});
