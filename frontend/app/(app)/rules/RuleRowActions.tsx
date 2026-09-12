'use client';
import { useTransition } from 'react';
import { toggleRule, deleteRuleAction } from './actions';

export default function RuleRowActions({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 justify-end">
      <button
        disabled={isPending}
        className="text-xs text-slate-500 underline"
        onClick={() => startTransition(() => toggleRule(id, !active))}
      >
        {active ? 'Desactivar' : 'Activar'}
      </button>
      <button
        disabled={isPending}
        className="text-xs text-red-600 underline"
        onClick={() => {
          if (confirm('¿Eliminar esta regla?')) startTransition(() => deleteRuleAction(id));
        }}
      >
        Eliminar
      </button>
    </div>
  );
}
