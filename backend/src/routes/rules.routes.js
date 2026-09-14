const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const rules = await prisma.classificationRule.findMany({
    include: { card_account: true },
    orderBy: [{ priority: 'desc' }, { keyword: 'asc' }],
  });
  res.json(rules);
});

router.post('/', async (req, res) => {
  const { keyword, concept_label, category, card_account_id, cardholder, priority } = req.body || {};
  if (!category) {
    return res.status(400).json({ error: 'category es requerido' });
  }
  if (!keyword && !card_account_id && !cardholder) {
    return res.status(400).json({
      error: 'Elegí al menos un criterio: palabra clave, tarjeta o titular (si no, la regla aplicaría a TODO)',
    });
  }
  const rule = await prisma.classificationRule.create({
    data: {
      keyword: keyword || null,
      concept_label: concept_label || null,
      category,
      card_account_id: card_account_id || null,
      cardholder: cardholder || null,
      priority: priority || 0,
    },
  });
  res.status(201).json(rule);
});

router.patch('/:id', async (req, res) => {
  const { keyword, concept_label, category, card_account_id, cardholder, priority, active } = req.body || {};
  const rule = await prisma.classificationRule.update({
    where: { id: req.params.id },
    data: { keyword, concept_label, category, card_account_id, cardholder, priority, active },
  });
  res.json(rule);
});

router.delete('/:id', async (req, res) => {
  await prisma.classificationRule.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
