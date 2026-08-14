'use client';

import { formatCategoriaLabel } from '@/lib/pronosticos-ia-stats';

type Props = {
  options: string[];
  /** `null` = todas seleccionadas; `[]` = ninguna; lista = selección parcial. */
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
};

export function CategoriaChecklist({ options, selected, onChange }: Props) {
  if (options.length === 0) return null;

  const allSelected = selected === null || selected.length === options.length;
  const noneSelected = selected !== null && selected.length === 0;
  const selectedSet =
    selected === null ? new Set(options) : new Set(selected);

  function toggle(cat: string) {
    const next = new Set(selectedSet);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    if (next.size === options.length) onChange(null);
    else onChange([...next].sort((a, b) => a.localeCompare(b, 'es')));
  }

  const summary = allSelected
    ? 'Todas'
    : noneSelected
      ? 'Ninguna'
      : `${selected!.length} de ${options.length}`;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f14] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-300">Tipo de apuesta</p>
          <p className="text-[11px] text-slate-500">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={allSelected}
            className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-40"
          >
            Señalar todas
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={noneSelected}
            className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-40"
          >
            Desmarcar todas
          </button>
        </div>
      </div>
      <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {options.map((cat) => {
          const checked = selectedSet.has(cat);
          const id = `cat-check-${cat}`;
          return (
            <label
              key={cat}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-white/5 ${
                checked ? 'text-slate-200' : 'text-slate-500'
              }`}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(cat)}
                className="rounded border-white/20 bg-[#151b24] text-indigo-500 focus:ring-indigo-500/40"
              />
              <span className="truncate">{formatCategoriaLabel(cat)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
