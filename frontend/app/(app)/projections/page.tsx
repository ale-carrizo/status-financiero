import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatArs, formatMonto, formatPeriod, formatPeriodShort } from '@/lib/format';
import type { CardAccount, PlannedPurchase, Cashflow } from '@/lib/types';
import { createPlannedPurchase, createObligation } from './actions';
import DeletePurchaseButton from './DeletePurchaseButton';
import DeleteObligationButton from './DeleteObligationButton';
import EditableCell from './EditableCell';

const TYPE_LABEL: Record<string, string> = {
  CARD_AUTO: 'Tarjetas (automático)',
  LOAN: 'Préstamos',
  MANUAL_CARD: 'Tarjetas manuales',
};

export default async function ProjectionsPage() {
  const token = (await getToken())!;

  const [cashflow, cards, plannedPurchases]: [Cashflow, CardAccount[], PlannedPurchase[]] = await Promise.all([
    api.getCashflow(token),
    api.getCards(token),
    api.getPlannedPurchases(token),
  ]);

  const groups: { type: string; rows: typeof cashflow.rows }[] = ['CARD_AUTO', 'LOAN', 'MANUAL_CARD'].map(
    (type) => ({ type, rows: cashflow.rows.filter((r) => r.type === type) })
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Flujo de Caja</h1>
      <p className="text-sm text-slate-500 mb-6">
        Tarjetas automáticas: usan el total real del resumen si ya lo subiste, o la proyección de cuotas
        pendientes si no. Préstamos y tarjetas manuales: hacé click en una celda para cargar el monto.
      </p>

      <div className="card overflow-x-auto mb-8">
        <table className="text-sm" style={{ minWidth: `${280 + cashflow.months.length * 110}px` }}>
          <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 sticky left-0 bg-slate-50">Concepto</th>
              {cashflow.months.map((m) => (
                <th
                  key={m}
                  className={`px-3 py-2 text-right ${m === cashflow.current_month ? 'text-brand-700' : ''}`}
                >
                  {formatPeriodShort(m)}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) =>
            g.rows.length === 0 ? null : (
              <tbody key={g.type}>
                <tr className="bg-slate-50/60">
                  <td colSpan={cashflow.months.length + 1} className="px-4 py-1 text-xs font-bold text-slate-500 uppercase">
                    {TYPE_LABEL[g.type]}
                  </td>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 sticky left-0 bg-white whitespace-nowrap">
                      {r.label}
                      {r.type !== 'CARD_AUTO' && <DeleteObligationButton id={r.id} />}
                    </td>
                    {r.cells.map((c, i) =>
                      r.type === 'CARD_AUTO' ? (
                        <td
                          key={i}
                          className={`px-3 py-2 text-right whitespace-nowrap ${
                            c.actual ? '' : 'text-slate-400 italic'
                          }`}
                        >
                          {c.ars || c.usd ? formatMonto(c.ars, c.usd) : '—'}
                        </td>
                      ) : (
                        <td key={i} className="px-1 py-1 text-right">
                          <EditableCell obligationId={r.id} periodLabel={cashflow.months[i]} value={c.ars} />
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            )
          )}
          <tbody>
            <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
              <td className="px-4 py-2 sticky left-0 bg-slate-50">Total</td>
              {cashflow.totals.map((t, i) => (
                <td key={i} className="px-3 py-2 text-right whitespace-nowrap">
                  {formatMonto(t.ars, t.usd)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div>
          <h2 className="text-lg font-bold mb-3">Agregar préstamo o tarjeta manual</h2>
          <form action={createObligation} className="card p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Nombre</label>
              <input name="label" required className="input" placeholder="ej. Préstamo Casa, Visa HSBC" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tipo</label>
              <select name="type" required className="input">
                <option value="LOAN">Préstamo</option>
                <option value="MANUAL_CARD">Tarjeta (sin parser)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary w-full">Agregar</button>
          </form>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3">Compras planificadas (aún no facturadas)</h2>
      <form action={createPlannedPurchase} className="card p-5 mb-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div>
          <label className="block text-xs font-medium mb-1">Tarjeta</label>
          <select name="card_account_id" required className="input">
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
