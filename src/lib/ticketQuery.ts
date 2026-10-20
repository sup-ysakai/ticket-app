import { PRIORITY_LABELS, PRIORITY_RANK, STATUS_LABELS, formatTicketId } from '../constants/ticket';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type Project,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '../types/ticket';
import { formatDate, isValidDateString } from './date';
import { getDeadlineState, isCompleted } from './deadline';

/** 案件の絞り込み：'' はすべて、'none' は案件なし、数字の文字列は案件ID */
export type ProjectFilter = string;

/** 'open' は「完了以外すべて」 */
export type StatusFilter = '' | 'open' | TicketStatus;
export type DeadlineFilter = '' | 'overdue' | 'today' | 'soon' | 'none';

export const SORT_OPTIONS = {
  due_asc: '期限日が近い順',
  due_desc: '期限日が遠い順',
  priority_desc: '優先度が高い順',
  priority_asc: '優先度が低い順',
  created_desc: '作成日時が新しい順',
  created_asc: '作成日時が古い順',
  updated_desc: '更新日時が新しい順',
} as const;
export type SortOption = keyof typeof SORT_OPTIONS;

export const DEADLINE_FILTER_LABELS: Record<Exclude<DeadlineFilter, ''>, string> = {
  overdue: '期限超過',
  today: '本日期限',
  soon: '7日以内（明日以降）',
  none: '期限なし',
};

export interface TicketQuery {
  keyword: string;
  status: StatusFilter;
  priority: TicketPriority | '';
  category: TicketCategory | '';
  project: ProjectFilter;
  deadline: DeadlineFilter;
  /** 期限日の範囲（YYYY-MM-DD、空文字は指定なし） */
  dueFrom: string;
  dueTo: string;
  sort: SortOption;
}

export const DEFAULT_QUERY: TicketQuery = {
  keyword: '',
  status: '',
  priority: '',
  category: '',
  project: '',
  deadline: '',
  dueFrom: '',
  dueTo: '',
  sort: 'due_asc',
};

/** 全角スペースも区切りとして扱い、すべてのキーワードを含むものを抽出（AND検索） */
function matchesKeyword(ticket: Ticket, keyword: string): boolean {
  const words = keyword.toLowerCase().split(/[\s　]+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${formatTicketId(ticket.id)}\n${ticket.title}\n${ticket.description}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

function matchesStatus(ticket: Ticket, status: StatusFilter): boolean {
  if (status === '') return true;
  if (status === 'open') return !isCompleted(ticket);
  return ticket.status === status;
}

function matchesProject(ticket: Ticket, project: ProjectFilter): boolean {
  if (project === '') return true;
  if (project === 'none') return ticket.projectId === null;
  return ticket.projectId === Number(project);
}

function matchesDeadline(ticket: Ticket, deadline: DeadlineFilter, today: string): boolean {
  if (deadline === '') return true;
  if (deadline === 'none') return ticket.dueDate === null;
  return getDeadlineState(ticket, today) === deadline;
}

function matchesDueRange(ticket: Ticket, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!ticket.dueDate) return false;
  // 'YYYY-MM-DD' は文字列比較で日付順になる
  if (from && ticket.dueDate < from) return false;
  if (to && ticket.dueDate > to) return false;
  return true;
}

export function filterTickets(tickets: Ticket[], query: TicketQuery, today: string): Ticket[] {
  return tickets.filter(
    (t) =>
      matchesKeyword(t, query.keyword) &&
      matchesStatus(t, query.status) &&
      (query.priority === '' || t.priority === query.priority) &&
      (query.category === '' || t.category === query.category) &&
      matchesProject(t, query.project) &&
      matchesDeadline(t, query.deadline, today) &&
      matchesDueRange(t, query.dueFrom, query.dueTo),
  );
}

type Comparator = (a: Ticket, b: Ticket) => number;

/** 期限日の比較。期限なしは昇順・降順どちらでも末尾に置く */
function byDue(direction: 1 | -1): Comparator {
  return (a, b) => {
    if (a.dueDate === b.dueDate) return 0;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -direction : direction;
  };
}

function byPriority(direction: 1 | -1): Comparator {
  return (a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * direction;
}

function byTimestamp(key: 'createdAt' | 'updatedAt', direction: 1 | -1): Comparator {
  return (a, b) => (Date.parse(a[key]) - Date.parse(b[key])) * direction;
}

function chain(...comparators: Comparator[]): Comparator {
  return (a, b) => {
    for (const c of comparators) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    // 最後はIDの降順（新しいもの優先）で順序を安定させる
    return b.id - a.id;
  };
}

const COMPARATORS: Record<SortOption, Comparator> = {
  due_asc: chain(byDue(1), byPriority(1)),
  due_desc: chain(byDue(-1), byPriority(1)),
  priority_desc: chain(byPriority(1), byDue(1)),
  priority_asc: chain(byPriority(-1), byDue(1)),
  created_desc: chain(byTimestamp('createdAt', -1)),
  created_asc: chain(byTimestamp('createdAt', 1)),
  updated_desc: chain(byTimestamp('updatedAt', -1)),
};

export function sortTickets(tickets: Ticket[], sort: SortOption): Ticket[] {
  return [...tickets].sort(COMPARATORS[sort]);
}

export function applyQuery(tickets: Ticket[], query: TicketQuery, today: string): Ticket[] {
  return sortTickets(filterTickets(tickets, query, today), query.sort);
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** URLのクエリ文字列から検索条件を復元する（不正な値は既定値に置き換える） */
export function queryFromSearchParams(params: URLSearchParams): TicketQuery {
  const date = (key: string) => {
    const v = params.get(key) ?? '';
    return isValidDateString(v) ? v : '';
  };
  return {
    keyword: params.get('q') ?? '',
    status: pick<StatusFilter>(params.get('status'), ['', 'open', ...TICKET_STATUSES], ''),
    priority: pick<TicketPriority | ''>(params.get('priority'), ['', ...TICKET_PRIORITIES], ''),
    category: pick<TicketCategory | ''>(params.get('category'), ['', ...TICKET_CATEGORIES], ''),
    project: /^(none|[1-9]\d*)$/.test(params.get('project') ?? '') ? (params.get('project') as string) : '',
    deadline: pick<DeadlineFilter>(params.get('deadline'), ['', 'overdue', 'today', 'soon', 'none'], ''),
    dueFrom: date('dueFrom'),
    dueTo: date('dueTo'),
    sort: pick<SortOption>(params.get('sort'), Object.keys(SORT_OPTIONS) as SortOption[], DEFAULT_QUERY.sort),
  };
}

/** 検索条件をURLのクエリ文字列に変換する（既定値の項目は省略） */
export function queryToSearchParams(query: Partial<TicketQuery>): URLSearchParams {
  const full = { ...DEFAULT_QUERY, ...query };
  const params = new URLSearchParams();
  if (full.keyword) params.set('q', full.keyword);
  if (full.status) params.set('status', full.status);
  if (full.priority) params.set('priority', full.priority);
  if (full.category) params.set('category', full.category);
  if (full.project) params.set('project', full.project);
  if (full.deadline) params.set('deadline', full.deadline);
  if (full.dueFrom) params.set('dueFrom', full.dueFrom);
  if (full.dueTo) params.set('dueTo', full.dueTo);
  if (full.sort !== DEFAULT_QUERY.sort) params.set('sort', full.sort);
  return params;
}

export function isDefaultQuery(query: TicketQuery): boolean {
  return queryToSearchParams(query).toString() === '';
}

/** 適用中の条件1件分（画面に「条件チップ」として表示する） */
export interface ActiveCondition {
  /** 表示用のラベル（例：「ステータス：未完了」） */
  label: string;
  /** この条件を解除したときの変更内容 */
  clear: Partial<TicketQuery>;
}

/** 既定値から変更されている絞り込み条件を一覧にする（並び替えは絞り込みではないため含めない） */
export function describeActiveConditions(query: TicketQuery, projects: Pick<Project, 'id' | 'name'>[] = []): ActiveCondition[] {
  const list: ActiveCondition[] = [];
  if (query.keyword.trim()) list.push({ label: `キーワード：${query.keyword.trim()}`, clear: { keyword: '' } });
  if (query.status) {
    const label = query.status === 'open' ? '未完了（完了以外）' : STATUS_LABELS[query.status];
    list.push({ label: `ステータス：${label}`, clear: { status: '' } });
  }
  if (query.priority) list.push({ label: `優先度：${PRIORITY_LABELS[query.priority]}`, clear: { priority: '' } });
  if (query.category) list.push({ label: `カテゴリ：${query.category}`, clear: { category: '' } });
  if (query.project) {
    const name =
      query.project === 'none'
        ? '案件なし'
        : (projects.find((p) => p.id === Number(query.project))?.name ?? '（削除された案件）');
    list.push({ label: `案件：${name}`, clear: { project: '' } });
  }
  if (query.deadline) list.push({ label: `期限：${DEADLINE_FILTER_LABELS[query.deadline]}`, clear: { deadline: '' } });
  if (query.dueFrom || query.dueTo) {
    const range = `${query.dueFrom ? formatDate(query.dueFrom) : ''}〜${query.dueTo ? formatDate(query.dueTo) : ''}`;
    list.push({ label: `期限日：${range}`, clear: { dueFrom: '', dueTo: '' } });
  }
  return list;
}
