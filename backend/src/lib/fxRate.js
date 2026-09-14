const { prisma } = require('../config/db');

// Cotización oficial del dólar (comprador/vendedor) día por día, para convertir los montos en
// U$S de las tarjetas a pesos en el Flujo de Caja. La API del BCRA no es alcanzable desde este
// entorno (timeout), así que se usa este proxy público que republica la serie histórica del
// "dólar oficial" (Banco Nación) día por día — el valor "compra" es el que pide el usuario
// ("cotización valor comprador"). Se cachea en la tabla fx_rates para no repetir la consulta.
const API_BASE = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial';

function dateOnly(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function fetchFromApi(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  try {
    const res = await fetch(`${API_BASE}/${y}/${m}/${d}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.error || typeof data.compra !== 'number') return null;
    return { compra: data.compra, venta: data.venta };
  } catch {
    return null;
  }
}

// El BCRA no cotiza fines de semana/feriados — si el día pedido no tiene cotización, retrocede
// hasta 7 días buscando el último día hábil publicado.
async function getRateForDate(date) {
  for (let i = 0; i < 7; i++) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dateOnly(d);

    const cached = await prisma.fxRate.findUnique({ where: { date: key } });
    if (cached) return { compra: Number(cached.compra), venta: Number(cached.venta) };

    const fetched = await fetchFromApi(key);
    if (fetched) {
      await prisma.fxRate
        .upsert({ where: { date: key }, create: { date: key, ...fetched }, update: fetched })
        .catch(() => {});
      return fetched;
    }
  }
  return null;
}

async function getLatestRate() {
  return getRateForDate(dateOnly(new Date()));
}

module.exports = { getRateForDate, getLatestRate };
