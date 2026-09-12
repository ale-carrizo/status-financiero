'use server';
import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';

export async function createRule(formData: FormData) {
  const token = (await getToken())!;
  const card_account_id = formData.get('card_account_id') as string;
  await api.createRule(token, {
    keyword: formData.get('keyword'),
    concept_label: formData.get('concept_label'),
    category: formData.get('category'),
    card_account_id: card_account_id || null,
    priority: Number(formData.get('priority') || 0),
  });
  revalidatePath('/rules');
}

export async function toggleRule(id: string, active: boolean) {
  const token = (await getToken())!;
  await api.updateRule(token, id, { active });
  revalidatePath('/rules');
}

export async function deleteRuleAction(id: string) {
  const token = (await getToken())!;
  await api.deleteRule(token, id);
  revalidatePath('/rules');
}
