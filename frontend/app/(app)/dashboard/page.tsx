import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatMonto, formatPeriod } from '@/lib/format';
import type { DashboardSummary, Category, CardAccount, CategoryTotals, Cashflow } from '@/lib/types';
import Link from 'next/link';
import CategoryTrendChart, { type MonthCategoryTotals } from './CategoryTrendChart';
import CashflowChart, { type CashflowMonth } from './CashflowChart';

const CATEGORY_ORDER: Category[] = ['EMPRESA', 'PERSONAL', 'IMPUESTO', 'EXCLUIDO', 'SIN_CLASIFICAR'];
const CATEGORY_LABEL: Record<Category, string> = {
  EMPRESA: 'Empresa',
  PERSONAL: 'Personal',
  IMPUESTO: 'Impuestos',
  EXCLUIDO: 'Excluido',
  SIN_CLASIFICAR: 'Sin clasificar',
};

type HistoryRow = {
  statement_id: string;
  period: string;
  card_account: CardAccount;
  total_ars: number;
  total_usd: number;
  totals: CategoryTotals;
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function aggregateCategoryTrend(history: HistoryRow[], monthsBack: number): MonthCategoryTotals[] {
  const byPeriod = new Map<string, Record<Category, number>>();
  for (const h of history) {
    const cur = byPeriod.get(h.period) || { EMPRESA: 0, PERSONAL: 0, IMPUESTO: 0, EXCLUIDO: 0, SIN_CLASIFICAR: 0 };
    for (const cat of CATEGORY_ORDER) cur[cat] += h.totals[cat]?.ars || 0;
    byPeriod.set(h.period, cur);
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-monthsBack)
    .map(([period, totals]) => ({ period, ...totals }));
}

function toCashflowMonths(cashflow: Cashflow): CashflowMonth[] {
  return cashflow.months.map((period, i) => ({
    period,
    ingresos: cashflow.incomeTotals[i].ars + cashflow.incomeTotals[i].usd_ars,
    gastos: cashflow.totals[i].ars + cashflow.totals[i].usd_ars,
    saldo: cashflow.balance[i].ars,
  }));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const token = (await getToken())!;
  const { period } = await searchParams;
  const activePeriod = period || currentPeriod();

  let summary: DashboardSummary | null = null;
  let error: string | null = null;
  try {
    summary = await api.getDashboardSummary(token, activePeriod);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error cargando el dashboard';
  }

  const [history, cashflow]: [HistoryRow[], Cashflow] = await Promise.all([
    api.getDashboardHistory(token),
    api.getCashflow(token, 5, 0),
  ]);
  const categoryTrend = aggregateCategoryTrend(history, 6);
  const cashflowMonths = toCashflowMonths(cashflow);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{formatPeriod(activePeriod)}</h1>
        <form className="flex gap-2" action="/dashboard">
          <input type="month" name="period" defaultValue={activePeriod} className="input w-auto" />
          <button type="submit" className="btn btn-secondary">Ver</button>
        </form>
      </div>

      {error && <div className="card p-4 text-red-700 bg-red-50 border-red-200 mb-6">{error}</div>}

      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card p-5">
          <h3 className="font-semibold mb-1">Gastos por categoría</h3>
          <p className="text-xs text-slate-500 mb-3">Últimos {categoryTrend.length} meses, en pesos.</p>
          {categoryTrend.length > 0 ? (
            <CategoryTrendChart data={categoryTrend} />
          ) : (
            <div className="text-sm text-slate-400 py-8 text-center">Sin datos todavía.</div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-1">Flujo de caja</h3>
          <p className="text-xs text-slate-500 mb-3">Ingresos, gastos y saldo por mes.</p>
          {cashflowMonths.length > 0 ? (
            <CashflowChart data={cashflowMonths} />
          ) : (
            <div className="text-sm text-slate-400 py-8 text-center">Sin datos todavía.</div>
          )}
        </div>
      </div>

      {summary && summary.byCard.length === 0 && (
        <div className="card p-6 text-slate-500">
          No hay resúmenes cargados para este mes.{' '}
          <Link href="/statements/upload" className="text-brand-700 underline">
            Subí uno acá
          </Link>
          .
        </div>
      )}

      {summary && summary.byCard.length > 0 && (
        <>
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {summary.byCard.map((c) => (
              <div key={c.statement_id} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{c.card_account.label}</h3>
                  <Link href={`/statements/${c.statement_id}`} className="text-xs text-brand-700 underline">
                    Ver detalle
                  </Link>
                </div>
                <div className="text-sm text-slate-500 mb-3">
                  Total: {formatMonto(c.total_ars, c.total_usd)}
                </div>
                <div className="space-y-1.5">
                  {CATEGORY_ORDER.map((cat) => {
                    const t = c.totals[cat];
                    if (!t.ars && !t.usd) return null;
                    return (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <span className={`badge badge-${cat.toLowerCase().replace('_', '-')}`}>
                          {CATEGORY_LABEL[cat]}
                        </span>
                        <span className="font-medium">{formatMonto(t.ars, t.usd)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">Total consolidado</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {CATEGORY_ORDER.map((cat) => (
                <div key={cat}>
                  <div className={`badge badge-${cat.toLowerCase().replace('_', '-')} mb-1`}>
                    {CATEGORY_LABEL[cat]}
                  </div>
                  <div className="font-semibold">{formatMonto(summary!.consolidated[cat].ars, summary!.consolidated[cat].usd)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
