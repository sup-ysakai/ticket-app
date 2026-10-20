import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Page } from '../components/Page';
import { ProjectColorPicker } from '../components/ProjectColorPicker';
import { ProjectTag } from '../components/ProjectTag';
import { getProjectColor, projectColorStyle, suggestProjectColor } from '../constants/projectColors';
import { getErrorMessage } from '../lib/errors';
import { INPUT_LIMITS, hasErrors, validateProjectInput, type ProjectFormErrors } from '../lib/validation';
import { queryToSearchParams } from '../lib/ticketQuery';
import { useTickets } from '../state/TicketContext';
import { useToast } from '../state/ToastContext';
import type { Project, ProjectInput } from '../types/ticket';

interface ProjectEditorProps {
  initial: ProjectInput;
  /** 編集中の案件ID（新規登録は null） */
  selfId: number | null;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => void;
  onCancel?: () => void;
}

/** 案件名と色の入力欄（新規登録・編集で共用）。入力中の見た目をプレビューで確認できる */
function ProjectEditor({ initial, selfId, submitLabel, onSubmit, onCancel }: ProjectEditorProps) {
  const { projects } = useTickets();
  const { showToast } = useToast();
  const [values, setValues] = useState<ProjectInput>(initial);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const nameId = `project-name-${selfId ?? 'new'}`;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateProjectInput(values, projects, selfId);
    setErrors(found);
    if (hasErrors(found)) {
      document.getElementById(nameId)?.focus();
      return;
    }
    try {
      onSubmit({ name: values.name.trim(), color: values.color });
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const previewName = values.name.trim() || '案件名';
  const color = getProjectColor(values.color);

  return (
    <form className="project-editor" onSubmit={handleSubmit} noValidate>
      <div className={`field ${errors.name ? 'has-error' : ''}`}>
        <label htmlFor={nameId} className="field-label">
          案件名<span className="required">必須</span>
        </label>
        <input
          id={nameId}
          type="text"
          value={values.name}
          maxLength={INPUT_LIMITS.projectName}
          placeholder="例：A社 基幹システム改修"
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${nameId}-error` : undefined}
        />
        {errors.name && (
          <p className="field-error" id={`${nameId}-error`}>
            {errors.name}
          </p>
        )}
      </div>
      <div className="field">
        <span className="field-label">色（チケットの背景色になります）</span>
        <ProjectColorPicker
          value={values.color}
          onChange={(c) => setValues({ ...values, color: c })}
          label={selfId === null ? '新しい案件の色' : `「${initial.name}」の色`}
        />
      </div>
      <div className="project-preview" aria-label="表示の確認">
        <span className="field-label">表示の確認</span>
        <div className="project-preview-card" style={projectColorStyle(values.color)}>
          <ProjectTag project={{ id: 0, name: previewName, color: values.color, createdAt: '', updatedAt: '' }} />
          <span className="project-preview-title">チケットのタイトル（{color.label}）</span>
        </div>
      </div>
      <div className="section-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function ProjectsPage() {
  const { projects, projectTicketCounts, createProject, updateProject, deleteProject } = useTickets();
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  // 追加後に入力欄を空に戻すため、key を変えて作り直す
  const [newFormKey, setNewFormKey] = useState(0);

  const handleCreate = (input: ProjectInput) => {
    const project = createProject(input);
    showToast(`案件「${project.name}」を追加しました。`);
    setNewFormKey((k) => k + 1);
  };

  const handleUpdate = (id: number, input: ProjectInput) => {
    const project = updateProject(id, input);
    showToast(`案件「${project.name}」を更新しました。`);
    setEditingId(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    try {
      const affected = deleteProject(deleting.id);
      showToast(
        affected > 0
          ? `案件「${deleting.name}」を削除しました（${affected}件のチケットを「案件なし」にしました）。`
          : `案件「${deleting.name}」を削除しました。`,
      );
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const usedColors = projects.map((p) => p.color);
  const deletingCount = deleting ? (projectTicketCounts.get(deleting.id) ?? 0) : 0;

  return (
    <Page
      width="narrow"
      title="案件マスター"
      documentTitle="案件マスター"
      description="案件（顧客・プロジェクト）を登録すると、チケットに設定して色分け・絞り込みができます。"
    >
      <section className="card section-card" aria-labelledby="project-new">
        <h2 id="project-new" className="section-title">
          案件を追加
        </h2>
        <ProjectEditor
          key={newFormKey}
          initial={{ name: '', color: suggestProjectColor(usedColors) }}
          selfId={null}
          submitLabel="追加する"
          onSubmit={handleCreate}
        />
      </section>

      <section className="card section-card" aria-labelledby="project-list">
        <h2 id="project-list" className="section-title">
          登録済みの案件（{projects.length}件）
        </h2>
        {projects.length === 0 ? (
          <EmptyState title="案件はまだありません" message="上の「案件を追加」から登録してください。" />
        ) : (
          <ul className="project-list">
            {projects.map((p) => {
              const count = projectTicketCounts.get(p.id) ?? 0;
              return (
                <li key={p.id} className="project-row" style={projectColorStyle(p.color)}>
                  {editingId === p.id ? (
                    <div className="project-row-editor">
                      <ProjectEditor
                        initial={{ name: p.name, color: p.color }}
                        selfId={p.id}
                        submitLabel="変更を保存"
                        onSubmit={(input) => handleUpdate(p.id, input)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="project-row-main">
                        <ProjectTag project={p} />
                        <span className="project-row-color">{getProjectColor(p.color).label}</span>
                      </div>
                      <Link
                        className="project-row-count"
                        to={`/tickets?${queryToSearchParams({ project: String(p.id) }).toString()}`}
                      >
                        チケット {count}件
                      </Link>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => setEditingId(p.id)}
                          aria-label={`案件「${p.name}」を編集`}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger-outline"
                          onClick={() => setDeleting(p)}
                          aria-label={`案件「${p.name}」を削除`}
                        >
                          削除
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title="案件を削除しますか？"
        confirmLabel="削除する"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        <p>
          案件「{deleting?.name}」を案件マスターから削除します。
          <br />
          {deletingCount > 0
            ? `この案件を設定しているチケット（${deletingCount}件）は「案件なし」になります（ゴミ箱内のチケットも同様です）。チケット自体は削除されません。`
            : 'この案件を設定しているチケットはありません。'}
        </p>
      </ConfirmDialog>
    </Page>
  );
}
