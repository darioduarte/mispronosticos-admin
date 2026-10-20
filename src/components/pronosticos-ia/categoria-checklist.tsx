'use client';

import { useState } from 'react';
import { formatCategoriaLabel, selectCategoriasHastaPuesto } from '@/lib/pronosticos-ia-stats';

type Props = {
  options: string[];
  /** `null` = todas seleccionadas; `[]` = ninguna; lista = selección parcial. */
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
  /** Orden del ranking por categoría (mejor primero). */
  ranked?: string[];
};

export function CategoriaChecklist({ options, selected, onChange, ranked }: Props) {
  const [puesto, setPuesto] = useState('10');
  if (options.length === 0) return null;

  const allSelected = selected === null || selected.length === options.length;
  const noneSelected = selected !== null && selected.length === 0;
  const selectedSet = selected === null ? new Set(options) : new Set(selected);
  const rankOf = new Map((ranked ?? []).map((cat, index) => [cat, index + 1]));
  const ordered = [...options].sort((a, b) => {
    const ra = rankOf.get(a) ?? Number.POSITIVE_INFINITY;
    const rb = rankOf.get(b) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, 'es');
  });

  function toggle(cat: string) {
    const next = new Set(selectedSet);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    if (next.size === options.length) onChange(null);
    else onChange([...next].sort((a, b) => a.localeCompare(b, 'es')));
  }

  function applyPuesto() {
    if (!ranked || ranked.length === 0) return;
    const inOptions = selectCategoriasHastaPuesto(ranked, Number(puesto)).filter((cat) =>
      options.includes(cat),
    );
    if (inOptions.length === 0) return;
    if (inOptions.length === options.length) onChange(null);
    else onChange(inOptions);
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
        <div className="flex flex-wrap items-center gap-1.5">
          {ranked && ranked.length > 0 && (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                applyPuesto();
              }}
            >
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                Hasta el puesto
                <input
                  type="number"
                  min={1}
                  max={ranked.length}
                  value={puesto}
                  onChange={(e) => setPuesto(e.target.value)}
                  className="w-14 rounded border border-white/10 bg-[#151b24] px-2 py-1 text-xs text-slate-200"
                />
              </label>
              <button
                type="submit"
                className="rounded border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-200 hover:bg-indigo-500/20"
              >
                Señalar
              </button>
            </form>
          )}
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
      {ranked && ranked.length > 0 && (
        <p className="mb-2 text-[11px] text-slate-500">
          El puesto sigue el ranking por categoría del rango (mismo orden que los indicadores), sin
          contar el filtro de tipo que ya tengas marcado.
        </p>
      )}
      <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((cat) => {
          const checked = selectedSet.has(cat);
          const id = `cat-check-${cat}`;
          const rank = rankOf.get(cat);
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
              {rank != null && (
                <span className="w-5 shrink-0 text-[10px] tabular-nums text-slate-500">{rank}</span>
              )}
              <span className="truncate">{formatCategoriaLabel(cat)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
