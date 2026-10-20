import { useId } from 'react';
import { PROJECT_COLORS } from '../constants/projectColors';
import type { ProjectColor } from '../types/ticket';

interface ProjectColorPickerProps {
  value: ProjectColor;
  onChange: (color: ProjectColor) => void;
  /** 読み上げ用のラベル */
  label?: string;
}

/**
 * パステルカラーの色見本から1色を選ぶ部品。
 * 中身はラジオボタンなので、矢印キーでも選択できる。色名も表示し、色だけに頼らない。
 */
export function ProjectColorPicker({ value, onChange, label = '色' }: ProjectColorPickerProps) {
  const name = useId();
  return (
    <div className="color-picker" role="radiogroup" aria-label={label}>
      {PROJECT_COLORS.map((c) => (
        <label key={c.key} className={`color-option ${value === c.key ? 'is-selected' : ''}`} title={c.label}>
          <input
            type="radio"
            className="visually-hidden"
            name={name}
            value={c.key}
            checked={value === c.key}
            onChange={() => onChange(c.key)}
          />
          <span className="color-swatch" style={{ background: c.bg, borderColor: c.border }} aria-hidden="true">
            <span className="color-swatch-dot" style={{ background: c.dot }} />
          </span>
          <span className="color-name">{c.label}</span>
        </label>
      ))}
    </div>
  );
}
