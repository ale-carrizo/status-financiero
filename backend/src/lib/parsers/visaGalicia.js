const { toNumber } = require('./utils');

// Formato "Resumen de tarjeta de credito VISA" (Banco Galicia, tarjeta propia — distinta de la
// Visa Santander 2773). Es la tarjeta de consumo personal (4902/4910), casi todo "MERPAGO*..."
// en cuotas. Validado contra RESUMEN_VISA10_9_2026pdf.pdf (cierre 10/09/2026, sesión 12/09/2026).
//
// Comparte con Mastercard Galicia el mismo header (fechas de período repartidas en 2-3 líneas,
// total a pagar como 2 líneas sueltas antes de las fechas). El detalle de consumo es más
// irregular: algunas filas vienen en una sola línea pegada ("19-06-26*MERPAGO*X 03/03986494
// 9.666,66"), otras partidas en 2-3 líneas físicas (fecha+desc+cuota / comprobante / monto,
// separadas por saltos de página). Se homogeneizan reconstruyendo cada fila como el texto
// acumulado hasta que termina en un monto, luego de filtrar el ruido de encabezado/pie de
// página que se repite en cada hoja del PDF.

const DATE_TOKEN_RE = /\d{2}-[A-Za-z]{3}-\d{2}/g;
const BARE_AMOUNT_RE = /^-?[\d.]+,\d{2}$/;
const TRAILING_AMOUNT_RE = /-?[\d.]+,\d{2}\s*$/;

const NOISE_LINE_RE = new RegExp(
  [
    '^Resumen N',
    '^Tarjeta Cr[eé]dito',
    '^JOSE ALEJANDRO CARRIZO',
    '^\\s*Monotributo',
    '^BARRIO',
    '^Resumen de tarjeta de credito',
    '^\\d{14,}H$',
    '^P[aá]gina\\s*\\d',
    '^FECHA.*CUOTA.*COMPROBANTE',
    '^FECHA.*DESCRIPCI',
    '^DETALLE DEL CONSUMO',
    '^\\s*$',
  ].join('|'),
  'i'
);

function parseDateNumeric(str) {
  if (!str) return null;
  const m = /(\d{2})-(\d{2})-(\d{2})/.exec(str);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = 2000 + parseInt(m[3], 10);
  return new Date(Date.UTC(year, month, day));
}

const MESES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};
function parseDateDDMonYY(str) {
  const m = /(\d{2})-([A-Za-z]{3})-(\d{2})/.exec(str);
  if (!m) return null;
  const month = MESES[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Date.UTC(2000 + parseInt(m[3], 10), month, parseInt(m[1], 10)));
}

// Total a pagar: mismas 2 líneas "sueltas" (solo número) antes de la primera fecha del
// período, igual que en el resumen de Mastercard Galicia (comparten template de banco).
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
    const matches = raw.match(DATE_TOKEN_RE);
    if (matches) dates.push(...matches);
    if (dates.length >= 6) break;
  }
  return {
    closing_date: dates[2] ? parseDateDDMonYY(dates[2]) : null,
    due_date: dates[3] ? parseDateDDMonYY(dates[3]) : null,
  };
}

// Reconstruye filas completas: descarta ruido de encabezado/pie de página repetido en cada
// hoja, y pega líneas consecutivas hasta que el acumulado termina en un monto ("X,XX").
function reconstructRows(lines) {
  const rows = [];
  let buffer = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (NOISE_LINE_RE.test(line)) continue;
    buffer += (buffer ? ' ' : '') + line;
    if (TRAILING_AMOUNT_RE.test(line)) {
      rows.push(buffer);
      buffer = '';
    }
  }
  return rows;
}

const CARD_SECTION_END_RE = /^TARJETA\s+(\d{4})\s+Total Consumos de\s+(.+?)\s+(-?[\d.,]+,\d{2})(-?[\d.,]+,\d{2})?$/i;
const MOVEMENT_RE = /^(\d{2}-\d{2}-\d{2})?\s*[*K]?\s*(.*?)(?:\s(\d{2})\/(\d{2}))?\s*(\d{6})\s*(-?[\d.,]+)\s*$/;
const TAX_LINE_RE = /^(\d{2}-\d{2}-\d{2})?\s*(.*?)\s*\$?\s*(-?[\d.,]+,\d{2})\s*$/;

function parseMovementRow(row) {
  const m = MOVEMENT_RE.exec(row.replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const [, fechaStr, descRaw, cuotaActual, cuotaTotal, , montoStr] = m;
  const descripcion = descRaw.trim();
  if (!descripcion) return null;
  return {
    fecha: fechaStr ? parseDateNumeric(fechaStr) : null,
    descripcion,
    cuota_actual: cuotaActual ? parseInt(cuotaActual, 10) : null,
    cuota_total: cuotaTotal ? parseInt(cuotaTotal, 10) : null,
    monto_ars: toNumber(montoStr),
    monto_usd: 0,
  };
}

function parseVisaGaliciaStatement(text) {
  const lines = text.split('\n');
  const { closing_date, due_date } = findPeriodo(lines);
  const { total_ars, total_usd } = findTotalAPagar(lines);

  const rows = reconstructRows(lines);
  const transactions = [];

  // Cada tarjeta cierra su propia sección con "TARJETA #### Total Consumos de NOMBRE" DESPUÉS
  // de sus movimientos (al revés que en Santander) — se bufferean las filas y se les asigna
  // el titular recién ahí. Lo que quede en el buffer tras la ÚLTIMA sección (antes de "TOTAL A
  // PAGAR") son las líneas sueltas de impuestos/comisiones, sin titular.
  let buffer = [];
  let sawAnySection = false;
  let lastDate = closing_date;

  for (const row of rows) {
    if (/^TOTAL A PAGAR/i.test(row)) break;

    const sectionEnd = CARD_SECTION_END_RE.exec(row);
    if (sectionEnd) {
      const cardholder = sectionEnd[2].trim();
      const isTitular = !sawAnySection;
      for (const r of buffer) {
        const mov = parseMovementRow(r);
        if (mov) {
          if (mov.fecha) lastDate = mov.fecha;
          transactions.push({ ...mov, fecha: mov.fecha || lastDate, cardholder, is_titular: isTitular });
        }
      }
      buffer = [];
      sawAnySection = true;
      continue;
    }

    buffer.push(row);
  }

  for (const row of buffer) {
    const tax = TAX_LINE_RE.exec(row);
    if (!tax) continue;
    const [, , descRaw, montoStr] = tax;
    const descripcion = descRaw.trim();
    if (!descripcion) continue;
    transactions.push({
      fecha: closing_date,
      descripcion,
      cardholder: null,
      cuota_actual: null,
      cuota_total: null,
      monto_ars: toNumber(montoStr),
      monto_usd: 0,
      is_tax_line: true,
    });
  }

  return { closing_date, due_date, total_ars, total_usd, transactions };
}

module.exports = { parse: parseVisaGaliciaStatement };
