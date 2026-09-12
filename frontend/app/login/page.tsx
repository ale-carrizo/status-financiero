import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="card p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">Status Financiero</h1>
        <p className="text-sm text-slate-500 mb-6">Ingresá para ver tu rendición de gastos.</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
        )}

        <form action={login} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" name="email" required className="input" placeholder="admin@status-financiero.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input type="password" name="password" required className="input" />
          </div>
          <button type="submit" className="btn btn-primary w-full mt-2">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
