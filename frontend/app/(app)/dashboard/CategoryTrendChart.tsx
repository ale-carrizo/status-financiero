import { formatArsCompact, formatPeriodShort } from '@/lib/format';
import type { Category } from '@/lib/types';

// Colores categóricos validados (ver skill dataviz — orden fijo, no se ciclan): cada categoría
// tiene una entrada del set de 8 huess de referencia, elegida para no chocar con los colores del
// gráfico de Flujo de Caja de al lado.
const SERIES: { key: Category; label: string; color: string }[] = [
  { key: 'EMPRESA', label: 'Empresa', color: '#eda100' },
  { key: 'PERSONAL', label: 'Personal', color: '#008300' },
  { key: 'IMPUESTO', label: 'Impuestos', color: '#2a78d6' },
  { key: 'SIN_CLASIFICAR', label: 'Sin clasificar', color: '#e34948' },
];

export type MonthCategoryTotals = { period: string } & Record<Category, number>;

const W = 720;
const H = 280;
const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_W = W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

export default function CategoryTrendChart({ data }: { data: MonthCategoryTotals[] }) {
  const totals = data.map((d) => SERIES.reduce((sum, s) => sum + (d[s.key] || 0), 0));
  const maxTotal = Math.max(...totals, 1);
  const bandW = PLOT_W / Math.max(data.length, 1);
  const barW = Math.min(bandW * 0.6, 64);

  const gridFracs = [0, 0.25, 0.5, 0.75, 1];

  const activeSeries = SERIES.filter((s) => data.some((d) => (d[s.key] || 0) > 0));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gastos por categoría, últimos meses" className="w-full">
        {gridFracs.map((f) => {
          const y = PAD_TOP + PLOT_H * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#94a3b8">
                {formatArsCompact(maxTotal * f)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = PAD_LEFT + bandW * i + bandW / 2;
          const x = cx - barW / 2;
          let yCursor = PAD_TOP + PLOT_H;
          const segments = activeSeries.map((s) => {
            const v = d[s.key] || 0;
            const segH = (v / maxTotal) * PLOT_H;
            const yTop = yCursor - segH;
            const rect =
              segH > 0 ? (
                <rect
                  key={s.key}
                  x={x}
                  y={yTop + 1}
                  width={barW}
                  height={Math.max(segH - 2, 0)}
                  fill={s.color}
                >
                  <title>{`${s.label} · ${formatPeriodShort(d.period)}: ${formatArsCompact(v)}`}</title>
                </rect>
              ) : null;
            yCursor = yTop;
            return rect;
          });
          const total = totals[i];

          return (
            <g key={d.period}>
              {segments}
              {total > 0 && (
                <text x={cx} y={PAD_TOP + PLOT_H - (total / maxTotal) * PLOT_H - 6} textAnchor="middle" fontSize={10} fill="#52525b" fontWeight={600}>
                  {formatArsCompact(total)}
                </text>
              )}
              <text x={cx} y={H - 14} textAnchor="middle" fontSize={11} fill="#64748b">
                {formatPeriodShort(d.period)}
              </text>
            </g>
          );
        })}

        <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H} stroke="#cbd5e1" strokeWidth={1} />
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
        {activeSeries.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
