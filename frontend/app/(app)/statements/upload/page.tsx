import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import type { CardAccount } from '@/lib/types';
import { uploadStatement } from './actions';

export default async function UploadStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const token = (await getToken())!;
  const { error } = await searchParams;
  const cards: CardAccount[] = await api.getCards(token);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Subir resumen</h1>

      {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <form action={uploadStatement} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tarjeta</label>
          <select name="card_account_id" required className="input">
            <option value="">Elegí una tarjeta...</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Archivo PDF</label>
          <input type="file" name="file" accept="application/pdf" required className="input" />
          <p className="text-xs text-slate-500 mt-1">
            El parser se elige automáticamente según el banco de la tarjeta que elijas arriba.
          </p>
        </div>

        <button type="submit" className="btn btn-primary w-full">
          Procesar resumen
        </button>
      </form>
    </div>
  );
}
