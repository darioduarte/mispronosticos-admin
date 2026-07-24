'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchRefereeFromApi,
  fetchRefereeFromFlb,
  fetchRefereeHistory,
  saveFixtureReferee,
  searchReferees,
  type RefereeIdentityMatch,
  type RefereeIdentitySuggestion,
} from '@/lib/api';
import type { RefereeSearchItem } from '@/lib/types';
import { RefereeHistorySamplePanel } from '@/components/referee-history-sample-panel';

type Props = {
  fixtureId: number;
  matchLabel: string;
  currentReferee: string;
  onClose: () => void;
  onSaved: () => void;
};

type Tab = 'assign' | 'review';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

function identityLabel(identity?: RefereeIdentityMatch | null) {
  if (!identity) return '';
  if (identity.autoLinked && identity.canonicalName) {
    return `Vinculado auto → ${identity.canonicalName}`;
  }
  if (identity.alreadyLinked && identity.canonicalName) {
    return `Ya vinculado → ${identity.canonicalName}`;
  }
  if (identity.linked && identity.canonicalName) {
    return `Vinculado → ${identity.canonicalName}`;
  }
  const n = identity.suggestions?.length ?? 0;
  if (n > 0) return `${n} candidato(s) canónico(s)`;
  return 'Sin match canónico';
}

export function RefereeModal({
  fixtureId,
  matchLabel,
  currentReferee,
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<Tab>('assign');
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [customName, setCustomName] = useState('');
  const [flbCountry, setFlbCountry] = useState<string | null>(null);
  const [identity, setIdentity] = useState<RefereeIdentityMatch | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err' | ''>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const searchQuery = useQuery({
    queryKey: ['referee-search', fixtureId, debouncedQ],
    queryFn: () => searchReferees({ q: debouncedQ, fixtureId, limit: 15 }),
    enabled: debouncedQ.length >= MIN_CHARS,
  });

  const reviewName = selectedName || customName.trim() || currentReferee;
  const historyQuery = useQuery({
    queryKey: ['referee-history', fixtureId, reviewName],
    queryFn: () => fetchRefereeHistory(reviewName, fixtureId),
    enabled: tab === 'review' && reviewName.length > 0,
  });

  const showMsg = useCallback((text: string, type: 'ok' | 'err') => {
    setMsg(text);
    setMsgType(type);
  }, []);

  function applyIdentity(next: RefereeIdentityMatch | null | undefined, incomingName: string) {
    setIdentity(next || null);
    const toShow = next?.nameToSave || next?.canonicalName || incomingName;
    if (toShow) {
      setCustomName(toShow);
      setSelectedName('');
    }
  }

  async function handleFromApi() {
    setBusy(true);
    try {
      const data = await fetchRefereeFromApi(fixtureId);
      if (data.preferredReferee) {
        setFlbCountry(data.preferredSource === 'flb' ? data.flbCountry || null : null);
        applyIdentity(data.identity, data.preferredReferee);
        const src =
          data.preferredSource === 'flb'
            ? 'FLB'
            : data.preferredSource === 'api-football'
              ? 'API-Football'
              : 'API';
        const extra =
          data.preferredSource === 'flb' && data.flbCountry
            ? ` (${data.flbCountry})`
            : '';
        const idTxt = identityLabel(data.identity);
        showMsg(`${src}: ${data.preferredReferee}${extra}${idTxt ? ` · ${idTxt}` : ''}`, 'ok');
      } else {
        setIdentity(null);
        const bits = [
          data.apiFootballError ? `API-Football: ${data.apiFootballError}` : null,
          data.flbError ? `FLB: ${data.flbError}` : null,
        ].filter(Boolean);
        showMsg(
          bits.length
            ? `Sin árbitro. ${bits.join(' · ')}`
            : 'Ni API-Football ni FLB devolvieron árbitro',
          'err',
        );
      }
    } catch (e) {
      showMsg((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleFromFlb(apply = false, forceRefereeId?: string) {
    setBusy(true);
    try {
      const data = await fetchRefereeFromFlb(fixtureId, apply, forceRefereeId);
      if (!data.success || !data.refereeFromFlb) {
        showMsg(data.error || 'FLB no devolvió árbitro', 'err');
        return;
      }
      setFlbCountry(data.country || null);
      applyIdentity(data.identity, data.fixturereferee || data.refereeFromFlb);
      const country = data.country ? ` (${data.country})` : '';
      const idTxt = identityLabel(data.identity);
      if (apply) {
        const saved = data.fixturereferee || data.refereeFromFlb;
        showMsg(`FLB guardado: ${saved}${country}${idTxt ? ` · ${idTxt}` : ''}`, 'ok');
        onSaved();
      } else {
        showMsg(`FLB: ${data.refereeFromFlb}${country}${idTxt ? ` · ${idTxt}` : ''}`, 'ok');
      }
    } catch (e) {
      showMsg((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleLinkSuggestion(s: RefereeIdentitySuggestion) {
    const refereeId = s.refereeId;
    const name = (customName.trim() || identity?.incomingName || '').trim();
    if (!refereeId || !name) {
      showMsg('No hay nombre FLB/API para vincular', 'err');
      return;
    }
    setBusy(true);
    try {
      const result = await saveFixtureReferee(fixtureId, name, {
        forceRefereeId: refereeId,
        country: flbCountry,
      });
      if (!result.success) {
        showMsg(result.error || 'No se pudo vincular', 'err');
        return;
      }
      setIdentity(result.identity || null);
      if (result.fixturereferee) setCustomName(result.fixturereferee);
      showMsg(
        `Vinculado a ${(result.identity?.canonicalName || s.canonicalName || s.name) ?? 'canónico'}`,
        'ok',
      );
      onSaved();
    } catch (e) {
      showMsg((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const name = (customName.trim() || selectedName).trim();
    if (!name) {
      showMsg('Escribe o selecciona un árbitro', 'err');
      return;
    }
    setBusy(true);
    try {
      const result = await saveFixtureReferee(fixtureId, name, { country: flbCountry });
      setIdentity(result.identity || null);
      if (result.fixturereferee) setCustomName(result.fixturereferee);
      const idTxt = identityLabel(result.identity);
      showMsg(`Árbitro guardado${idTxt ? ` · ${idTxt}` : ''}`, 'ok');
      onSaved();
    } catch (e) {
      showMsg((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  function pickReferee(item: RefereeSearchItem) {
    setSelectedName(item.name);
    setCustomName('');
    setIdentity(null);
    showMsg(`Seleccionado: ${item.name}`, 'ok');
  }

  const suggestions = identity?.suggestions?.filter((s) => s.refereeId || s.canonicalName) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Árbitro del partido</h2>
              <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <TabBtn active={tab === 'assign'} onClick={() => setTab('assign')}>
              Asignar
            </TabBtn>
            <TabBtn active={tab === 'review'} onClick={() => setTab('review')}>
              Revisar muestra
            </TabBtn>
          </div>
        </div>

        <div className="max-h-[calc(92vh-160px)] overflow-y-auto p-5">
          {tab === 'assign' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                En BD:{' '}
                <strong className={currentReferee ? 'text-white' : 'text-red-300'}>
                  {currentReferee || 'Sin asignar'}
                </strong>
              </p>

              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar árbitro (mín. 3 letras)…"
                  className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleFromApi}
                  disabled={busy}
                  className="rounded-lg border border-teal-500/40 px-3 py-2 text-sm text-teal-300 hover:bg-teal-500/10 disabled:opacity-50"
                  title="API-Football y, si falta, FLB"
                >
                  Traer APIs
                </button>
                <button
                  type="button"
                  onClick={() => handleFromFlb(false)}
                  disabled={busy}
                  className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                  title="Solo FLB /football-get-match-referee"
                >
                  Solo FLB
                </button>
                <button
                  type="button"
                  onClick={() => handleFromFlb(true)}
                  disabled={busy}
                  className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                  title="Consultar FLB, vincular canónico si hay match y guardar"
                >
                  FLB + guardar
                </button>
              </div>

              {identity && (
                <div className="rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-sm">
                  <p className="text-slate-300">
                    Identidad:{' '}
                    <strong className="text-white">
                      {identity.canonicalName || identity.incomingName || '—'}
                    </strong>
                    {identity.confidence ? (
                      <span className="ml-2 text-xs text-slate-500">({identity.confidence})</span>
                    ) : null}
                  </p>
                  {identity.matchedReason ? (
                    <p className="mt-1 text-xs text-slate-500">{identity.matchedReason}</p>
                  ) : null}
                  {identity.linked ? (
                    <p className="mt-1 text-xs text-emerald-400">
                      Alias unificado: historial/promedios usan todos los nombres vinculados.
                    </p>
                  ) : suggestions.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-amber-300">
                        Posibles canónicos — vincula para traer historial disciplinario:
                      </p>
                      {suggestions.map((s) => {
                        const label = s.canonicalName || s.name || '—';
                        const key = `${s.refereeId || label}-${s.score ?? 0}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={busy || !s.refereeId}
                            onClick={() => handleLinkSuggestion(s)}
                            className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left hover:bg-indigo-500/10 disabled:opacity-50"
                          >
                            <span>
                              <span className="font-medium text-slate-200">{label}</span>
                              {s.country ? (
                                <span className="ml-2 text-xs text-slate-500">{s.country}</span>
                              ) : null}
                              {s.reason ? (
                                <span className="mt-0.5 block text-xs text-slate-500">{s.reason}</span>
                              ) : null}
                            </span>
                            <span className="text-xs text-indigo-300">
                              Vincular{s.confidence ? ` (${s.confidence})` : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Sin canónico claro. Créalo o vincúlalo en Árbitros del admin.
                    </p>
                  )}
                </div>
              )}

              {debouncedQ.length > 0 && debouncedQ.length < MIN_CHARS && (
                <p className="text-xs text-slate-500">Escribe al menos {MIN_CHARS} caracteres.</p>
              )}

              {searchQuery.isLoading && debouncedQ.length >= MIN_CHARS && (
                <p className="text-xs text-slate-500">Buscando…</p>
              )}

              {searchQuery.data?.referees && searchQuery.data.referees.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-[#0b0f14] p-2">
                  {searchQuery.data.referees.map((r) => (
                    <li key={r.name}>
                      <button
                        type="button"
                        onClick={() => pickReferee(r)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-indigo-500/10 ${
                          selectedName === r.name
                            ? 'bg-indigo-600/20 text-indigo-200'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="font-medium">{r.name}</span>
                        {r.disciplineLabel && (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {r.disciplineLabel}
                            {r.lastMatchDateDisplay && ` · último: ${r.lastMatchDateDisplay}`}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {searchQuery.data?.referees?.length === 0 &&
                debouncedQ.length >= MIN_CHARS &&
                !searchQuery.isLoading && (
                  <p className="text-xs text-slate-500">Sin coincidencias en BD.</p>
                )}

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    setSelectedName('');
                  }}
                  placeholder="Nombre manual (si no está en la lista)"
                  className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Guardar en fixture
                </button>
              </div>

              {msg && (
                <p className={`text-sm ${msgType === 'ok' ? 'text-emerald-400' : 'text-red-300'}`}>
                  {msg}
                </p>
              )}

              <p className="text-xs text-slate-600">
                Al guardar, si hay match fuerte con un canónico se agrega el nombre FLB/API como
                alias y se usa el canónico en el fixture (así salen promedios e historial).
              </p>
            </div>
          )}

          {tab === 'review' && (
            <div className="space-y-3">
              {!reviewName ? (
                <p className="text-sm text-slate-500">
                  Selecciona o escribe un árbitro en la pestaña Asignar.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-300">
                    Muestra para: <strong className="text-white">{reviewName}</strong>
                  </p>
                  <RefereeHistorySamplePanel
                    matches={historyQuery.data?.matches ?? []}
                    summaryLabel={historyQuery.data?.summaryLabel}
                    isLoading={historyQuery.isLoading}
                    invalidateQueryKeys={[['referee-history', fixtureId, reviewName]]}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
        active
          ? 'bg-indigo-600 text-white'
          : 'border border-white/10 text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}
