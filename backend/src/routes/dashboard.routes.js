const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { computeProjections } = require('../lib/projections');

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

module.exports = router;
