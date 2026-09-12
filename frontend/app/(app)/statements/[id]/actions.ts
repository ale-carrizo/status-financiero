'use server';
import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Category } from '@/lib/types';

export async function reclassifyTransaction(transactionId: string, category: Category, statementId: string) {
  const token = (await getToken())!;
  await api.updateTransaction(token, transactionId, { category });
  revalidatePath(`/statements/${statementId}`);
  revalidatePath('/dashboard');
}

export async function deleteStatement(statementId: string) {
  const token = (await getToken())!;
  await api.deleteStatement(token, statementId);
  revalidatePath('/history');
  revalidatePath('/dashboard');
}
