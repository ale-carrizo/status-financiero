// Convierte Prisma.Decimal a number en toda respuesta JSON.
// Duck-typing (typeof value.toNumber === 'function') en vez de constructor.name —
// mismo patrón que Infinity POS, evita bugs de NaN si el objeto viene de otra instancia de Decimal.js.
function serializeDecimals(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber();
  }

  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map(serializeDecimals);
  }

  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = serializeDecimals(value[key]);
    }
    return out;
  }

  return value;
}

function serializeDecimalsMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(serializeDecimals(body));
  next();
}

module.exports = { serializeDecimals, serializeDecimalsMiddleware };
