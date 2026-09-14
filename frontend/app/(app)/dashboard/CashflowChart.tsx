import { formatArsCompact, formatPeriodShort } from '@/lib/format';

const COLOR_INGRESOS = '#008300';
const COLOR_GASTOS = '#4a3aa7';
const COLOR_SALDO_POS = '#008300';
const COLOR_SALDO_NEG = '#e34948';

export type CashflowMonth = { period: string; ingresos: number; gastos: number; saldo: number };

const W = 720;
const H = 280;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_W = W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

export default function CashflowChart({ data }: { data: CashflowMonth[] }) {
  const allValues = data.flatMap((d) => [d.ingresos, d.gastos, d.saldo]);
  const domainMax = Math.max(...allValues, 1);
  const domainMin = Math.min(0, ...allValues);
  const span = domainMax - domainMin || 1;

  const y = (v: number) => PAD_TOP + PLOT_H - ((v - domainMin) / span) * PLOT_H;
  const y0 = y(0);

  const bandW = PLOT_W / Math.max(data.length, 1);
  const barW = Math.min(bandW * 0.22, 22);
  const gap = barW * 0.25;

  // Grilla anclada en 0 (no fracciones parejas de [domainMin, domainMax], que dejarían la
  // línea del "0" real etiquetada con un valor distinto de cero cuando el rango no es simétrico).
  const gridValues = [
    ...(domainMin < 0 ? [domainMin, domainMin / 2] : []),
    0,
    ...(domainMax > 0 ? [domainMax / 2, domainMax] : []),
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos, gastos y saldo por mes" className="w-full">
        {gridValues.map((val) => {
          const yy = y(val);
          return (
            <g key={val}>
              <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={yy} y2={yy} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yy + 3} textAnchor="end" fontSize={10} fill="#94a3b8">
                {formatArsCompact(val)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = PAD_LEFT + bandW * i + bandW / 2;
          const xIngresos = cx - gap - barW * 1.5;
          const xGastos = cx - barW / 2;
          const xSaldo = cx + gap + barW / 2;

          function bar(x: number, value: number, color: string, label: string) {
            const top = Math.min(y(value), y0);
            const height = Math.max(Math.abs(y(value) - y0) - 1, 0);
            return (
              <rect x={x} y={top} width={barW} height={height} fill={color}>
                <title>{`${label} · ${formatPeriodShort(d.period)}: ${formatArsCompact(value)}`}</title>
              </rect>
            );
          }

          return (
            <g key={d.period}>
              {bar(xIngresos, d.ingresos, COLOR_INGRESOS, 'Ingresos')}
              {bar(xGastos, d.gastos, COLOR_GASTOS, 'Gastos')}
              {bar(xSaldo, d.saldo, d.saldo >= 0 ? COLOR_SALDO_POS : COLOR_SALDO_NEG, 'Saldo')}
              <text x={cx} y={H - 14} textAnchor="middle" fontSize={11} fill="#64748b">
                {formatPeriodShort(d.period)}
              </text>
            </g>
          );
        })}

        <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={y0} y2={y0} stroke="#cbd5e1" strokeWidth={1} />
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_INGRESOS }} />
          Ingresos
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_GASTOS }} />
          Gastos
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-flex gap-0.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_SALDO_POS }} />
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_SALDO_NEG }} />
          </span>
          Saldo (verde = positivo, rojo = negativo)
        </div>
      </div>
    </div>
  );
}
