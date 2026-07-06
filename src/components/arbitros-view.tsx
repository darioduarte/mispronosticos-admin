'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  addArbitroAlias,
  createArbitro,
  fetchArbitro,
  fetchArbitroDisciplineHistory,
  fetchArbitroSuggest,
  fetchArbitros,
  fetchArbitrosUnlinked,
  patchArbitro,
  removeArbitroAlias,
} from '@/lib/api';
import type { ArbitroRow, ArbitroUnlinkedRow, RefereeHistoryMatch } from '@/lib/types';

type Tab = 'canonicos' | 'sin-vincular';

export function ArbitrosView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('sin-vincular');
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [createName, setCreateName] = useState('');
  const [createCountry, setCreateCountry] = useState('');

  const listQuery = useQuery({
    queryKey: ['arbitros', appliedQ],
    queryFn: () => fetchArbitros({ q: appliedQ || undefined, limit: 200 }),
    enabled: tab === 'canonicos',
  });

  const unlinkedQuery = useQuery({
    queryKey: ['arbitros-unlinked', appliedQ],
    queryFn: () => fetchArbitrosUnlinked({ q: appliedQ || undefined, limit: 80 }),
    enabled: tab === 'sin-vincular',
  });

  const detailQuery = useQuery({
    queryKey: ['arbitro-detail', detailId],
    queryFn: () => fetchArbitro(detailId!),
    enabled: Boolean(detailId),
  });

  const historyQuery = useQuery({
    queryKey: ['arbitro-history', detailId],
    queryFn: () => fetchArbitroDisciplineHistory(detailId!),
    enabled: Boolean(detailId),
  });

  const suggestQuery = useQuery({
    queryKey: ['arbitro-suggest', detailId, detailQuery.data?.referee?.canonicalName],
    queryFn: () => fetchArbitroSuggest(detailQuery.data!.referee!.canonicalName),
    enabled: Boolean(detailId && detailQuery.data?.referee?.canonicalName),
  });

  const canonicos = listQuery.data?.data ?? [];
  const unlinked = unlinkedQuery.data?.data ?? [];
  const referee = detailQuery.data?.referee;
  const historyMatches = historyQuery.data?.matches ?? [];
  const suggestions = suggestQuery.data?.suggestions ?? [];

  const linkedAliasSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of referee?.aliases ?? []) set.add(a.aliasRaw);
    return set;
  }, [referee?.aliases]);

  const filteredSuggestions = suggestions.filter((s) => !linkedAliasSet.has(s.name));

  function applySearch() {
    setAppliedQ(q.trim());
    setDetailId(null);
  }

  async function handleCreateFromUnlinked(row: ArbitroUnlinkedRow) {
    setBusy(true);
    setMsg('');
    try {
      const result = await createArbitro({
        canonicalName: row.name,
        initialAlias: row.name,
        aliasType: 'manual',
      });
      if (!result.success || !result.referee) {
        setMsg(result.error || 'No se pudo crear el árbitro');
        return;
      }
      setMsg(`Árbitro creado: ${result.referee.canonicalName}`);
      setDetailId(result.referee.id);
      setTab('canonicos');
      await queryClient.invalidateQueries({ queryKey: ['arbitros'] });
      await queryClient.invalidateQueries({ queryKey: ['arbitros-unlinked'] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateManual() {
    const name = createName.trim();
    if (!name) {
      setMsg('Nombre canónico requerido');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const result = await createArbitro({
        canonicalName: name,
        country: createCountry.trim() || undefined,
        initialAlias: name,
        aliasType: 'manual',
      });
      if (!result.success || !result.referee) {
        setMsg(result.error || 'No se pudo crear');
        return;
      }
      setCreateName('');
      setCreateCountry('');
      setDetailId(result.referee.id);
      setTab('canonicos');
      await queryClient.invalidateQueries({ queryKey: ['arbitros'] });
      await queryClient.invalidateQueries({ queryKey: ['arbitros-unlinked'] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAlias(aliasRaw: string) {
    if (!detailId || !aliasRaw.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await addArbitroAlias(detailId, { aliasRaw: aliasRaw.trim(), aliasType: 'manual' });
      if (!result.success) {
        setMsg(result.error || 'No se pudo agregar alias');
        return;
      }
      setNewAlias('');
      await queryClient.invalidateQueries({ queryKey: ['arbitro-detail', detailId] });
      await queryClient.invalidateQueries({ queryKey: ['arbitro-history', detailId] });
      await queryClient.invalidateQueries({ queryKey: ['arbitros-unlinked'] });
      await queryClient.invalidateQueries({ queryKey: ['arbitro-suggest', detailId] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAlias(aliasId: string) {
    if (!detailId) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await removeArbitroAlias(aliasId);
      if (!result.success) {
        setMsg(result.error || 'No se pudo eliminar alias');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['arbitro-detail', detailId] });
      await queryClient.invalidateQueries({ queryKey: ['arbitro-history', detailId] });
      await queryClient.invalidateQueries({ queryKey: ['arbitros-unlinked'] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCanonical() {
    if (!detailId || !referee) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await patchArbitro(detailId, {
        canonicalName: referee.canonicalName,
        country: referee.country,
        notes: referee.notes,
      });
      if (!result.success) {
        setMsg(result.error || 'No se pudo guardar');
        return;
      }
      setMsg('Datos guardados');
      await queryClient.invalidateQueries({ queryKey: ['arbitros'] });
      await queryClient.invalidateQueries({ queryKey: ['arbitro-detail', detailId] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Árbitros</h1>
        <p className="mt-1 text-sm text-slate-400">
          Vincula variantes de <code className="text-violet-300">fixturereferee</code> a un árbitro
          canónico. Los promedios disciplinarios unifican todos los alias vinculados.
        </p>
      </header>

      {msg ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {msg}
        </p>
      ) : null}

      <section className="mb-6 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Buscar</label>
            <input
              type="search"
              placeholder="Nombre de árbitro…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <button
            type="button"
            onClick={applySearch}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Buscar
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('sin-vincular')}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === 'sin-vincular' ? 'bg-indigo-600/30 text-indigo-200' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            Sin vincular
          </button>
          <button
            type="button"
            onClick={() => setTab('canonicos')}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === 'canonicos' ? 'bg-indigo-600/30 text-indigo-200' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            Canónicos
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-[#111827]">
          {tab === 'sin-vincular' ? (
            <>
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-medium text-slate-200">Nombres en Fixture sin alias</h2>
                <p className="text-xs text-slate-500">
                  {unlinkedQuery.isLoading ? 'Cargando…' : `${unlinked.length} variantes`}
                </p>
              </div>
              <div className="max-h-[32rem] overflow-y-auto divide-y divide-white/5">
                {unlinked.map((row) => (
                  <div key={row.name} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-200">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.fixtureCount} partidos</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCreateFromUnlinked(row)}
                      className="shrink-0 rounded-lg border border-indigo-500/40 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50"
                    >
                      Crear canónico
                    </button>
                  </div>
                ))}
                {!unlinkedQuery.isLoading && !unlinked.length ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">No hay nombres sin vincular</p>
                ) : null}
              </div>
              <div className="border-t border-white/10 p-4">
                <p className="mb-2 text-xs font-medium text-slate-400">Crear árbitro manual</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Nombre canónico"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm"
                  />
                  <input
                    value={createCountry}
                    onChange={(e) => setCreateCountry(e.target.value)}
                    placeholder="País (opcional)"
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm sm:w-36"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreateManual}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Crear
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-medium text-slate-200">Árbitros canónicos</h2>
                <p className="text-xs text-slate-500">
                  {listQuery.isLoading ? 'Cargando…' : `${canonicos.length} registros`}
                </p>
              </div>
              <div className="max-h-[36rem] overflow-y-auto divide-y divide-white/5">
                {canonicos.map((row: ArbitroRow) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setDetailId(row.id)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-white/5 ${
                      detailId === row.id ? 'bg-indigo-600/10' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-200">{row.canonicalName}</p>
                    <p className="text-xs text-slate-500">
                      {row.aliasCount ?? row.aliases?.length ?? 0} alias
                      {row.country ? ` · ${row.country}` : ''}
                    </p>
                  </button>
                ))}
                {!listQuery.isLoading && !canonicos.length ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">Sin árbitros canónicos aún</p>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
          {!detailId || !referee ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Selecciona un árbitro canónico para ver alias e historial unificado
            </p>
          ) : (
            <>
              <h2 className="text-lg font-medium text-white">{referee.canonicalName}</h2>
              {historyQuery.data?.summaryLabel ? (
                <p className="mt-1 text-xs text-emerald-300/90">{historyQuery.data.summaryLabel}</p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500">Nombre canónico</label>
                  <input
                    value={referee.canonicalName}
                    onChange={(e) =>
                      queryClient.setQueryData(['arbitro-detail', detailId], (old: unknown) => {
                        const prev = old as { referee?: ArbitroRow };
                        if (!prev?.referee) return old;
                        return { ...prev, referee: { ...prev.referee, canonicalName: e.target.value } };
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">País</label>
                  <input
                    value={referee.country || ''}
                    onChange={(e) =>
                      queryClient.setQueryData(['arbitro-detail', detailId], (old: unknown) => {
                        const prev = old as { referee?: ArbitroRow };
                        if (!prev?.referee) return old;
                        return { ...prev, referee: { ...prev.referee, country: e.target.value } };
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveCanonical}
                className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                Guardar datos
              </button>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-300">Alias vinculados</h3>
                <ul className="mt-2 space-y-2">
                  {referee.aliases.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    >
                      <div>
                        <span className="text-sm text-slate-200">{a.aliasRaw}</span>
                        <span className="ml-2 text-xs text-slate-500">{a.aliasType}</span>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemoveAlias(a.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    placeholder="Nuevo alias (texto exacto de BD)"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || !newAlias.trim()}
                    onClick={() => handleAddAlias(newAlias)}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {filteredSuggestions.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-slate-300">Sugerencias (mismo apellido)</h3>
                  <ul className="mt-2 space-y-1">
                    {filteredSuggestions.map((s) => (
                      <li key={s.name} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">
                          {s.name}{' '}
                          <span className="text-xs text-slate-500">
                            ({s.fixtureCount} PT · {s.confidence})
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleAddAlias(s.name)}
                          className="text-xs text-indigo-300 hover:underline disabled:opacity-50"
                        >
                          Vincular
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-300">
                  Muestra unificada ({historyMatches.length} partidos)
                </h3>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#111827] text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Fecha</th>
                        <th className="px-2 py-2">Partido</th>
                        <th className="px-2 py-2">Alias</th>
                        <th className="px-2 py-2">Am/Rj/Ft</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyMatches.map((m: RefereeHistoryMatch) => (
                        <tr key={String(m.fixtureId)} className="border-t border-white/5">
                          <td className="px-2 py-2 text-slate-400">{m.dateDisplay || '—'}</td>
                          <td className="px-2 py-2 text-slate-300">
                            {m.homeTeam} vs {m.awayTeam}
                            {m.score ? ` (${m.score})` : ''}
                          </td>
                          <td className="px-2 py-2 text-violet-300">{m.aliasUsed || '—'}</td>
                          <td className="px-2 py-2 text-slate-400">
                            {m.yellowTotal ?? '—'}/{m.redTotal ?? '—'}/{m.foulsTotal ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!historyQuery.isLoading && !historyMatches.length ? (
                    <p className="px-3 py-6 text-center text-slate-500">Sin historial previo</p>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
