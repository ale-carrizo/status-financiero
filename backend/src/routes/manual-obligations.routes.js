const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const obligations = await prisma.manualObligation.findMany({
    where: { is_active: true },
    include: { entries: true },
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
  });
  res.json(obligations);
});

router.post('/', async (req, res) => {
  const { label, type } = req.body || {};
  if (!label || !type) return res.status(400).json({ error: 'label y type son requeridos' });
  const group = await prisma.obligationGroup.findUnique({ where: { key: type } });
  if (!group) return res.status(400).json({ error: `No existe el tipo "${type}"` });
  const obligation = await prisma.manualObligation.create({ data: { label, type } });
  res.status(201).json(obligation);
});

router.delete('/:id', async (req, res) => {
  await prisma.manualObligation.update({ where: { id: req.params.id }, data: { is_active: false } });
  res.json({ ok: true });
});

// Carga/edita el monto de una obligación para un mes puntual (celda de la planilla).
router.put('/:id/entries', async (req, res) => {
  const { period_label, monto_ars, monto_usd } = req.body || {};
  if (!period_label) return res.status(400).json({ error: 'period_label es requerido' });

  const entry = await prisma.manualObligationEntry.upsert({
    where: { obligation_id_period_label: { obligation_id: req.params.id, period_label } },
    update: { monto_ars: monto_ars || 0, monto_usd: monto_usd || 0 },
    create: {
      obligation_id: req.params.id,
      period_label,
      monto_ars: monto_ars || 0,
      monto_usd: monto_usd || 0,
    },
  });
  res.json(entry);
});

module.exports = router;
