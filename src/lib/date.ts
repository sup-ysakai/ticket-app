// 日付・時刻の扱い方針
// - 開始予定日・期限日は「日付のみ」の値。ローカル日付の 'YYYY-MM-DD' 文字列で保存し、
//   Date オブジェクトに変換しないことでタイムゾーンによる日付ずれを防ぐ。
// - 作成・更新・完了日時は ISO 8601（UTC）で保存し、表示時にローカル時刻へ変換する。

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date をローカル日付の 'YYYY-MM-DD' に変換する */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 今日のローカル日付 */
export function todayString(now: Date = new Date()): string {
  return toLocalDateString(now);
}

/** 'YYYY-MM-DD' を UTC 0時のミリ秒に変換する（存在しない日付は null） */
function toUtcMillis(dateStr: string): number | null {
  const m = DATE_PATTERN.exec(dateStr);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return ms;
}

export function isValidDateString(value: string): boolean {
  return toUtcMillis(value) !== null;
}

export function isValidIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !Number.isNaN(Date.parse(value));
}

/** from から to までの日数（to が後なら正） */
export function diffInDays(from: string, to: string): number {
  const a = toUtcMillis(from);
  const b = toUtcMillis(to);
  if (a === null || b === null) {
    throw new Error(`日付の形式が不正です（from=${from}, to=${to}）`);
  }
  return Math.round((b - a) / MS_PER_DAY);
}

export function addDays(dateStr: string, days: number): string {
  const ms = toUtcMillis(dateStr);
  if (ms === null) throw new Error(`日付の形式が不正です（${dateStr}）`);
  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' を 'YYYY/MM/DD(曜)' で表示する */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const ms = toUtcMillis(dateStr);
  if (ms === null) return dateStr;
  const weekday = WEEKDAYS[new Date(ms).getUTCDay()];
  return `${dateStr.replace(/-/g, '/')}(${weekday})`;
}

/** 'YYYY-MM-DD' を短く表示する（today と同じ年なら年を省略して 'MM/DD(曜)'） */
export function formatShortDate(dateStr: string | null, today: string): string {
  if (!dateStr) return '—';
  const full = formatDate(dateStr);
  return dateStr.slice(0, 4) === today.slice(0, 4) ? full.slice(5) : full;
}

/** ISO 日時をローカル時刻の 'YYYY/MM/DD HH:mm' で表示する */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${toLocalDateString(d).replace(/-/g, '/')} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
