const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const cards = await prisma.cardAccount.findMany({ orderBy: { label: 'asc' } });
  res.json(cards);
});

router.post('/', async (req, res) => {
  const { label, bank_profile, card_number } = req.body || {};
  if (!label || !bank_profile) {
    return res.status(400).json({ error: 'label y bank_profile son requeridos' });
  }
  const card = await prisma.cardAccount.create({ data: { label, bank_profile, card_number } });
  res.status(201).json(card);
});

router.patch('/:id', async (req, res) => {
  const { label, is_active, card_number } = req.body || {};
  const card = await prisma.cardAccount.update({
    where: { id: req.params.id },
    data: { label, is_active, card_number },
  });
  res.json(card);
});

module.exports = router;
