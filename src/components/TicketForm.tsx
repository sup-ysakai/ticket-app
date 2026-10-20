import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { PRIORITY_LABELS, STATUS_LABELS } from '../constants/ticket';
import { getErrorMessage } from '../lib/errors';
import {
  INPUT_LIMITS,
  hasErrors,
  normalizeTicketInput,
  validateTicketInput,
  type TicketFormErrors,
} from '../lib/validation';
import { useToast } from '../state/ToastContext';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketInput,
  type TicketPriority,
  type TicketStatus,
} from '../types/ticket';
import { Link } from 'react-router-dom';
import { projectColorStyle } from '../constants/projectColors';
import { useTickets } from '../state/TicketContext';
import { MemoTextarea } from './MemoTextarea';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

interface TicketFormProps {
  initialValue: TicketInput;
  submitLabel: string;
  /** 保存処理。失敗時は例外を投げる */
  onSubmit: (input: TicketInput) => void;
  onCancel: () => void;
  /** true のとき、変更がなければ保存ボタンを押せないようにする（編集画面用） */
  requireChanges?: boolean;
}

/** 正規化した入力値どうしが同じか（未保存の変更があるかの判定に使う） */
function sameInput(a: TicketInput, b: TicketInput): boolean {
  const x = normalizeTicketInput(a);
  const y = normalizeTicketInput(b);
  return (Object.keys(x) as (keyof TicketInput)[]).every((key) => x[key] === y[key]);
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ id, label, required, error, hint, children }: FieldProps) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="required">必須</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** チケットの新規登録・編集で共用するフォーム */
export function TicketForm({ initialValue, submitLabel, onSubmit, onCancel, requireChanges = false }: TicketFormProps) {
  const [values, setValues] = useState<TicketInput>(initialValue);
  const [errors, setErrors] = useState<TicketFormErrors>({});
  // 一度送信を試みた後は、入力のたびに再検証してエラー表示を更新する
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { projects, getProject } = useTickets();
  const dirty = !sameInput(values, initialValue);
  // 未保存の変更がある間は、画面移動・タブを閉じる前に確認する
  const guard = useUnsavedChangesGuard(dirty);
  const uid = useId();
  const fid = (name: keyof TicketInput) => `${uid}-${name}`;

  const set = <K extends keyof TicketInput>(key: K, value: TicketInput[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validateTicketInput(normalizeTicketInput(next)));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Ctrl+Enter では無効なボタンでも送信されるため、ここでも変更の有無を確認する
    if (requireChanges && !dirty) {
      showToast('変更がないため、保存していません。', 'info');
      return;
    }
    setSubmitted(true);
    const normalized = normalizeTicketInput(values);
    const found = validateTicketInput(normalized);
    setErrors(found);
    if (hasErrors(found)) {
      showToast('入力内容に誤りがあります。赤字の項目を確認してください。', 'error');
      const first = Object.keys(found)[0] as keyof TicketInput;
      document.getElementById(fid(first))?.focus();
      return;
    }
    setSaveError(null);
    // 保存に成功した後の画面移動では確認を出さない
    guard.allowNavigation();
    try {
      onSubmit(normalized);
    } catch (err) {
      guard.resetAllowNavigation();
      const message = getErrorMessage(err);
      setSaveError(`保存できませんでした。${message} 入力内容はそのまま残っています。`);
      showToast(message, 'error');
    }
  };

  // Ctrl+Enter（Macは⌘+Enter）で保存
  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  };

  const errorProps = (name: keyof TicketInput) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${fid(name)}-error` } : {};

  return (
    <form className="ticket-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <div className="form-grid">
        <div className="form-main card">
          <Field id={fid('title')} label="タイトル" required error={errors.title}>
            <input
              id={fid('title')}
              type="text"
              value={values.title}
              maxLength={INPUT_LIMITS.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="例：ログイン画面のエラーメッセージ修正"
              autoFocus
              {...errorProps('title')}
            />
          </Field>
          <Field id={fid('description')} label="詳細説明" error={errors.description}>
            <textarea
              id={fid('description')}
              rows={6}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="背景・目的・完了条件など"
              {...errorProps('description')}
            />
          </Field>
          <Field id={fid('memo')} label="作業メモ" error={errors.memo}>
            <MemoTextarea
              id={fid('memo')}
              value={values.memo}
              onChange={(v) => set('memo', v)}
              invalid={Boolean(errors.memo)}
              describedBy={errors.memo ? `${fid('memo')}-error` : undefined}
            />
          </Field>
        </div>

        <div className="form-side card">
          <Field id={fid('projectId')} label="案件" error={errors.projectId}>
            <div className="project-select">
              <span
                className="project-select-swatch"
                style={projectColorStyle(getProject(values.projectId)?.color)}
                aria-hidden="true"
              />
              <select
                id={fid('projectId')}
                value={values.projectId === null ? '' : String(values.projectId)}
                onChange={(e) => set('projectId', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">（案件なし）</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="field-hint">
              {projects.length === 0 ? '案件はまだ登録されていません。' : '案件の色がチケットの背景色になります。'}
              <Link to="/projects">案件マスターを開く</Link>
            </p>
          </Field>
          <Field id={fid('status')} label="ステータス" error={errors.status}>
            <select
              id={fid('status')}
              value={values.status}
              onChange={(e) => set('status', e.target.value as TicketStatus)}
            >
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('priority')} label="優先度" error={errors.priority}>
            <select
              id={fid('priority')}
              value={values.priority}
              onChange={(e) => set('priority', e.target.value as TicketPriority)}
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('category')} label="カテゴリ" error={errors.category}>
            <select
              id={fid('category')}
              value={values.category}
              onChange={(e) => set('category', e.target.value as TicketCategory)}
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('assignee')} label="担当者" required error={errors.assignee}>
            <input
              id={fid('assignee')}
              type="text"
              value={values.assignee}
              onChange={(e) => set('assignee', e.target.value)}
              {...errorProps('assignee')}
            />
          </Field>
          <Field id={fid('startDate')} label="開始予定日" error={errors.startDate}>
            <input
              id={fid('startDate')}
              type="date"
              value={values.startDate ?? ''}
              onChange={(e) => set('startDate', e.target.value || null)}
              {...errorProps('startDate')}
            />
          </Field>
          <Field id={fid('dueDate')} label="期限日" error={errors.dueDate}>
            <input
              id={fid('dueDate')}
              type="date"
              value={values.dueDate ?? ''}
              onChange={(e) => set('dueDate', e.target.value || null)}
              {...errorProps('dueDate')}
            />
          </Field>
        </div>
      </div>

      {saveError && (
        <div className="alert alert-error" role="alert">
          {saveError}
        </div>
      )}

      {/* 保存・キャンセルは画面下部に固定し、長いフォームでも常に押せるようにする */}
      <div className="form-actions form-actions-sticky">
        <span className={`form-status ${dirty ? 'is-dirty' : ''}`} aria-live="polite">
          {dirty ? '● 未保存の変更があります' : '変更はありません'}
        </span>
        <span className="form-shortcut-hint">Ctrl + Enter で保存</span>
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="btn btn-primary" disabled={requireChanges && !dirty}>
          {submitLabel}
        </button>
      </div>
      {guard.prompt}
    </form>
  );
}
