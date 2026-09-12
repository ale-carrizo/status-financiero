import { getToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken();
  if (!token) return new Response('No autenticado', { status: 401 });

  const upstream = await fetch(`${API_URL}/statements/${id}/file`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!upstream.ok) return new Response('No encontrado', { status: upstream.status });

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  const contentDisposition = upstream.headers.get('content-disposition');
  if (contentType) headers.set('content-type', contentType);
  if (contentDisposition) headers.set('content-disposition', contentDisposition);

  return new Response(upstream.body, { headers });
}
