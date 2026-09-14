export function formatArs(n: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export function formatMonto(ars: number, usd: number): string {
  const parts: string[] = [];
  if (ars) parts.push(`$${formatArs(ars)}`);
  if (usd) parts.push(`U$S ${formatUsd(usd)}`);
  return parts.join(' + ') || '$0,00';
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split('-');
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

// "1.234.567" -> "$1,2M" ; "45.000" -> "$45K" — para ejes/etiquetas de gráficos, donde el
// monto exacto sobra y solo importa la magnitud.
export function formatArsCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function formatPeriodShort(period: string): string {
  const [y, m] = period.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}
