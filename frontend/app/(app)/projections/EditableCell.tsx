'use client';
import { useState, useTransition } from 'react';
import { formatArs } from '@/lib/format';
import { setObligationEntry } from './actions';

export default function EditableCell({
  obligationId,
  periodLabel,
  value,
}: {
  obligationId: string;
  periodLabel: string;
  value: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || ''));
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        className="w-full text-right hover:bg-slate-50 rounded px-1 py-0.5"
        onClick={() => {
          setDraft(String(value || ''));
          setEditing(true);
        }}
      >
        {value ? `$${formatArs(value)}` : <span className="text-slate-300">—</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      step="0.01"
      className="w-28 text-right border border-brand-500 rounded px-1 py-0.5 text-sm"
      value={draft}
      disabled={isPending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const num = parseFloat(draft) || 0;
        if (num === value) return;
        startTransition(() => {
          setObligationEntry(obligationId, periodLabel, num);
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}
