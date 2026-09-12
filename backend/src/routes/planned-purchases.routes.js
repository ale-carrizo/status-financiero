const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const purchases = await prisma.plannedPurchase.findMany({
    include: { card_account: true },
    orderBy: { first_charge_month: 'asc' },
  });
  res.json(purchases);
});

router.post('/', async (req, res) => {
  const { card_account_id, descripcion, monto_total, cuotas, first_charge_month } = req.body || {};
  if (!card_account_id || !descripcion || !monto_total || !cuotas || !first_charge_month) {
    return res.status(400).json({
      error: 'card_account_id, descripcion, monto_total, cuotas y first_charge_month son requeridos',
    });
  }
  const purchase = await prisma.plannedPurchase.create({
    data: { card_account_id, descripcion, monto_total, cuotas, first_charge_month },
  });
  res.status(201).json(purchase);
});

router.delete('/:id', async (req, res) => {
  await prisma.plannedPurchase.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
