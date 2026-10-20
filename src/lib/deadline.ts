import { DUE_SOON_DAYS } from '../constants/ticket';
import type { Ticket } from '../types/ticket';
import { diffInDays } from './date';

/**
 * 期限の状態
 * - done: 完了済み（期限判定の対象外）
 * - overdue: 期限超過
 * - today: 本日期限
 * - soon: 期限間近（明日〜DUE_SOON_DAYS日後）
 * - normal: それ以降
 * - none: 期限未設定
 */
export type DeadlineState = 'done' | 'overdue' | 'today' | 'soon' | 'normal' | 'none';

/** 完了判定はこの関数に統一する */
export function isCompleted(ticket: Pick<Ticket, 'status'>): boolean {
  return ticket.status === 'done';
}

export function getDeadlineState(ticket: Pick<Ticket, 'status' | 'dueDate'>, today: string): DeadlineState {
  if (isCompleted(ticket)) return 'done';
  if (!ticket.dueDate) return 'none';
  const days = diffInDays(today, ticket.dueDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= DUE_SOON_DAYS) return 'soon';
  return 'normal';
}

/** 期限までの残り日数（期限なしは null、超過は負数） */
export function daysUntilDue(ticket: Pick<Ticket, 'dueDate'>, today: string): number | null {
  return ticket.dueDate ? diffInDays(today, ticket.dueDate) : null;
}
