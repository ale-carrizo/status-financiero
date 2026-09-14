const express = require('express');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Los 3 tipos con los que arrancó la app (antes un enum fijo). Se aseguran acá en vez de en el
// seed para que existan aunque la tabla se haya creado después en una base ya en uso.
const BUILTIN_GROUPS = [
  { key: 'LOAN', label: 'Préstamos', is_income: false, sort_order: 0 },
  { key: 'MANUAL_CARD', label: 'Tarjetas manuales', is_income: false, sort_order: 1 },
  { key: 'INCOME', label: 'Ingresos', is_income: true, sort_order: 2 },
];

async function ensureBuiltins() {
  for (const g of BUILTIN_GROUPS) {
    await prisma.obligationGroup.upsert({
      where: { key: g.key },
      update: {},
      create: { ...g, is_builtin: true },
    });
  }
}

function slugify(label) {
  return label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'TIPO';
}

router.get('/', async (req, res) => {
  await ensureBuiltins();
  const groups = await prisma.obligationGroup.findMany({ orderBy: [{ sort_order: 'asc' }, { label: 'asc' }] });
  res.json(groups);
});

router.post('/', async (req, res) => {
  const { label, is_income } = req.body || {};
  if (!label) return res.status(400).json({ error: 'label es requerido' });

  const base = slugify(label);
  let key = base;
  let n = 1;
  while (await prisma.obligationGroup.findUnique({ where: { key } })) {
    key = `${base}_${n++}`;
  }

  const maxSort = await prisma.obligationGroup.aggregate({ _max: { sort_order: true } });
  const group = await prisma.obligationGroup.create({
    data: {
      key,
      label,
      is_income: !!is_income,
      is_builtin: false,
      sort_order: (maxSort._max.sort_order || 0) + 1,
    },
  });
  res.status(201).json(group);
});

module.exports = router;
