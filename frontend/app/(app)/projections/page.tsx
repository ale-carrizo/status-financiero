import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatMonto, formatPeriod } from '@/lib/format';
import type { CardAccount, PlannedPurchase, ProjectionMonth } from '@/lib/types';
import { createPlannedPurchase } from './actions';
import DeletePurchaseButton from './DeletePurchaseButton';
import AutoSubmitSelect from '@/lib/AutoSubmitSelect';

export default async function ProjectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ card_account_id?: string }>;
}) {
  const token = (await getToken())!;
  const { card_account_id } = await searchParams;
  const cards: CardAccount[] = await api.getCards(token);
  const activeCardId = card_account_id || cards[0]?.id;

  let projections: ProjectionMonth[] = [];
  let projectionError: string | null = null;
  if (activeCardId) {
    try {
      const res = await api.getProjections(token, activeCardId, 6);
      projections = res.projections;
    } catch (e) {
      projectionError = e instanceof Error ? e.message : 'Error calculando la proyección';
    }
  }

  const plannedPurchases: PlannedPurchase[] = await api.getPlannedPurchases(token);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proyecciones</h1>
        <form className="flex gap-2" action="/projections">
          <AutoSubmitSelect name="card_account_id" defaultValue={activeCardId} className="input w-auto">
            {cards.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </AutoSubmitSelect>
        </form>
      </div>

      {projectionError && <div className="card p-4 text-red-700 bg-red-50 border-red-200 mb-6">{projectionError}</div>}

      {projections.length > 0 && (
        <div className="grid gap-4 mb-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {projections.map((p) => (
            <div key={p.month} className="card p-4">
              <h3 className="font-semibold mb-2">{formatPeriod(p.month)}</h3>
              <div className="text-lg font-bold mb-2">{formatMonto(p.ars, p.usd)}</div>
              <ul className="space-y-1 text-xs text-slate-500">
                {p.items.slice(0, 5).map((it, i) => (
                  <li key={i}>
                    {it.descripcion} ({it.cuota}) — {formatMonto(it.monto_ars, it.monto_usd)}
                  </li>
                ))}
                {p.items.length > 5 && <li>+ {p.items.length - 5} más</li>}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">Compras planificadas (aún no facturadas)</h2>
      <form action={createPlannedPurchase} className="card p-5 mb-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div>
          <label className="block text-xs font-medium mb-1">Tarjeta</label>
          <select name="card_account_id" required className="input" defaultValue={activeCardId}>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Descripción</label>
          <input name="descripcion" required className="input" placeholder="ej. Notebook nueva" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Monto total ($)</label>
          <input name="monto_total" type="number" step="0.01" required className="input" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Cuotas</label>
          <input name="cuotas" type="number" min={1} required className="input" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Primera cuota (mes)</label>
          <input name="first_charge_month" type="month" required className="input" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full">Agregar</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Tarjeta</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2">Cuotas</th>
              <th className="px-4 py-2">Desde</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plannedPurchases.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{p.descripcion}</td>
                <td className="px-4 py-2 text-slate-500">{p.card_account?.label}</td>
                <td className="px-4 py-2 text-right">{formatMonto(p.monto_total, 0)}</td>
                <td className="px-4 py-2">{p.cuotas}</td>
                <td className="px-4 py-2">{formatPeriod(p.first_charge_month)}</td>
                <td className="px-4 py-2"><DeletePurchaseButton id={p.id} /></td>
              </tr>
            ))}
            {plannedPurchases.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin compras planificadas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
