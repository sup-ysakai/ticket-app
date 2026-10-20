import type { TicketInput, TicketPriority, TicketStatus } from '../types/ticket';

export const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  on_hold: '保留',
  done: '完了',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/** 並び替え用の優先度順位（小さいほど優先度が高い） */
export const PRIORITY_RANK: Record<TicketPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const DEFAULT_ASSIGNEE = '自分';

/** 「期限が近い」とみなす日数（明日〜N日後） */
export const DUE_SOON_DAYS = 7;

export function formatTicketId(id: number): string {
  return `T-${String(id).padStart(4, '0')}`;
}

export function createEmptyTicketInput(): TicketInput {
  return {
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    category: '開発',
    assignee: DEFAULT_ASSIGNEE,
    startDate: null,
    dueDate: null,
    memo: '',
    projectId: null,
  };
}
