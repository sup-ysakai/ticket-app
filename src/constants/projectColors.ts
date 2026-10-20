import { PROJECT_COLOR_KEYS, type ProjectColor } from '../types/ticket';

/**
 * 案件に設定できるパステルカラー。
 * - bg：チケット（カード・一覧の行）の背景色。文字色は通常の濃い色のまま読めるよう、十分に淡くしている
 * - border：カードの枠線・色見本の枠
 * - text：案件名ラベルの文字色（ラベル背景の bg に対して十分なコントラストを確保）
 * - dot：案件名ラベルの丸印
 * 保存データには色の名前（key）だけを保存するため、ここの色を調整しても既存データに影響しない。
 */
export interface ProjectColorDef {
  key: ProjectColor;
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}

const DEFS: Record<ProjectColor, Omit<ProjectColorDef, 'key'>> = {
  sakura: { label: 'さくら', bg: '#fdeef5', border: '#f5c2d9', text: '#9d174d', dot: '#ec6fa6' },
  coral: { label: 'コーラル', bg: '#ffefed', border: '#fbc8c1', text: '#9f2a1d', dot: '#f2826f' },
  peach: { label: 'ピーチ', bg: '#fff2e6', border: '#fbd2ab', text: '#9a3d07', dot: '#f59e5b' },
  sand: { label: 'サンド', bg: '#f8f1e7', border: '#e5d3b8', text: '#7a5320', dot: '#c9a46b' },
  lemon: { label: 'レモン', bg: '#fefbe3', border: '#f3e49a', text: '#7a5d00', dot: '#e3c534' },
  lime: { label: 'ライム', bg: '#f3fbe4', border: '#cfe9a5', text: '#466b0b', dot: '#97c94a' },
  mint: { label: 'ミント', bg: '#eafaf1', border: '#b5e6cb', text: '#11643f', dot: '#4fc58a' },
  aqua: { label: 'アクア', bg: '#e8f9f8', border: '#ade4df', text: '#0f625d', dot: '#3fbdb3' },
  sky: { label: 'スカイ', bg: '#eaf5fd', border: '#b8daf5', text: '#0f5584', dot: '#56a8e6' },
  periwinkle: { label: 'ペリウィンクル', bg: '#eef0fd', border: '#c6ccf7', text: '#3730a3', dot: '#8190ee' },
  lavender: { label: 'ラベンダー', bg: '#f4effd', border: '#d8c9f6', text: '#5b21b6', dot: '#a786ea' },
  gray: { label: 'グレー', bg: '#f3f4f6', border: '#d4d8de', text: '#374151', dot: '#9aa1ac' },
};

export const PROJECT_COLORS: ProjectColorDef[] = PROJECT_COLOR_KEYS.map((key) => ({ key, ...DEFS[key] }));

export function getProjectColor(key: ProjectColor): ProjectColorDef {
  return { key, ...DEFS[key] };
}

/** 新しい案件の初期色（まだ使われていない色を優先する） */
export function suggestProjectColor(usedColors: ProjectColor[]): ProjectColor {
  return PROJECT_COLOR_KEYS.find((key) => !usedColors.includes(key)) ?? PROJECT_COLOR_KEYS[0];
}

/** 要素に案件の色を CSS 変数として渡す（背景・枠線は CSS 側で参照する） */
export function projectColorStyle(key: ProjectColor | undefined): Record<string, string> | undefined {
  if (!key) return undefined;
  const c = DEFS[key];
  return { '--project-bg': c.bg, '--project-border': c.border, '--project-text': c.text, '--project-dot': c.dot };
}
