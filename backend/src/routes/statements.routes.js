const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { getParser } = require('../lib/parsers');
const { classifyTransactions } = require('../lib/rulesEngine');

const router = express.Router();
router.use(requireAuth);

const STATEMENTS_DIR = process.env.STATEMENTS_DIR || path.join(__dirname, '../../data/statements');
fs.mkdirSync(STATEMENTS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Solo se aceptan archivos PDF'));
    cb(null, true);
  },
});

function periodLabelFromDate(date) {
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

router.get('/', async (req, res) => {
  const { card_account_id } = req.query;
  const statements = await prisma.statement.findMany({
    where: card_account_id ? { card_account_id } : undefined,
    include: { card_account: true, _count: { select: { transactions: true } } },
    orderBy: { closing_date: 'desc' },
  });
  res.json(statements);
});

router.get('/:id', async (req, res) => {
  const statement = await prisma.statement.findUnique({
    where: { id: req.params.id },
    include: { card_account: true, transactions: { orderBy: { fecha: 'asc' } } },
  });
  if (!statement) return res.status(404).json({ error: 'No encontrado' });
  res.json(statement);
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { card_account_id } = req.body || {};
    if (!card_account_id) return res.status(400).json({ error: 'card_account_id es requerido' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo PDF' });

    const cardAccount = await prisma.cardAccount.findUnique({ where: { id: card_account_id } });
    if (!cardAccount) return res.status(404).json({ error: 'Tarjeta no encontrada' });

    const { text } = await pdfParse(req.file.buffer);
    const parser = getParser(cardAccount.bank_profile);
    const parsed = parser.parse(text);

    if (!parsed.closing_date) {
      return res.status(422).json({ error: 'No se pudo detectar la fecha de cierre en el PDF' });
    }

    const period_label = periodLabelFromDate(parsed.closing_date);

    const fileName = `${period_label}-${cardAccount.bank_profile}-${crypto.randomUUID()}.pdf`;
    const filePath = path.join(STATEMENTS_DIR, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    const rules = await prisma.classificationRule.findMany({ where: { active: true } });
    const classified = classifyTransactions(parsed.transactions, rules, card_account_id);

    const statement = await prisma.statement.create({
      data: {
        card_account_id,
        period_label,
        closing_date: parsed.closing_date,
        due_date: parsed.due_date || parsed.closing_date,
        total_ars: parsed.total_ars,
        total_usd: parsed.total_usd,
        raw_file_path: filePath,
        raw_file_name: req.file.originalname,
        transactions: {
          create: classified.map((t) => ({
            fecha: t.fecha,
            descripcion: t.descripcion,
            cardholder: t.cardholder || null,
            cuota_actual: t.cuota_actual,
            cuota_total: t.cuota_total,
            monto_ars: t.monto_ars || 0,
            monto_usd: t.monto_usd || 0,
            category: t.category,
            concept_label: t.concept_label,
            matched_rule_id: t.matched_rule_id,
          })),
        },
      },
      include: { transactions: true },
    });

    res.status(201).json(statement);
  } catch (err) {
    console.error('[statements.upload]', err);
    res.status(500).json({ error: 'Error procesando el resumen', detail: err.message });
  }
});

router.get('/:id/file', async (req, res) => {
  const statement = await prisma.statement.findUnique({ where: { id: req.params.id } });
  if (!statement) return res.status(404).json({ error: 'No encontrado' });
  res.download(statement.raw_file_path, statement.raw_file_name || 'resumen.pdf');
});

router.delete('/:id', async (req, res) => {
  const statement = await prisma.statement.findUnique({ where: { id: req.params.id } });
  if (!statement) return res.status(404).json({ error: 'No encontrado' });
  await prisma.statement.delete({ where: { id: req.params.id } });
  try { fs.unlinkSync(statement.raw_file_path); } catch { /* noop */ }
  res.json({ ok: true });
});

module.exports = router;
