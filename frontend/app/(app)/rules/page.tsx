import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';
import type { ClassificationRule, CardAccount } from '@/lib/types';
import { createRule } from './actions';
import RuleRowActions from './RuleRowActions';

const CATEGORIES = ['EMPRESA', 'PERSONAL', 'IMPUESTO', 'EXCLUIDO', 'SIN_CLASIFICAR'];

export default async function RulesPage() {
  const token = (await getToken())!;
  const [rules, cards]: [ClassificationRule[], CardAccount[]] = await Promise.all([
    api.getRules(token),
    api.getCards(token),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reglas de clasificación</h1>

      <form action={createRule} className="card p-5 mb-8 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div>
          <label className="block text-xs font-medium mb-1">Palabra clave</label>
          <input name="keyword" required className="input" placeholder="ej. messagebird" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Concepto</label>
          <input name="concept_label" required className="input" placeholder="ej. MessageBird" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Categoría</label>
          <select name="category" required className="input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Tarjeta (opcional)</label>
          <select name="card_account_id" className="input">
            <option value="">Todas</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Prioridad</label>
          <input name="priority" type="number" defaultValue={0} className="input" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full">Agregar regla</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Keyword</th>
              <th className="px-4 py-2">Concepto</th>
              <th className="px-4 py-2">Categoría</th>
              <th className="px-4 py-2">Tarjeta</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 ${!r.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 font-mono text-xs">{r.keyword}</td>
                <td className="px-4 py-2">{r.concept_label}</td>
                <td className="px-4 py-2">
                  <span className={`badge badge-${r.category.toLowerCase().replace('_', '-')}`}>{r.category}</span>
                </td>
                <td className="px-4 py-2 text-slate-500">{r.card_account?.label || 'Todas'}</td>
                <td className="px-4 py-2 text-slate-500">{r.active ? 'Activa' : 'Inactiva'}</td>
                <td className="px-4 py-2"><RuleRowActions id={r.id} active={r.active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
