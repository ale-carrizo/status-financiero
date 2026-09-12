'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData): Promise<void> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  let token: string | null = null;
  let loginError: string | null = null;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      loginError = 'Email o contraseña incorrectos';
    } else {
      const data = await res.json();
      token = data.token;
    }
  } catch {
    loginError = 'Error de conexión con el servidor';
  }

  if (loginError) {
    redirect('/login?error=' + encodeURIComponent(loginError));
  }

  const cookieStore = await cookies();
  cookieStore.set('auth_token', token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  redirect('/dashboard');
}
