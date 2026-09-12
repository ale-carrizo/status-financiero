'use server';
import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';

export async function createPlannedPurchase(formData: FormData) {
  const token = (await getToken())!;
  await api.createPlannedPurchase(token, {
    card_account_id: formData.get('card_account_id'),
    descripcion: formData.get('descripcion'),
    monto_total: Number(formData.get('monto_total')),
    cuotas: Number(formData.get('cuotas')),
    first_charge_month: formData.get('first_charge_month'),
  });
  revalidatePath('/projections');
}

export async function deletePlannedPurchase(id: string) {
  const token = (await getToken())!;
  await api.deletePlannedPurchase(token, id);
  revalidatePath('/projections');
}
