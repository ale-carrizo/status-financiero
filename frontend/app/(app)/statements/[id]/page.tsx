import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatArs, formatUsd, formatMonto } from '@/lib/format';
import type { Statement } from '@/lib/types';
import CategorySelect from './CategorySelect';
import { deleteStatement } from './actions';

export default async function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await getToken())!;
  const statement: Statement = await api.getStatement(token, id);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{statement.card_account.label}</h1>
          <p className="text-sm text-slate-500">
            {statement.period_label} · Cierre {new Date(statement.closing_date).toLocaleDateString('es-AR')} ·
            Total {formatMonto(statement.total_ars, statement.total_usd)}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/statements/${id}/file`} className="btn btn-secondary" target="_blank">
            Descargar PDF
          </a>
          <form action={async () => { 'use server'; await deleteStatement(id); }}>
            <button type="submit" className="btn btn-secondary text-red-600">Eliminar</button>
          </form>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Titular</th>
              <th className="px-4 py-2">Cuota</th>
              <th className="px-4 py-2 text-right">Monto ARS</th>
              <th className="px-4 py-2 text-right">Monto USD</th>
              <th className="px-4 py-2">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {statement.transactions.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 whitespace-nowrap">
                  {t.fecha ? new Date(t.fecha).toLocaleDateString('es-AR') : '—'}
                </td>
                <td className="px-4 py-2">
                  {t.descripcion}
                  {t.concept_label && <span className="text-xs text-slate-400 ml-1">({t.concept_label})</span>}
                </td>
                <td className="px-4 py-2 text-slate-500">{t.cardholder || '—'}</td>
                <td className="px-4 py-2 text-slate-500">
                  {t.cuota_actual && t.cuota_total ? `${t.cuota_actual}/${t.cuota_total}` : '—'}
                </td>
                <td className="px-4 py-2 text-right">{t.monto_ars ? `$${formatArs(t.monto_ars)}` : '—'}</td>
                <td className="px-4 py-2 text-right">{t.monto_usd ? `U$S ${formatUsd(t.monto_usd)}` : '—'}</td>
                <td className="px-4 py-2">
                  <CategorySelect transactionId={t.id} statementId={id} category={t.category} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
