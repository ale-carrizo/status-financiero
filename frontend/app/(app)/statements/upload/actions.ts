'use server';
import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { redirect } from 'next/navigation';

export async function uploadStatement(formData: FormData) {
  const token = (await getToken())!;

  let statementId: string | null = null;
  let uploadError: string | null = null;

  try {
    const result = await api.uploadStatement(token, formData);
    statementId = result.id;
  } catch (e) {
    uploadError = e instanceof Error ? e.message : 'Error subiendo el resumen';
  }

  if (uploadError) {
    redirect('/statements/upload?error=' + encodeURIComponent(uploadError));
  }

  redirect(`/statements/${statementId}`);
}
