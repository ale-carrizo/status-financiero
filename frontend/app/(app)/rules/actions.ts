'use server';
import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';

export async function createRule(formData: FormData) {
  const token = (await getToken())!;
  const keyword = (formData.get('keyword') as string) || '';
  const concept_label = (formData.get('concept_label') as string) || '';
  const card_account_id = formData.get('card_account_id') as string;
  const cardholder = formData.get('cardholder') as string;
  await api.createRule(token, {
    keyword: keyword.trim() || null,
    concept_label: concept_label.trim() || null,
    category: formData.get('category'),
    card_account_id: card_account_id || null,
    cardholder: cardholder || null,
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
