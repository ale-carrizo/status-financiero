'use client';
import { useState } from 'react';
import type { ObligationGroup } from '@/lib/types';

const CREATE_VALUE = '__new__';

export default function TypeSelectWithCreate({ groups }: { groups: ObligationGroup[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <select
        name="type"
        required
        className="input"
        defaultValue={groups[0]?.key || CREATE_VALUE}
        onChange={(e) => setCreating(e.target.value === CREATE_VALUE)}
      >
        {groups.map((g) => (
          <option key={g.key} value={g.key}>{g.label}</option>
        ))}
        <option value={CREATE_VALUE}>+ Crear nuevo tipo…</option>
      </select>

      {creating && (
        <div className="mt-2 p-3 border border-dashed border-slate-300 rounded-lg space-y-2">
          <input
            name="new_type_label"
            required
            className="input"
            placeholder="Nombre del tipo nuevo, ej. Seguros"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name="new_type_is_income" value="true" />
            Es un ingreso (no un gasto)
          </label>
        </div>
      )}
    </div>
  );
}
