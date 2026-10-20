import type { Ticket } from '../types/ticket';

/** テスト用のチケットを作る（必要な項目だけ上書きする） */
export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    title: 'テストチケット',
    description: '',
    status: 'todo',
    priority: 'medium',
    category: '開発',
    assignee: '自分',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    startDate: null,
    dueDate: null,
    completedAt: null,
    memo: '',
    deletedAt: null,
    projectId: null,
    ...overrides,
  };
}

/** localStorage の代わりに使うメモリ上のストレージ */
export class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private data = new Map<string, string>();
  failOnSet = false;

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnSet) throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(key, value);
  }

  keys(): string[] {
    return [...this.data.keys()];
  }
}
