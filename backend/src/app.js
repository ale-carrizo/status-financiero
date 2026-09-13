require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const cardsRoutes = require('./routes/cards.routes');
const statementsRoutes = require('./routes/statements.routes');
const rulesRoutes = require('./routes/rules.routes');
const transactionsRoutes = require('./routes/transactions.routes');
const plannedPurchasesRoutes = require('./routes/planned-purchases.routes');
const manualObligationsRoutes = require('./routes/manual-obligations.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { prisma } = require('./config/db');
const { serializeDecimalsMiddleware } = require('./lib/serialize');

const app = express();

app.use(helmet());
app.use(compression());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(serializeDecimalsMiddleware);

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/statements', statementsRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/planned-purchases', plannedPurchasesRoutes);
app.use('/api/manual-obligations', manualObligationsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Backend corriendo en puerto ${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

module.exports = app;
