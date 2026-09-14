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

export async function createObligation(formData: FormData) {
  const token = (await getToken())!;
  let type = formData.get('type') as string;

  if (type === '__new__') {
    const newTypeLabel = formData.get('new_type_label') as string;
    const group = await api.createObligationGroup(token, {
      label: newTypeLabel,
      is_income: formData.get('new_type_is_income') === 'true',
    });
    type = group.key;
  }

  await api.createManualObligation(token, {
    label: formData.get('label'),
    type,
  });
  revalidatePath('/projections');
}

export async function deleteObligation(id: string) {
  const token = (await getToken())!;
  await api.deleteManualObligation(token, id);
  revalidatePath('/projections');
}

export async function setObligationEntry(obligationId: string, periodLabel: string, montoArs: number) {
  const token = (await getToken())!;
  await api.setManualObligationEntry(token, obligationId, { period_label: periodLabel, monto_ars: montoArs });
  revalidatePath('/projections');
}
