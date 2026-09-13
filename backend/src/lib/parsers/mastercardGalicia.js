const { toNumber } = require('./utils');

// Formato "Resumen de tarjeta de credito MASTERCARD BLACK" (Banco Galicia).
// Validado contra RESUMEN_MAST10_9_2026pdf.pdf (cierre 10/09/2026, sesión 12/09/2026).
//
// Particularidades de este template detectadas con pdf-parse (muy distinto a Santander):
// - El total a pagar ($ y U$S) aparece como dos líneas sueltas cerca del encabezado, ANTES
//   de las fechas de período — mucho más simple que ir a buscar "TOTAL A PAGAR" al final,
//   que en este banco además queda partido en dos líneas.
// - Las 6 fechas del período (cierre/vto anterior, actual, próximo) se linealizan repartidas
//   en 2-3 líneas sin separador consistente entre sí — se extraen con un regex global.
// - En "DETALLE DEL CONSUMO" cada línea trae fecha+descripción pegadas pero con espacios
//   normales alrededor del comprobante (5 dígitos) y el monto, a diferencia de Santander.
// - En el bloque CONSOLIDADO, varias líneas (impuestos/intereses) traen dos montos pegados
//   sin separador (pesos + dólares); se separan por el patrón fijo ",DD" de cada uno.

const MESES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

function parseDateDDMonYY(str) {
  if (!str) return null;
  const m = /(\d{2})-([A-Za-z]{3})-(\d{2,4})/.exec(str);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MESES[m[2].toLowerCase()];
  if (month === undefined) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  return new Date(Date.UTC(year, month, day));
}

// Año fijado a exactamente 2 dígitos: igual que en Santander, un año "greedy" de hasta 4
// dígitos se come el día de la fecha siguiente cuando vienen pegadas sin separador
// (ej. "06-Ago-26" + "14-Ago-26" → probaría leer "2614" como año).
const DATE_TOKEN_RE = /\d{2}-[A-Za-z]{3}-\d{2}/g;
const BARE_AMOUNT_RE = /^-?[\d.]+,\d{2}$/;
const FOREIGN_RE = /\([A-Za-z]+,\s*[A-Za-z]+,\s*[\d.,]+\)/;

// El resumen repite este bloque de encabezado/pie al arrancar cada una de sus ~5 páginas
// (incluso en medio de "DETALLE DEL CONSUMO"). Si no se filtra, "Resumen N° 027023238505"
// o el CUIT terminan matcheando el regex de movimiento como si fueran comprobante+monto,
// generando transacciones basura de millones de pesos.
const NOISE_LINE_RE = new RegExp(
  [
    '^Resumen N',
    '^Tarjeta Cr[eé]dito MASTERCARD',
    '^\\s*MONOTRIBUTISTA',
    '^BARRIO',
    '^P[aá]gina\\s*\\d',
    '^\\d{10,}H?$',
    '^CARRIZO,',
    '^INFORMACION (INSTITUCIONAL|DE LA ENTIDAD)$',
  ].join('|'),
  'i'
);

// Total a pagar: las 2 primeras líneas "sueltas" (solo número, sin letras) del documento,
// antes de que aparezca la primera fecha "DD-Mon-YY" — son el monto grande en pesos y en
// dólares que el banco muestra arriba de todo, repetido más abajo (partido en líneas) junto
// a "TOTAL A PAGAR".
function findTotalAPagar(lines) {
  const found = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (DATE_TOKEN_RE.test(line)) break;
    DATE_TOKEN_RE.lastIndex = 0;
    if (BARE_AMOUNT_RE.test(line)) {
      found.push(toNumber(line));
      if (found.length === 2) break;
    }
  }
  return { total_ars: found[0] || 0, total_usd: found[1] || 0 };
}

function findPeriodo(lines) {
  const dates = [];
  for (const raw of lines) {
    const line = raw.trim();
    const matches = line.match(DATE_TOKEN_RE);
    if (matches) dates.push(...matches);
    if (dates.length >= 6) break;
  }
  return {
    closing_date: dates[2] ? parseDateDDMonYY(dates[2]) : null,
    due_date: dates[3] ? parseDateDDMonYY(dates[3]) : null,
  };
}

// Separa dos montos pegados sin espacio, ej "9.879,500,38" -> ["9.879,50", "0,38"].
// Como la coma nunca forma parte de [\d.]+, el backtracking respeta el corte correcto.
const DUAL_AMOUNT_RE = /(-?[\d.]+,\d{2})(-?[\d.]+,\d{2})?\s*$/;

function parseConsolidadoTaxLine(line) {
  if (NOISE_LINE_RE.test(line)) return null;
  const m = DUAL_AMOUNT_RE.exec(line);
  if (!m) return null;
  const descripcion = line.slice(0, m.index).replace(/\s{2,}/g, ' ').trim();
  if (!descripcion) return null;
  return {
    descripcion,
    monto_ars: toNumber(m[1]),
    monto_usd: m[2] ? toNumber(m[2]) : 0,
  };
}

function parseConsolidadoTaxes(lines) {
  const out = [];
  let inSubtotal = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^SUBTOTAL\b/i.test(line)) { inSubtotal = true; continue; }
    if (!inSubtotal) continue;
    if (/^TOTAL A PAGAR/i.test(line)) break;
    const tax = parseConsolidadoTaxLine(line);
    if (tax) out.push(tax);
  }
  return out;
}

// Comprobante en DETALLE DEL CONSUMO: siempre 5 dígitos, con o sin espacio antes del monto.
const CONSUMO_LINE_RE = /^(\d{2}-[A-Za-z]{3}-\d{2})?(.*?)(?:\s(\d{2})\/(\d{2}))?\s*(\d{5})\s*(-?[\d.,]+)\s*$/;

function parseConsumoLine(line, fallbackDate) {
  if (!line) return null;
  if (NOISE_LINE_RE.test(line)) return null;
  if (/^FECHA.*REFERENCIA/i.test(line)) return null;
  if (/^(COMPRAS DEL MES|DEBITOS AUTOMATICOS|CUOTA DEL MES)$/i.test(line)) return null;

  const m = CONSUMO_LINE_RE.exec(line);
  if (!m) return null;
  const [, fechaStr, descRaw, cuotaActual, cuotaTotal, , montoStr] = m;
  const descripcion = descRaw.replace(/\s{2,}/g, ' ').trim();
  if (!descripcion) return null;

  const isForeign = FOREIGN_RE.test(descripcion);
  const monto = toNumber(montoStr);

  return {
    fecha: fechaStr ? parseDateDDMonYY(fechaStr) : fallbackDate,
    descripcion,
    cardholder: null,
    cuota_actual: cuotaActual ? parseInt(cuotaActual, 10) : null,
    cuota_total: cuotaTotal ? parseInt(cuotaTotal, 10) : null,
    monto_ars: isForeign ? 0 : monto,
    monto_usd: isForeign ? monto : 0,
  };
}

function parseDetalleConsumo(lines, fallbackDate) {
  const out = [];
  let inSection = false;
  let lastDate = fallbackDate;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^DETALLE DEL CONSUMO/i.test(line)) { inSection = true; continue; }
    if (!inSection) continue;
    if (/^Cuotas a vencer/i.test(line)) break;
    if (/^SUBTOTAL\b/i.test(line)) break;
    const mov = parseConsumoLine(line, lastDate);
    if (mov) {
      if (mov.fecha) lastDate = mov.fecha;
      out.push({ ...mov, fecha: mov.fecha || lastDate });
    }
  }
  return out;
}

function parseMastercardGaliciaStatement(text) {
  const lines = text.split('\n');
  const { total_ars, total_usd } = findTotalAPagar(lines);
  const { closing_date, due_date } = findPeriodo(lines);

  const transactions = [
    ...parseDetalleConsumo(lines, closing_date),
    ...parseConsolidadoTaxes(lines).map((t) => ({
      fecha: closing_date,
      descripcion: t.descripcion,
      cardholder: null,
      cuota_actual: null,
      cuota_total: null,
      monto_ars: t.monto_ars,
      monto_usd: t.monto_usd,
      is_tax_line: true,
    })),
  ];

  return { closing_date, due_date, total_ars, total_usd, transactions };
}

module.exports = { parse: parseMastercardGaliciaStatement };
