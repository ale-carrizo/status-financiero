'use client';
import { useTransition } from 'react';
import type { Category } from '@/lib/types';
import { reclassifyTransaction } from './actions';

const OPTIONS: Category[] = ['EMPRESA', 'PERSONAL', 'IMPUESTO', 'EXCLUIDO', 'SIN_CLASIFICAR'];

export default function CategorySelect({
  transactionId,
  statementId,
  category,
}: {
  transactionId: string;
  statementId: string;
  category: Category;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      className={`badge badge-${category.toLowerCase().replace('_', '-')} border-0 cursor-pointer`}
      defaultValue={category}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value as Category;
        startTransition(() => {
          reclassifyTransaction(transactionId, value, statementId);
        });
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o.replace('_', ' ')}
        </option>
      ))}
    </select>
  );
}
