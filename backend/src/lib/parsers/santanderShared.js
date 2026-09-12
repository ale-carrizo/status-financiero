const { toNumber, parseDateDDMMYY } = require('./utils');

// Formato compartido por los resúmenes "Resumen Visa" y "Resumen American Express" de
// Santander Río. Extraído con pdf-parse (a diferencia de pdfplumber), cada "celda" de la
// tabla queda pegada sin espacios en una sola línea, ej:
//   "10/10/25Rouge arcos11 de 12001793$ 24.175,00"
//   "30/07/26Messagebird usa215329U$S 6,00"
//   "Openai *chatgpt subscr307704U$S 20,00"   (sin fecha: mismo día que la línea anterior)
// Validado contra a1f3c6fd... (Visa, cierre 27/08/2026) y 05f0e7c6... (Amex, cierre 27/08/2026).

// Comprobante: siempre exactamente 6 dígitos (+ letra opcional). Fijar el ancho es necesario
// para que el backtracking de "cuota_total" (dígitos ambiguos, ej. "12"+"001793" vs "120"+"01793")
// resuelva al corte correcto — con un rango de ancho variable el motor de regex se conforma
// con el primer split que matchea, que no es necesariamente el correcto.
// Año fijado a exactamente 2 dígitos (no \d{2,4}): con las celdas pegadas sin separador,
// un año "greedy" de hasta 4 dígitos se come dígitos del comprobante siguiente cuando la
// descripción arranca con números (ej. "05/03/26" + "9655 univero..." → probó leer "2696"
// como año, perdiendo el "96" real del nombre del comercio).
const MOVEMENT_RE = /^(\d{2}\/\d{2}\/\d{2})?(.*?)(?:(\d+)\s*de\s*(\d+))?(\d{6}[A-Za-z]?)(\$\s*-?[\d.,]+|U\$S\s*-?[\d.,]+)$/;
const TAX_LINE_RE = /^(\d{2}\/\d{2}\/\d{2})?(.*?)(\$\s*-?[\d.,]+)$/;
const DATE_ONLY_RE = /^\d{2}\/\d{2}\/\d{2,4}$/;

function parseMonto(str) {
  const isUsd = /^U\$S/i.test(str.trim());
  const num = toNumber(str.replace(/U\$S|\$/gi, ''));
  return { monto_ars: isUsd ? 0 : num, monto_usd: isUsd ? num : 0 };
}

// Algunos comercios (ej. "Parque azul srl" con una referencia de 15 ceros) hacen que su fila
// se corte en 2-3 líneas físicas del PDF por ancho de página. Una línea de movimiento completa
// siempre termina en un monto ("$ X" o "U$S X"); si no, se pega con la siguiente hasta que sí.
const COMPLETE_LINE_RE = /(\$|U\$S)\s*-?[\d.,]+\s*$/;

function joinWrappedLines(lines) {
  const out = [];
  let buffer = '';
  for (const line of lines) {
    buffer += line;
    if (COMPLETE_LINE_RE.test(line) || /^Fecha.*Descripci/i.test(line) || /^Copia fiel/i.test(line)) {
      out.push(buffer);
      buffer = '';
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

function extractTitularSections(lines) {
  const sections = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    const startMatch = /^Movimientos de (.+)$/i.exec(line);
    if (startMatch) {
      if (current) sections.push(current);
      current = { titular: startMatch[1].trim(), lines: [] };
      continue;
    }
    if (!current) continue;
    if (/^Subtotal de /i.test(line)) {
      sections.push(current);
      current = null;
      continue;
    }
    if (/^Impuestos, intereses y percepciones/i.test(line)) {
      if (current) sections.push(current);
      current = null;
      break;
    }
    current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections;
}

function parseMovementLine(line, fallbackYear) {
  if (!line) return null;
  if (/cr[eé]dito terminada en/i.test(line)) return null;
  if (/^Fecha.*Descripci/i.test(line)) return null;
  if (/^Copia fiel/i.test(line)) return null;

  const m = MOVEMENT_RE.exec(line);
  if (!m) return null;

  const [, fechaStr, descRaw, cuotaActualStr, cuotaTotalStr, , montoStr] = m;
  let descripcion = descRaw.trim();
  if (!descripcion) return null;

  let cuota_actual = cuotaActualStr ? parseInt(cuotaActualStr, 10) : null;
  const cuota_total = cuotaTotalStr ? parseInt(cuotaTotalStr, 10) : null;

  // Ambigüedad de origen: sin espacio entre celdas, un nombre de comercio que termina en
  // dígito (ej. "Inc sa 9") es indistinguible de "Inc sa" + cuota "9X de Y". El regex, al
  // preferir la descripción más corta, a veces absorbe ese dígito dentro de cuota_actual
  // (98 en vez de 8). Se detecta porque da un cuota_actual > cuota_total (imposible) y se
  // corrige moviendo el dígito de más de vuelta a la descripción.
  if (cuota_actual !== null && cuota_total !== null && cuota_actual > cuota_total) {
    const digits = String(cuota_actual);
    descripcion = `${descripcion} ${digits[0]}`.trim();
    cuota_actual = parseInt(digits.slice(1), 10);
  }

  return {
    fecha: fechaStr ? parseDateDDMMYY(fechaStr, fallbackYear) : null,
    descripcion,
    cuota_actual,
    cuota_total,
    ...parseMonto(montoStr),
  };
}

function parseTaxLine(line) {
  if (!line) return null;
  if (/^Fecha.*Descripci/i.test(line)) return null;
  if (/^Total a pagar/i.test(line)) return null;
  if (/^Copia fiel/i.test(line)) return null;

  const m = TAX_LINE_RE.exec(line);
  if (!m) return null;
  const [, , descRaw, montoStr] = m;
  const descripcion = descRaw.trim();
  if (!descripcion) return null;
  return { descripcion, ...parseMonto(montoStr) };
}

function parseTaxesSection(lines) {
  const raw = [];
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^Impuestos, intereses y percepciones/i.test(trimmed)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^Total a pagar/i.test(trimmed)) break;
    raw.push(trimmed);
  }
  const out = [];
  for (const line of joinWrappedLines(raw)) {
    const tax = parseTaxLine(line);
    if (tax) out.push(tax);
  }
  return out;
}

function findTotalAPagar(lines) {
  for (const raw of lines) {
    const line = raw.trim();
    const m = /^Total a pagar(\$\s*-?[\d.,]+)(U\$S\s*-?[\d.,]+)$/i.exec(line);
    if (m) {
      return { total_ars: toNumber(m[1].replace('$', '')), total_usd: toNumber(m[2].replace(/U\$S/i, '')) };
    }
  }
  return { total_ars: 0, total_usd: 0 };
}

function findPeriodo(lines) {
  let inSection = false;
  const dates = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^Per[ií]odo$/i.test(line)) { inSection = true; continue; }
    if (/^L[ií]mites$/i.test(line)) break;
    if (!inSection) continue;
    if (DATE_ONLY_RE.test(line)) dates.push(line);
  }
  return {
    closing_date: dates[2] ? parseDateDDMMYY(dates[2]) : null,
    due_date: dates[3] ? parseDateDDMMYY(dates[3]) : null,
  };
}

function parseSantanderStatement(text) {
  const lines = text.split('\n');
  const { closing_date, due_date } = findPeriodo(lines);
  const fallbackYear = closing_date ? closing_date.getUTCFullYear() : new Date().getFullYear();
  const { total_ars, total_usd } = findTotalAPagar(lines);

  const sections = extractTitularSections(lines);
  const transactions = [];

  sections.forEach((section, idx) => {
    let lastDate = null;
    for (const line of joinWrappedLines(section.lines)) {
      const mov = parseMovementLine(line, fallbackYear);
      if (mov) {
        if (mov.fecha) lastDate = mov.fecha;
        transactions.push({ ...mov, fecha: mov.fecha || lastDate, cardholder: section.titular, is_titular: idx === 0 });
      }
    }
  });

  for (const tax of parseTaxesSection(lines)) {
    transactions.push({
      fecha: closing_date,
      descripcion: tax.descripcion,
      cardholder: null,
      cuota_actual: null,
      cuota_total: null,
      monto_ars: tax.monto_ars,
      monto_usd: tax.monto_usd,
      is_titular: true,
      is_tax_line: true,
    });
  }

  return { closing_date, due_date, total_ars, total_usd, transactions };
}

module.exports = { parseSantanderStatement };
