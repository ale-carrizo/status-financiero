import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatMonto } from '@/lib/format';
import type { CardAccount } from '@/lib/types';
import Link from 'next/link';
import AutoSubmitSelect from '@/lib/AutoSubmitSelect';

type HistoryRow = {
  statement_id: string;
  period: string;
  card_account: CardAccount;
  total_ars: number;
  total_usd: number;
  totals: Record<string, { ars: number; usd: number }>;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ card_account_id?: string }>;
}) {
  const token = (await getToken())!;
  const { card_account_id } = await searchParams;
  const [cards, history] = await Promise.all([
    api.getCards(token) as Promise<CardAccount[]>,
    api.getDashboardHistory(token, card_account_id) as Promise<HistoryRow[]>,
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Historial</h1>
        <form className="flex gap-2" action="/history">
          <AutoSubmitSelect name="card_account_id" defaultValue={card_account_id || ''} className="input w-auto">
            <option value="">Todas las tarjetas</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </AutoSubmitSelect>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Período</th>
              <th className="px-4 py-2">Tarjeta</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Empresa</th>
              <th className="px-4 py-2 text-right">Personal</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.statement_id} className="border-t border-slate-100">
                <td className="px-4 py-2">{h.period}</td>
                <td className="px-4 py-2">{h.card_account.label}</td>
                <td className="px-4 py-2 text-right">{formatMonto(h.total_ars, h.total_usd)}</td>
                <td className="px-4 py-2 text-right">{formatMonto(h.totals.EMPRESA.ars, h.totals.EMPRESA.usd)}</td>
                <td className="px-4 py-2 text-right">{formatMonto(h.totals.PERSONAL.ars, h.totals.PERSONAL.usd)}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/statements/${h.statement_id}`} className="text-brand-700 underline text-xs">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No hay resúmenes cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
