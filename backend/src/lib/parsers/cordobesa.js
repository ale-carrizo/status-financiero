const { toNumber } = require('./utils');

// Formato "Tarjeta Cordobesa" (emitida por Banco de Córdoba / Bancor, red propia, no
// Visa/Mastercard/Amex). A diferencia de los resúmenes Galicia/Santander, pdf-parse conserva
// los espacios reales entre columnas (no pega el texto), así que cada fila de movimiento viene
// en una sola línea con fecha, comprobante, descripción, cuota y los 2 montos (pesos/dólares)
// bien separados. Validado contra "2026-08-20.pdf" (cierre 20/08/2026, titular Débora).
//
// El signo negativo de los pagos ("SU PAGO EN PESOS") viene DESPUÉS del número
// ("655.807,35-"), no antes — lo maneja toNumber() en utils.js.

const MESES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, set: 8, sep: 8, oct: 9, nov: 10, dic: 11,
};

function monthFromName(name) {
  if (!name) return undefined;
  const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 3);
  return MESES[key];
}

function isCordobesaFormat(text) {
  return /TARJETA EMITIDA POR BANCO PROVINCIA DE CORDOBA/i.test(text);
}

function findClosingDate(lines) {
  for (const line of lines) {
    const m = /CIERRE ACTUAL:\s*(\d{2})\s+([A-Za-zÁÉÍÓÚÑ]+)\.?\s+(\d{2})\b/i.exec(line);
    if (m) {
      const [, d, mo, y] = m;
      const month = monthFromName(mo);
      if (month === undefined) continue;
      return new Date(Date.UTC(2000 + parseInt(y, 10), month, parseInt(d, 10)));
    }
  }
  return null;
}

// La fecha de vencimiento aparece pegada justo antes de los 4 montos del encabezado
// (saldo $/U$S, pago mínimo $/U$S) — se distingue de otras fechas sueltas del documento
// por venir seguida de al menos 2 tokens con forma de monto o "-,--" (sin deuda).
function findDueDate(lines) {
  const AMOUNT_OR_DASH = '(?:-?[\\d.,]+,\\d{2}-?|-,--)';
  const re = new RegExp(`^(\\d{2})\\s+([A-Za-zÁÉÍÓÚÑ]{3})\\s+(\\d{2})${AMOUNT_OR_DASH}${AMOUNT_OR_DASH}`, 'i');
  for (const raw of lines) {
    const m = re.exec(raw.trim());
    if (!m) continue;
    const [, d, mo, y] = m;
    const month = monthFromName(mo);
    if (month === undefined) continue;
    return new Date(Date.UTC(2000 + parseInt(y, 10), month, parseInt(d, 10)));
  }
  return null;
}

function findTotalAPagar(lines) {
  for (const line of lines) {
    const m = /^SALDO ACTUAL\s+(-?[\d.,]+-?)\s+(-?[\d.,]+-?)\s*$/.exec(line.trim());
    if (m) return { total_ars: toNumber(m[1]), total_usd: toNumber(m[2]) };
  }
  return { total_ars: 0, total_usd: 0 };
}

const CARD_SECTION_END_RE = /^TARJETA\s+(\d{4})\s+Total Consumos de\s+(.+?)\s+(-?[\d.,]+-?)\s+(-?[\d.,]+-?)\s*$/i;

// Fecha DD.MM.YY + comprobante opcional (6 dígitos) + descripción + cuota opcional "C.NN/NN" +
// 2 montos finales (pesos, dólares). Cubre tanto movimientos normales como las líneas de
// impuestos/comisiones del pie (mismo formato, sin comprobante ni cuota).
const MOVEMENT_RE = /^(\d{2})\.(\d{2})\.(\d{2})\s+(?:(\d{6})\s+)?(.+?)(?:\s+C\.(\d+)\/(\d+))?\s+(-?[\d.,]+-?)\s+(-?[\d.,]+-?)\s*$/;

function parseMovementLine(line) {
  const normalized = line.replace(/\s+/g, ' ').trim();
  const m = MOVEMENT_RE.exec(normalized);
  if (!m) return null;
  const [, dd, mm, yy, , descRaw, cuotaActual, cuotaTotal, arsStr, usdStr] = m;
  const descripcion = descRaw.trim();
  if (!descripcion) return null;
  return {
    fecha: new Date(Date.UTC(2000 + parseInt(yy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10))),
    descripcion,
    cuota_actual: cuotaActual ? parseInt(cuotaActual, 10) : null,
    cuota_total: cuotaTotal ? parseInt(cuotaTotal, 10) : null,
    monto_ars: toNumber(arsStr),
    monto_usd: toNumber(usdStr),
  };
}

function parseCordobesaStatement(text) {
  const lines = text.split('\n');
  const closing_date = findClosingDate(lines);
  const due_date = findDueDate(lines);
  const { total_ars, total_usd } = findTotalAPagar(lines);

  const transactions = [];
  let buffer = [];
  let sawAnySection = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\*\*|^L\s*e\s*c\s*t\s*u\s*r\s*a/i.test(line)) break;

    const sectionEnd = CARD_SECTION_END_RE.exec(line.replace(/\s+/g, ' ').trim());
    if (sectionEnd) {
      const cardholder = sectionEnd[2].trim();
      const isTitular = !sawAnySection;
      for (const bl of buffer) {
        const mov = parseMovementLine(bl);
        if (mov) transactions.push({ ...mov, cardholder, is_titular: isTitular });
      }
      buffer = [];
      sawAnySection = true;
      continue;
    }

    buffer.push(line);
  }

  // Lo que queda tras la última sección de tarjeta son las líneas de impuestos/comisiones,
  // con el mismo formato de fecha+descripción+2 montos, sin comprobante ni titular.
  for (const bl of buffer) {
    const mov = parseMovementLine(bl);
    if (mov) transactions.push({ ...mov, cardholder: null, is_tax_line: true });
  }

  return { closing_date, due_date, total_ars, total_usd, transactions };
}

module.exports = { parse: parseCordobesaStatement, isCordobesaFormat };
