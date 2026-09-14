const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { computeProjections, monthLabel, addMonths } = require('../lib/projections');
const { getRateForDate, getLatestRate } = require('../lib/fxRate');

const router = express.Router();
router.use(requireAuth);

function emptyTotals() {
  return { EMPRESA: { ars: 0, usd: 0 }, PERSONAL: { ars: 0, usd: 0 }, IMPUESTO: { ars: 0, usd: 0 }, EXCLUIDO: { ars: 0, usd: 0 }, SIN_CLASIFICAR: { ars: 0, usd: 0 } };
}

// Totales por tarjeta y categoría para un mes (period_label = "YYYY-MM").
router.get('/summary', async (req, res) => {
  const { period } = req.query;
  if (!period) return res.status(400).json({ error: 'period (YYYY-MM) es requerido' });

  const statements = await prisma.statement.findMany({
    where: { period_label: period },
    include: { card_account: true, transactions: true },
  });

  const byCard = statements.map((s) => {
    const totals = emptyTotals();
    for (const t of s.transactions) {
      totals[t.category].ars += Number(t.monto_ars);
      totals[t.category].usd += Number(t.monto_usd);
    }
    return {
      statement_id: s.id,
      card_account: s.card_account,
      total_ars: Number(s.total_ars),
      total_usd: Number(s.total_usd),
      totals,
    };
  });

  const consolidated = emptyTotals();
  for (const c of byCard) {
    for (const cat of Object.keys(consolidated)) {
      consolidated[cat].ars += c.totals[cat].ars;
      consolidated[cat].usd += c.totals[cat].usd;
    }
  }

  res.json({ period, byCard, consolidated });
});

// Historial de totales por período para una tarjeta (o todas).
router.get('/history', async (req, res) => {
  const { card_account_id } = req.query;
  const statements = await prisma.statement.findMany({
    where: card_account_id ? { card_account_id } : undefined,
    include: { card_account: true, transactions: true },
    orderBy: { closing_date: 'asc' },
  });

  const history = statements.map((s) => {
    const totals = emptyTotals();
    for (const t of s.transactions) {
      totals[t.category].ars += Number(t.monto_ars);
      totals[t.category].usd += Number(t.monto_usd);
    }
    return {
      statement_id: s.id,
      period: s.period_label,
      card_account: s.card_account,
      total_ars: Number(s.total_ars),
      total_usd: Number(s.total_usd),
      totals,
    };
  });

  res.json(history);
});

// Proyección de cuotas pendientes + compras planificadas para una tarjeta.
router.get('/projections', async (req, res) => {
  const { card_account_id, months } = req.query;
  if (!card_account_id) return res.status(400).json({ error: 'card_account_id es requerido' });

  const latestStatement = await prisma.statement.findFirst({
    where: { card_account_id },
    orderBy: { closing_date: 'desc' },
    include: { transactions: true },
  });

  if (!latestStatement) {
    return res.status(404).json({ error: 'La tarjeta no tiene resúmenes cargados todavía' });
  }

  const plannedPurchases = await prisma.plannedPurchase.findMany({ where: { card_account_id } });

  const projections = computeProjections({
    transactions: latestStatement.transactions,
    plannedPurchases,
    statementPeriodLabel: latestStatement.period_label,
    monthsAhead: months ? parseInt(months, 10) : 6,
  });

  res.json({ card_account_id, based_on_statement: latestStatement.id, projections });
});

// Flujo de caja consolidado: filas = tarjetas automáticas (parseadas) + préstamos/tarjetas
// manuales, columnas = meses (pasado reciente + futuro). Para cada tarjeta automática, usa
// el total real del Statement si existe para ese mes; si no, la proyección de cuotas
// pendientes calculada a partir del último resumen cargado. Reemplaza la vista vieja de
// "Proyecciones" por tarjeta, que ahora vive combinada acá.
router.get('/cashflow', async (req, res) => {
  const monthsBack = req.query.back ? parseInt(req.query.back, 10) : 2;
  const monthsForward = req.query.forward ? parseInt(req.query.forward, 10) : 4;

  const now = new Date();
  const baseYear = now.getUTCFullYear();
  const baseMonth = now.getUTCMonth();

  const months = [];
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const { year, monthIndex } = addMonths(baseYear, baseMonth, i);
    months.push(monthLabel(year, monthIndex));
  }

  const rows = [];

  // Convierte el monto en U$S de una celda a pesos con la cotización "comprador" del día de
  // cierre real (si hay statement) o la más reciente disponible (proyecciones y obligaciones
  // manuales, que no tienen una fecha de cierre propia).
  async function withUsdArs(cell) {
    if (!cell.usd) return { ...cell, usd_ars: 0 };
    const rate = cell.closing_date ? await getRateForDate(cell.closing_date) : await getLatestRate();
    return { ars: cell.ars, usd: cell.usd, actual: cell.actual, usd_ars: rate ? cell.usd * rate.compra : 0 };
  }

  const cardAccounts = await prisma.cardAccount.findMany({ where: { is_active: true }, orderBy: { label: 'asc' } });
  for (const card of cardAccounts) {
    const statements = await prisma.statement.findMany({
      where: { card_account_id: card.id },
      include: { transactions: true },
      orderBy: { closing_date: 'desc' },
    });
    const plannedPurchases = await prisma.plannedPurchase.findMany({ where: { card_account_id: card.id } });

    const actualByPeriod = {};
    for (const s of statements) {
      actualByPeriod[s.period_label] = {
        ars: Number(s.total_ars),
        usd: Number(s.total_usd),
        actual: true,
        closing_date: s.closing_date,
      };
    }

    let projectedByPeriod = {};
    const latest = statements[0];
    if (latest) {
      const proj = computeProjections({
        transactions: latest.transactions,
        plannedPurchases,
        statementPeriodLabel: latest.period_label,
        monthsAhead: monthsBack + monthsForward + 12,
      });
      for (const p of proj) projectedByPeriod[p.month] = { ars: p.ars, usd: p.usd, actual: false };
    }

    const cells = await Promise.all(
      months.map((m) => withUsdArs(actualByPeriod[m] || projectedByPeriod[m] || { ars: 0, usd: 0, actual: false }))
    );
    rows.push({ id: card.id, label: card.label, type: 'CARD_AUTO', cells });
  }

  const obligations = await prisma.manualObligation.findMany({
    where: { is_active: true },
    include: { entries: true },
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
  });
  for (const ob of obligations) {
    const byPeriod = {};
    for (const e of ob.entries) byPeriod[e.period_label] = { ars: Number(e.monto_ars), usd: Number(e.monto_usd), actual: true };
    const cells = await Promise.all(months.map((m) => withUsdArs(byPeriod[m] || { ars: 0, usd: 0, actual: false })));
    rows.push({ id: ob.id, label: ob.label, type: ob.type, cells });
  }

  // Los ingresos (sueldos, extras, etc.) se cargan como una obligación manual más (mismo
  // modelo, con un ObligationGroup marcado is_income) pero se muestran y totalizan aparte: no
  // son un gasto, así que no entran en "Total" — en cambio se restan de él para armar el
  // Saldo del mes. "type" puede ser cualquier ObligationGroup que el usuario haya creado, no
  // solo los 3 con los que arrancó la app.
  const obligationGroups = await prisma.obligationGroup.findMany();
  const incomeTypes = new Set(obligationGroups.filter((g) => g.is_income).map((g) => g.key));
  const expenseRows = rows.filter((r) => !incomeTypes.has(r.type));
  const incomeRows = rows.filter((r) => incomeTypes.has(r.type));

  function sumRows(rowSet) {
    return months.map((m, i) =>
      rowSet.reduce(
        (acc, r) => ({
          ars: acc.ars + r.cells[i].ars,
          usd: acc.usd + r.cells[i].usd,
          usd_ars: acc.usd_ars + r.cells[i].usd_ars,
        }),
        { ars: 0, usd: 0, usd_ars: 0 }
      )
    );
  }

  const totals = sumRows(expenseRows);
  const incomeTotals = sumRows(incomeRows);
  const balance = months.map((m, i) => ({
    ars: incomeTotals[i].ars + incomeTotals[i].usd_ars - (totals[i].ars + totals[i].usd_ars),
  }));

  res.json({ months, rows, totals, incomeTotals, balance, current_month: monthLabel(baseYear, baseMonth) });
});

module.exports = router;
