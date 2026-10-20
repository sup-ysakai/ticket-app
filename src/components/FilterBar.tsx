import { PRIORITY_LABELS, STATUS_LABELS } from '../constants/ticket';
import { useTickets } from '../state/TicketContext';
import {
  DEADLINE_FILTER_LABELS,
  SORT_OPTIONS,
  type DeadlineFilter,
  type SortOption,
  type StatusFilter,
  type TicketQuery,
} from '../lib/ticketQuery';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
} from '../types/ticket';

/** よく使う絞り込みをボタン1回で切り替えるための定義（もう一度押すと解除） */
const QUICK_FILTERS: { label: string; isActive: (q: TicketQuery) => boolean; on: Partial<TicketQuery>; off: Partial<TicketQuery> }[] = [
  { label: '未完了', isActive: (q) => q.status === 'open', on: { status: 'open' }, off: { status: '' } },
  { label: '優先度「高」', isActive: (q) => q.priority === 'high', on: { priority: 'high' }, off: { priority: '' } },
  { label: '期限超過', isActive: (q) => q.deadline === 'overdue', on: { deadline: 'overdue' }, off: { deadline: '' } },
  { label: '本日期限', isActive: (q) => q.deadline === 'today', on: { deadline: 'today' }, off: { deadline: '' } },
];

interface FilterBarProps {
  query: TicketQuery;
  onChange: (patch: Partial<TicketQuery>) => void;
}

/** 検索・絞り込み・並び替えの条件入力欄（条件のリセットは一覧の結果欄に配置） */
export function FilterBar({ query, onChange }: FilterBarProps) {
  const { projects } = useTickets();
  return (
    <section className="filter-bar card" aria-label="検索・絞り込み">
      <div className="quick-filters" role="group" aria-label="クイック絞り込み">
        <span className="filter-label">クイック絞り込み</span>
        {QUICK_FILTERS.map((f) => {
          const active = f.isActive(query);
          return (
            <button
              key={f.label}
              type="button"
              className={`quick-filter ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(active ? f.off : f.on)}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="filter-row">
        <label className="filter-item filter-keyword">
          <span className="filter-label">キーワード</span>
          <input
            type="search"
            value={query.keyword}
            placeholder="タイトル・詳細説明・IDで検索（スペース区切りでAND検索）"
            onChange={(e) => onChange({ keyword: e.target.value })}
          />
        </label>
        <label className="filter-item">
          <span className="filter-label">並び替え</span>
          <select value={query.sort} onChange={(e) => onChange({ sort: e.target.value as SortOption })}>
            {(Object.keys(SORT_OPTIONS) as SortOption[]).map((key) => (
              <option key={key} value={key}>
                {SORT_OPTIONS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-row">
        <label className="filter-item">
          <span className="filter-label">ステータス</span>
          <select value={query.status} onChange={(e) => onChange({ status: e.target.value as StatusFilter })}>
            <option value="">すべて</option>
            <option value="open">未完了（完了以外）</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-item">
          <span className="filter-label">優先度</span>
          <select
            value={query.priority}
            onChange={(e) => onChange({ priority: e.target.value as TicketPriority | '' })}
          >
            <option value="">すべて</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-item">
          <span className="filter-label">カテゴリ</span>
          <select
            value={query.category}
            onChange={(e) => onChange({ category: e.target.value as TicketCategory | '' })}
          >
            <option value="">すべて</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-item">
          <span className="filter-label">案件</span>
          <select value={query.project} onChange={(e) => onChange({ project: e.target.value })}>
            <option value="">すべて</option>
            <option value="none">案件なし</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-item">
          <span className="filter-label">期限</span>
          <select
            value={query.deadline}
            onChange={(e) => onChange({ deadline: e.target.value as DeadlineFilter })}
          >
            <option value="">すべて</option>
            {(Object.keys(DEADLINE_FILTER_LABELS) as Exclude<DeadlineFilter, ''>[]).map((key) => (
              <option key={key} value={key}>
                {DEADLINE_FILTER_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-item filter-range">
          <span className="filter-label">期限日の範囲</span>
          <div className="range-inputs">
            <input
              type="date"
              aria-label="期限日（開始）"
              value={query.dueFrom}
              onChange={(e) => onChange({ dueFrom: e.target.value })}
            />
            <span>〜</span>
            <input
              type="date"
              aria-label="期限日（終了）"
              value={query.dueTo}
              onChange={(e) => onChange({ dueTo: e.target.value })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
