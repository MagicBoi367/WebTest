import { ListFilter } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GradeLevel } from '../types/exam';
import { formatGradeLabel, normalizeGradeValue } from '../utils/scoring2025';

interface GradeInputControlProps {
  value: GradeLevel;
  onChange: (nextGrade: GradeLevel) => void;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
  placeholder?: string;
}

const STANDARD_GRADES = [12, 11, 10] as const;

export function GradeInputControl({
  value,
  onChange,
  ariaLabel = 'Chọn hoặc nhập khối / số lớp',
  compact = false,
  className = '',
  placeholder = 'VD: 9, 8, 12A2, 10C1...',
}: GradeInputControlProps) {
  const isStandard = STANDARD_GRADES.some(
    (g) => String(g) === String(value).trim(),
  );

  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState(() =>
    isStandard ? '' : String(value ?? ''),
  );

  useEffect(() => {
    const matchesStd = STANDARD_GRADES.some(
      (g) => String(g) === String(value).trim(),
    );
    if (!matchesStd && value !== undefined && value !== null && String(value).trim() !== '') {
      setCustomText(String(value));
    }
  }, [value]);

  const heightCls = compact ? 'h-9 text-xs' : 'h-10 text-xs';

  if (customMode) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <input
          type="text"
          autoFocus
          aria-label={ariaLabel}
          value={customText}
          onChange={(e) => {
            const raw = e.target.value;
            setCustomText(raw);
            if (raw.trim()) {
              onChange(normalizeGradeValue(raw));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (customText.trim()) {
                onChange(normalizeGradeValue(customText));
                setCustomMode(false);
              }
            } else if (e.key === 'Escape') {
              setCustomMode(false);
            }
          }}
          placeholder={placeholder}
          className={`${heightCls} min-w-0 flex-1 rounded-lg border border-blue-500 bg-white px-2.5 font-medium text-slate-900 focus:outline-none dark:border-blue-500 dark:bg-slate-950 dark:text-slate-100`}
        />
        <button
          type="button"
          title="Quay lại danh sách khối"
          onClick={() => {
            if (!customText.trim() && !isStandard) {
              onChange(12);
            }
            setCustomMode(false);
          }}
          className={`${heightCls} inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}
        >
          <ListFilter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Chọn</span>
        </button>
      </div>
    );
  }

  return (
    <select
      aria-label={ariaLabel}
      value={String(value)}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '__custom__') {
          setCustomText(isStandard ? '' : String(value ?? ''));
          setCustomMode(true);
          return;
        }
        onChange(normalizeGradeValue(val));
      }}
      className={`${heightCls} w-full rounded-lg border border-slate-300 bg-white px-2.5 font-medium text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${className}`}
    >
      <option value="12">Khối 12</option>
      <option value="11">Khối 11</option>
      <option value="10">Khối 10</option>
      {!isStandard && String(value).trim() !== '' && (
        <option value={String(value)}>{formatGradeLabel(value)}</option>
      )}
      <option value="__custom__">+ Khối / số lớp khác...</option>
    </select>
  );
}
