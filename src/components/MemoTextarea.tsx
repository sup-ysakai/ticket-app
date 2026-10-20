import { useRef } from 'react';
import { formatDateTime } from '../lib/date';

interface MemoTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  invalid?: boolean;
  describedBy?: string;
}

/** 作業メモ入力欄。カーソル位置に現在日時を挿入でき、作業ログを残しやすくする */
export function MemoTextarea({ id, value, onChange, rows = 8, invalid, describedBy }: MemoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertTimestamp = () => {
    const el = ref.current;
    const stamp = `[${formatDateTime(new Date().toISOString())}] `;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    // 行の途中なら改行してから挿入する
    const prefix = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
    const next = value.slice(0, start) + prefix + stamp + value.slice(end);
    onChange(next);
    const caret = start + prefix.length + stamp.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="memo-textarea">
      <div className="memo-toolbar">
        <button type="button" className="btn btn-small" onClick={insertTimestamp}>
          日時を挿入
        </button>
      </div>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder="調査結果・対応内容・次に実施する作業などを記録します"
      />
    </div>
  );
}
