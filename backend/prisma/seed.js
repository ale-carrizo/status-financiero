const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@status-financiero.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, password_hash: passwordHash },
  });
  console.log(`Usuario admin: ${adminEmail} / ${adminPassword}`);

  const cards = [
    { label: 'Visa 2773 (Santander)', bank_profile: 'VISA_SANTANDER', card_number: '2773' },
    { label: 'Amex 1296 (Santander)', bank_profile: 'AMEX_SANTANDER', card_number: '1296' },
    { label: 'Mastercard Black (Galicia)', bank_profile: 'MASTERCARD_GALICIA', card_number: null },
    { label: 'Visa Galicia 4902/4910', bank_profile: 'VISA_GALICIA', card_number: '4902/4910' },
  ];

  const cardByProfile = {};
  for (const c of cards) {
    const card = await prisma.cardAccount.upsert({
      where: { id: `seed-${c.bank_profile}` },
      update: {},
      create: { id: `seed-${c.bank_profile}`, ...c },
    });
    cardByProfile[c.bank_profile] = card;
  }

  // Reglas de clasificación validadas manualmente durante junio-agosto 2026.
  const rules = [
    { keyword: 'messagebird', concept_label: 'MessageBird', category: 'EMPRESA', priority: 0 },
    { keyword: 'vercel', concept_label: 'Vercel Inc.', category: 'EMPRESA', priority: 0 },
    { keyword: 'microsoft', concept_label: 'Microsoft', category: 'EMPRESA', priority: 0 },
    { keyword: 'contabo', concept_label: 'Contabo', category: 'EMPRESA', priority: 0 },
    { keyword: 'make.com', concept_label: 'Make.com', category: 'EMPRESA', priority: 0 },
    { keyword: 'donweb', concept_label: 'Donweb', category: 'EMPRESA', priority: 0 },
    { keyword: 'dlohostinger', concept_label: 'DLO Hostinger', category: 'EMPRESA', priority: 0 },
    { keyword: 'hostinger', concept_label: 'DLO Hostinger', category: 'EMPRESA', priority: 0 },
    {
      keyword: 'openai',
      concept_label: 'OpenAI ChatGPT Sub',
      category: 'EMPRESA',
      priority: 0,
      // Nota: OpenAI a veces carga en Visa y a veces en Amex en el mismo mes (2 suscripciones
      // distintas) — se reclasifican/consolidan a mano en la pantalla de detalle, no acá.
    },
    { keyword: 'atlassian', concept_label: 'Atlassian', category: 'EMPRESA', priority: 0 },
    { keyword: 'callbell', concept_label: 'Callbell', category: 'EMPRESA', priority: 0 },
    {
      keyword: 'botmaker',
      concept_label: 'Botmaker',
      category: 'EMPRESA',
      priority: 0,
      card_account_id: cardByProfile.MASTERCARD_GALICIA.id,
    },
    {
      keyword: 'railway',
      concept_label: 'Railway',
      category: 'EMPRESA',
      priority: 0,
      card_account_id: cardByProfile.VISA_SANTANDER.id,
      // Si Railway también cobra en Amex el mismo mes, esa segunda ocurrencia se reclasifica
      // a mano (duplicado) — ver nota en el plan.
    },
    { keyword: 'iibb percep-cord', concept_label: 'IIBB Percep-Cord', category: 'IMPUESTO', priority: 5 },
    { keyword: 'iva rg 4240', concept_label: 'IVA RG 4240 21%', category: 'IMPUESTO', priority: 5 },
    { keyword: 'impuesto de sellos', concept_label: 'Impuesto de sellos', category: 'IMPUESTO', priority: 5 },
    {
      keyword: 'db.rg 5617',
      concept_label: 'Percepción Ganancias RG5617 (se bonifica en U$S)',
      category: 'EXCLUIDO',
      priority: 10,
    },
    { keyword: 'anthropic', concept_label: 'Anthropic Claude', category: 'SIN_CLASIFICAR', priority: 0 },
  ];

  for (const r of rules) {
    const existing = await prisma.classificationRule.findFirst({ where: { keyword: r.keyword, card_account_id: r.card_account_id || null } });
    if (!existing) {
      await prisma.classificationRule.create({ data: r });
    }
  }

  console.log(`Sembradas ${cards.length} tarjetas y ${rules.length} reglas de clasificación.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
