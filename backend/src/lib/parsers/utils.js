// Utilidades compartidas por los 4 parsers de resúmenes.

// "37.463,21" -> 37463.21 ; "-4.801,06" -> -4801.06
function toNumber(raw) {
  if (raw === null || raw === undefined) return 0;
  const cleaned = String(raw).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

// Extrae el primer monto en dólares de una línea: "U$S 1.741,19" -> 1741.19
const USD_RE = /U\$S\s*(-?[\d.,]+)/i;
// Extrae el primer monto en pesos: "$ 37.463,21" o "37.463,21" al final de línea
const ARS_RE = /\$\s*(-?[\d.,]+)/;

function extractUsd(line) {
  const m = USD_RE.exec(line);
  return m ? toNumber(m[1]) : null;
}

function extractArs(line) {
  const m = ARS_RE.exec(line);
  return m ? toNumber(m[1]) : null;
}

// "12/06" o "12/06/26" -> Date; devuelve null si no matchea
function parseDateDDMMYY(str, fallbackYear) {
  if (!str) return null;
  const m = /(\d{2})[\/-](\d{2})(?:[\/-](\d{2,4}))?/.exec(str);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  let year = m[3] ? parseInt(m[3], 10) : fallbackYear;
  if (year < 100) year += 2000;
  return new Date(Date.UTC(year, month, day));
}

// "11 de 12" / "02/03" -> { actual: 11, total: 12 }
function parseCuota(str) {
  if (!str) return { actual: null, total: null };
  let m = /(\d+)\s*de\s*(\d+)/i.exec(str);
  if (!m) m = /(\d+)\s*\/\s*(\d+)/.exec(str);
  if (!m) return { actual: null, total: null };
  return { actual: parseInt(m[1], 10), total: parseInt(m[2], 10) };
}

module.exports = { toNumber, extractUsd, extractArs, parseDateDDMMYY, parseCuota };
