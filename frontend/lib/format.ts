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

export function formatPeriodShort(period: string): string {
  const [y, m] = period.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}
