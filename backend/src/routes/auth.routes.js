const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// El backend y el frontend corren en dominios distintos de Railway, así que el token viaja en
// el body de la respuesta (no como cookie del backend) — el frontend lo guarda en SU PROPIA
// cookie httpOnly (ver app/login/actions.ts) y lo reenvía como "Authorization: Bearer" en cada
// llamada server-side. Mismo patrón que dashboard-pedidos/frontend/app/login/actions.ts.
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ token, id: user.id, email: user.email });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

module.exports = router;
