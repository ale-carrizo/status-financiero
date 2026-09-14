const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const VALID_CATEGORIES = ['EMPRESA', 'PERSONAL', 'IMPUESTO', 'EXCLUIDO', 'SIN_CLASIFICAR'];

// Reclasificación manual de una transacción puntual (Railway duplicado, Anthropic, etc.)
// Marca manual_override para que un futuro re-parseo del mismo resumen no la pise.
router.patch('/:id', async (req, res) => {
  const { category, concept_label } = req.body || {};
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'category inválida' });
  }
  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: {
      ...(category ? { category } : {}),
      ...(concept_label !== undefined ? { concept_label } : {}),
      manual_override: true,
    },
  });
  res.json(transaction);
});

// Titulares distintos ya vistos entre todas las transacciones parseadas, para poblar el
// selector de "Titular" del formulario de reglas (nombres tal cual vienen de cada banco,
// sin normalizar — cada tarjeta imprime el mismo titular con formato ligeramente distinto).
router.get('/cardholders', async (req, res) => {
  const rows = await prisma.transaction.findMany({
    where: { cardholder: { not: null } },
    distinct: ['cardholder'],
    select: { cardholder: true },
    orderBy: { cardholder: 'asc' },
  });
  res.json(rows.map((r) => r.cardholder).filter(Boolean));
});

router.get('/', async (req, res) => {
  const { statement_id, category } = req.query;
  const transactions = await prisma.transaction.findMany({
    where: {
      ...(statement_id ? { statement_id } : {}),
      ...(category ? { category } : {}),
    },
    include: { statement: { include: { card_account: true } } },
    orderBy: { fecha: 'asc' },
  });
  res.json(transactions);
});

module.exports = router;
