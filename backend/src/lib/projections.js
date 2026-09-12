// Proyecta gastos futuros combinando:
//  (a) cuotas pendientes de transacciones ya parseadas (cuota_actual < cuota_total)
//  (b) compras planificadas a futuro (PlannedPurchase) que todavía no aparecieron en ningún resumen
//
// Mismo cálculo que se hizo a mano para la Visa Galicia en la sesión del 12/09/2026:
// cada cuota restante se distribuye un mes calendario a la vez a partir del mes siguiente
// al del statement (o de first_charge_month para las planificadas).

function monthLabel(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function addMonths(year, monthIndex, delta) {
  const total = monthIndex + delta;
  return { year: year + Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 };
}

function monthLabelToParts(label) {
  const [y, m] = label.split('-').map((n) => parseInt(n, 10));
  return { year: y, monthIndex: m - 1 };
}

function computeProjections({ transactions, plannedPurchases, statementPeriodLabel, monthsAhead = 6 }) {
  const { year: baseYear, monthIndex: baseMonth } = monthLabelToParts(statementPeriodLabel);
  const months = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const { year, monthIndex } = addMonths(baseYear, baseMonth, i);
    months.push(monthLabel(year, monthIndex));
  }

  const totals = {};
  for (const m of months) totals[m] = { ars: 0, usd: 0, items: [] };

  for (const t of transactions) {
    const remaining = (t.cuota_total || 0) - (t.cuota_actual || 0);
    if (remaining <= 0) continue;
    for (let i = 0; i < remaining && i < monthsAhead; i++) {
      const m = months[i];
      if (!m) break;
      totals[m].ars += Number(t.monto_ars) || 0;
      totals[m].usd += Number(t.monto_usd) || 0;
      totals[m].items.push({
        source: 'cuota_pendiente',
        descripcion: t.descripcion,
        cuota: `${(t.cuota_actual || 0) + i + 1}/${t.cuota_total}`,
        monto_ars: Number(t.monto_ars) || 0,
        monto_usd: Number(t.monto_usd) || 0,
      });
    }
  }

  for (const p of plannedPurchases || []) {
    const { year, monthIndex } = monthLabelToParts(p.first_charge_month);
    const montoCuota = Number(p.monto_total) / p.cuotas;
    for (let i = 0; i < p.cuotas; i++) {
      const { year: y, monthIndex: mi } = addMonths(year, monthIndex, i);
      const m = monthLabel(y, mi);
      if (!totals[m]) totals[m] = { ars: 0, usd: 0, items: [] };
      totals[m].ars += montoCuota;
      totals[m].items.push({
        source: 'planned_purchase',
        descripcion: p.descripcion,
        cuota: `${i + 1}/${p.cuotas}`,
        monto_ars: montoCuota,
        monto_usd: 0,
      });
    }
  }

  return months.map((m) => ({ month: m, ...totals[m] }));
}

module.exports = { computeProjections, monthLabel, addMonths };
