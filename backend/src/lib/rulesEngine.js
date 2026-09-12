// Aplica las ClassificationRule (cargadas de la DB) sobre las transacciones recién parseadas
// de un resumen. Reglas ordenadas por priority desc; la primera que matchea por keyword
// (substring, case-insensitive) contra la descripción gana. Si la regla tiene card_account_id
// seteado, solo aplica cuando el statement es de esa tarjeta.
//
// Si ninguna regla matchea, la transacción cae en PERSONAL por default — así no hay que
// reclasificar a mano decenas de líneas de supermercado/combustible cada mes. Las reglas que
// SÍ matchean pueden asignar explícitamente SIN_CLASIFICAR (ej. "anthropic": queda pendiente
// decidir si es gasto de empresa) para forzar revisión manual en casos puntuales.

function applyRules(transaction, rules, cardAccountId) {
  const applicable = rules
    .filter((r) => r.active && (!r.card_account_id || r.card_account_id === cardAccountId))
    .sort((a, b) => b.priority - a.priority);

  const desc = (transaction.descripcion || '').toLowerCase();

  for (const rule of applicable) {
    if (desc.includes(rule.keyword.toLowerCase())) {
      return {
        category: rule.category,
        concept_label: rule.concept_label,
        matched_rule_id: rule.id,
      };
    }
  }

  return { category: 'PERSONAL', concept_label: null, matched_rule_id: null };
}

function classifyTransactions(transactions, rules, cardAccountId) {
  return transactions.map((t) => ({ ...t, ...applyRules(t, rules, cardAccountId) }));
}

module.exports = { applyRules, classifyTransactions };
