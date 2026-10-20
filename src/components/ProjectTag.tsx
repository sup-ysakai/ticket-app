import { projectColorStyle } from '../constants/projectColors';
import { useTickets } from '../state/TicketContext';
import type { Project } from '../types/ticket';

interface ProjectTagProps {
  /** 表示する案件（projectId を渡す場合は省略） */
  project?: Project;
  /** 案件ID（案件マスターから名前と色を引く） */
  projectId?: number | null;
  /** 案件なしのときに「案件なし」と表示するか（既定は何も表示しない） */
  showNone?: boolean;
}

/** 案件名ラベル（案件の色の丸印＋案件名）。全画面でこの部品を使い、表示をそろえる */
export function ProjectTag({ project, projectId = null, showNone = false }: ProjectTagProps) {
  const { getProject } = useTickets();
  const target = project ?? getProject(projectId);
  if (!target) return showNone ? <span className="project-tag project-tag-none">案件なし</span> : null;
  return (
    <span className="project-tag" style={projectColorStyle(target.color)} title={`案件：${target.name}`}>
      <span className="project-tag-dot" aria-hidden="true" />
      <span className="visually-hidden">案件：</span>
      {target.name}
    </span>
  );
}
