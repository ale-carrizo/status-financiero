const { toNumber } = require('./utils');

// Formato VIEJO de los resúmenes Visa/Amex Santander Río (usado hasta ~julio 2026, antes de que
// el banco rediseñara el PDF al formato "Total a pagar / En pesos" que maneja santanderShared.js).
// Se detecta por la presencia de "SUPERCLUB PAQUETE BLACK" en el texto. Validado contra
// "Resumen Visa - 15-07-2026.pdf" y "Resumen American Express - 16-07-2026.pdf" (ambos cierre
// 02/07/2026) — total_ars/total_usd coinciden con los que ya habíamos validado a mano en junio.
//
// Estructura de cada fila de movimiento (con espacios reales, no pegada):
//   "25 Agosto  14 009951 *  WWW.FRAVEGA.COM-SANT-1      C.11/12        83.333,25"
//   "           15 296173 *  PORTSAID                    C.09/09        10.888,88"   (continúa el mismo mes)
//   "26 Mayo    28 533587 K  MESSAGEBIRD USA           USD      316,96         316,96"  (USD: 2 veces el monto)
//   "26 Junio   01 205064 E  CALLBELL                  EUR      452,33         528,19"  (moneda ≠ monto final)
// El PRIMER número de moneda extranjera es el monto original; el ÚLTIMO número de la línea es
// siempre el monto real en dólares. Sin código de moneda, el único número es en pesos.

const MESES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, set: 8, sep: 8, oct: 9, nov: 10, dic: 11,
};

function monthFromName(name) {
  if (!name) return undefined;
  const key = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().slice(0, 3);
  return MESES[key];
}

function isLegacyFormat(text) {
  return /SUPERCLUB PAQUETE BLACK/i.test(text);
}

const NOISE_LINE_RE = new RegExp(
  [
    '^AMERICAN\\s+EXPRESS',
    '^Santander R',
    '^RESUMEN DE CUENTA$',
    '^VISA$',
    '^Sucursal:',
    '^Grupo:$',
    '^Cuenta:$',
    '^FechaComprobante',
    '^EL PRESENTE',
    '^SALDO ACTUAL',
    '^PAGO MINIMO',
    '^CORDOBA\\s+CUIT',
    '^SUPERCLUB PAQUETE BLACK',
    '^Le recordamos',
    '^\\(PIN\\)',
    '^no tiene clave',
    '^IVA:\\s+CONSUMIDOR',
    '^CARRIZO',
    '^ARGUELLO NORTE',
    '^5022 CORDOBA',
    '^PROV CORDOBA',
    '^Cierre Ant\\.',
    '^Prox\\.Cierre',
    '^LIMITES:COMPRA',
    '^\\$?\\($\\)',
  ].join('|'),
  'i'
);

function findPeriodo(lines) {
  for (const line of lines) {
    const m = /CIERRE\s+(\d{2})\s+([A-Za-zÁÉÍÓÚÑ.]+)\s+(\d{2,4})VENCIMIENTO\s+(\d{2})\s+([A-Za-zÁÉÍÓÚÑ.]+)\s+(\d{2,4})/.exec(
      line
    );
    if (m) {
      const [, cDay, cMonth, cYear, dDay, dMonth, dYear] = m;
      const closing_date = new Date(Date.UTC(2000 + parseInt(cYear, 10), monthFromName(cMonth), parseInt(cDay, 10)));
      const due_date = new Date(Date.UTC(2000 + parseInt(dYear, 10), monthFromName(dMonth), parseInt(dDay, 10)));
      return { closing_date, due_date };
    }
  }
  return { closing_date: null, due_date: null };
}

// El mismo mes calendario puede contener el cierre de DOS ciclos consecutivos (ej. 02/Jul y
// 30/Jul son dos resúmenes distintos, no el mismo). Un cierre a principio de mes (día <= 15)
// factura mayormente el mes anterior; tarde en el mes (día > 15), el mes en curso.
function periodLabelFromClosing(closingDate) {
  if (!closingDate) return null;
  let year = closingDate.getUTCFullYear();
  let month = closingDate.getUTCMonth();
  if (closingDate.getUTCDate() <= 15) {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function findTotalAPagar(lines) {
  for (const line of lines) {
    const m = /^TNA\s+[\d.,]+\s+TEM\s+[\d.,]+\s+TNA\s+[\d.,]+\s+TEM\s+[\d.,]+\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s*$/.exec(
      line.trim()
    );
    if (m) return { total_ars: toNumber(m[1]), total_usd: toNumber(m[2]) };
  }
  return { total_ars: 0, total_usd: 0 };
}

const CARD_SECTION_END_RE = /^Tarjeta\s+\d+\s+Total Consumos de\s+(.+?)\s+(-?[\d.,]+)\s*\*?\s+(-?[\d.,]+)\s*\*?\s*$/i;

// Fecha + comprobante (6 dígitos) obligatorio + descripción + cuota opcional + moneda
// extranjera opcional + monto final. El año/mes son opcionales (fila de continuación).
// La marca de comercio (*, K, F, E...) sólo se toma como tal si viene seguida de 2+ espacios
// reales — si no, es la primera letra de la descripción (ej. "FarolDoze" sin marca) y no hay
// que comérsela. La moneda extranjera se restringe a códigos conocidos: cualquier sigla de
// 3 mayúsculas (ej. "SRL" dentro de una razón social) rompía esto tomándola como moneda.
const CURRENCY_CODES = 'USD|BRL|EUR|CLP|UYU|GBP|PYG|BOB';
const MOVEMENT_RE = new RegExp(
  '^(?:(\\d{2})\\s+([A-Za-zÁÉÍÓÚÑ.]+)\\s+)?(\\d{2})\\s+(\\d{6})\\s(?:[*A-Z]\\s{2,})?(.+?)' +
    '(?:\\s+C\\.(\\d+)\\/(\\d+))?' +
    `(?:\\s+(${CURRENCY_CODES})\\s+[\\d.,]+\\s+)?` +
    '\\s*(-?[\\d.,]+)\\s*$'
);

function parseMovementLine(line, lastYearMonth) {
  const m = MOVEMENT_RE.exec(line.trim());
  if (!m) return null;
  const [, yearStr, monthName, dayStr, , descRaw, cuotaActual, cuotaTotal, currency, montoStr] = m;
  const descripcion = descRaw.replace(/\s{2,}/g, ' ').trim();
  if (!descripcion) return null;

  let year = lastYearMonth.year;
  let month = lastYearMonth.month;
  if (yearStr && monthName) {
    year = 2000 + parseInt(yearStr, 10);
    month = monthFromName(monthName);
  }
  const fecha = month !== undefined && year ? new Date(Date.UTC(year, month, parseInt(dayStr, 10))) : null;

  const monto = toNumber(montoStr);
  return {
    fecha,
    descripcion,
    cuota_actual: cuotaActual ? parseInt(cuotaActual, 10) : null,
    cuota_total: cuotaTotal ? parseInt(cuotaTotal, 10) : null,
    monto_ars: currency ? 0 : monto,
    monto_usd: currency ? monto : 0,
    _year: year,
    _month: month,
  };
}

// Líneas de impuestos/intereses del pie del resumen: sin comprobante ni marca, solo
// descripción + monto final (a veces con un monto "base" intermedio que se descarta).
const TAX_LINE_RE = /^(?:\d{2}\s+[A-Za-zÁÉÍÓÚÑ.]+\s+)?\d{2}\s+(.+?)\s+(-?[\d.,]+)\s*$/;

function parseTaxLine(line) {
  const m = TAX_LINE_RE.exec(line.trim());
  if (!m) return null;
  const descripcion = m[1].replace(/\s{2,}/g, ' ').replace(/[\d.,]+$/, '').trim();
  if (!descripcion) return null;
  return { descripcion, monto_ars: toNumber(m[2]) };
}

function parseSantanderLegacyStatement(text) {
  const rawLines = text.split('\n');
  const lines = rawLines.filter((l) => l.trim() && !NOISE_LINE_RE.test(l.trim()));

  const { closing_date, due_date } = findPeriodo(rawLines);
  const { total_ars, total_usd } = findTotalAPagar(rawLines);

  const transactions = [];
  let buffer = [];
  let sawAnySection = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^Plan V:|^Express Plan/i.test(line)) break;

    const sectionEnd = CARD_SECTION_END_RE.exec(line);
    if (sectionEnd) {
      const cardholder = sectionEnd[1].trim();
      const isTitular = !sawAnySection;
      let lym = { year: closing_date ? closing_date.getUTCFullYear() : null, month: closing_date ? closing_date.getUTCMonth() : undefined };
      for (const bl of buffer) {
        const mov = parseMovementLine(bl, lym);
        if (mov) {
          lym = { year: mov._year, month: mov._month };
          transactions.push({
            fecha: mov.fecha,
            descripcion: mov.descripcion,
            cardholder,
            cuota_actual: mov.cuota_actual,
            cuota_total: mov.cuota_total,
            monto_ars: mov.monto_ars,
            monto_usd: mov.monto_usd,
            is_titular: isTitular,
          });
        }
      }
      buffer = [];
      sawAnySection = true;
      continue;
    }

    buffer.push(line);
  }

  // Lo que queda en el buffer tras la última tarjeta son las líneas de impuestos/intereses.
  for (const bl of buffer) {
    const tax = parseTaxLine(bl);
    if (tax) {
      transactions.push({
        fecha: closing_date,
        descripcion: tax.descripcion,
        cardholder: null,
        cuota_actual: null,
        cuota_total: null,
        monto_ars: tax.monto_ars,
        monto_usd: 0,
        is_titular: true,
        is_tax_line: true,
      });
    }
  }

  return {
    closing_date,
    due_date,
    total_ars,
    total_usd,
    transactions,
    period_label_override: periodLabelFromClosing(closing_date),
  };
}

module.exports = { parse: parseSantanderLegacyStatement, isLegacyFormat, periodLabelFromClosing };
