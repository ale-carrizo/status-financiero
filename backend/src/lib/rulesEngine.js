// Aplica las ClassificationRule (cargadas de la DB) sobre las transacciones recién parseadas
// de un resumen. Reglas ordenadas por priority desc; la primera que matchea gana. Una regla
// matchea si TODO lo que tiene seteado coincide:
//  - keyword (substring, case-insensitive) contra la descripción — si está vacío, matchea
//    cualquier descripción (permite reglas tipo "todo lo de Jesica en esta tarjeta es EXCLUIDO"
//    sin depender de ninguna palabra clave).
//  - card_account_id: solo aplica cuando el statement es de esa tarjeta.
//  - cardholder: solo aplica cuando el titular de la transacción coincide exacto
//    (case-insensitive) — útil para adicionales que pagan sus propios consumos y no deben
//    heredar la clasificación del titular principal.
//
// Si ninguna regla matchea, la transacción cae en PERSONAL por default — así no hay que
// reclasificar a mano decenas de líneas de supermercado/combustible cada mes. Las reglas que
// SÍ matchean pueden asignar explícitamente SIN_CLASIFICAR (ej. "anthropic": queda pendiente
// decidir si es gasto de empresa) para forzar revisión manual en casos puntuales.

function applyRules(transaction, rules, cardAccountId) {
  const cardholder = (transaction.cardholder || '').trim().toLowerCase();
  const desc = (transaction.descripcion || '').toLowerCase();

  const applicable = rules
    .filter(
      (r) =>
        r.active &&
        (!r.card_account_id || r.card_account_id === cardAccountId) &&
        (!r.cardholder || r.cardholder.trim().toLowerCase() === cardholder) &&
        (!r.keyword || desc.includes(r.keyword.toLowerCase()))
    )
    .sort((a, b) => b.priority - a.priority);

  const rule = applicable[0];
  if (rule) {
    return {
      category: rule.category,
      concept_label: rule.concept_label,
      matched_rule_id: rule.id,
    };
  }

  return { category: 'PERSONAL', concept_label: null, matched_rule_id: null };
}

function classifyTransactions(transactions, rules, cardAccountId) {
  return transactions.map((t) => ({ ...t, ...applyRules(t, rules, cardAccountId) }));
}

module.exports = { applyRules, classifyTransactions };
