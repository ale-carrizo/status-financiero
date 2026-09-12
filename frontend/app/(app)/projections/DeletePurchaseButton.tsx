'use client';
import { useTransition } from 'react';
import { deletePlannedPurchase } from './actions';

export default function DeletePurchaseButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      className="text-xs text-red-600 underline"
      onClick={() => startTransition(() => deletePlannedPurchase(id))}
    >
      Eliminar
    </button>
  );
}
