'use client';
import { useTransition } from 'react';
import { deleteObligation } from './actions';

export default function DeleteObligationButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      title="Eliminar"
      className="text-slate-300 hover:text-red-600 text-xs px-1"
      onClick={() => startTransition(() => deleteObligation(id))}
    >
      ✕
    </button>
  );
}
