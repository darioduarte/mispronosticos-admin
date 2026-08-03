'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import { PartidoStatsModal } from '@/components/partidos/stats-modal';
import { PromediosModal } from '@/components/partidos/promedios-modal';
import { EstadisticasEstimadasModal } from '@/components/partidos/estadisticas-estimadas-modal';
import {
  PromediosRangeProgressModal,
  type PromediosRangeProgressState,
} from '@/components/partidos/promedios-range-progress';
import {
  PromediosSampleSyncProgressModal,
  type PromediosSampleSyncProgressState,
} from '@/components/partidos/promedios-sample-sync-progress';
import {
  PreMatchRangeProgressModal,
  type PreMatchRangeProgressState,
} from '@/components/partidos/pre-match-range-progress';
import { RefereeModal } from '@/components/partidos/referee-modal';
import {
  SyncRangeProgressModal,
  type SyncRangeProgressState,
} from '@/components/partidos/sync-range-progress';
import { PreMatchAnalysisModal } from '@/components/partidos/pre-match-analysis-modal';
import { LiveOddsModal } from '@/components/pronosticos-ia/live-odds-modal';
import { PromptModal, type PromptKind } from '@/components/pronosticos-ia/prompt-modal';
import {
  appendToBreakdown,
  classifySyncResult,
  emptySourceBreakdown,
} from '@/lib/sync-stats-source';
import { formatCaughtError, toastError, toastSuccess, toastWarning } from '@/lib/admin-toast';
import {
  fetchPartidos,
  fetchPreMatchPlan,
  fetchPromediosRecalcPlan,
  fetchPromediosSampleSyncPlan,
  fetchSyncStatsPlan,
  recalculatePartidoPromedios,
  repairPartidosReferees,
  syncPartidoStats,
  syncPeriodSnapshotTables,
  triggerPreMatchAnalysisManual,
} from '@/lib/api';
import {
  DEFAULT_PARTIDOS_FILTERS,
  filterPartidosRows,
  sortPartidosRows,
  type PartidosClientFilters,
  type PartidosSortMode,
} from '@/lib/partidos-filters';
import type { PartidoRow } from '@/lib/types';

function defaultDesde() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function defaultHasta() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

type RowModal = {
  fixtureId: number;
  label: string;
  referee: string;
};

const SYNC_PAUSE_STORAGE_KEY = 'partidos.syncPauseMs';
const SYNC_PAUSE_OPTIONS = [
  { value: 0, label: 'Sin pausa' },
  { value: 500, label: '0.5 s' },
  { value: 1000, label: '1 s' },
  { value: 1500, label: '1.5 s (recomendado)' },
  { value: 2000, label: '2 s' },
  { value: 3000, label: '3 s' },
] as const;
const DEFAULT_SYNC_PAUSE_MS = 1500;

const PROMEDIOS_PAUSE_STORAGE_KEY = 'partidos.promediosPauseMs';
const PROMEDIOS_PAUSE_OPTIONS = [
  { value: 0, label: 'Sin pausa' },
  { value: 200, label: '0.2 s' },
  { value: 500, label: '0.5 s' },
  { value: 1000, label: '1 s' },
] as const;
const DEFAULT_PROMEDIOS_PAUSE_MS = 0;

/** Pausa entre generaciones GPT — misma regla que el cron (15s OpenAI / 25s Gemini). */
const PREMATCH_PAUSE_STORAGE_KEY = 'partidos.preMatchPauseMs';
const PREMATCH_PAUSE_OPTIONS = [
  { value: 15000, label: '15 s (GPT / cron)' },
  { value: 25000, label: '25 s (Gemini / cron)' },
  { value: 30000, label: '30 s' },
  { value: 45000, label: '45 s' },
  { value: 60000, label: '60 s' },
  { value: 90000, label: '90 s (tras 429)' },
] as const;
const DEFAULT_PREMATCH_PAUSE_MS = 15000;

function readStoredPromediosPauseMs() {
  if (typeof window === 'undefined') return DEFAULT_PROMEDIOS_PAUSE_MS;
  const raw = localStorage.getItem(PROMEDIOS_PAUSE_STORAGE_KEY);
  const n = parseInt(raw || '', 10);
  return PROMEDIOS_PAUSE_OPTIONS.some((o) => o.value === n) ? n : DEFAULT_PROMEDIOS_PAUSE_MS;
}

function readStoredPreMatchPauseMs() {
  if (typeof window === 'undefined') return DEFAULT_PREMATCH_PAUSE_MS;
  const raw = localStorage.getItem(PREMATCH_PAUSE_STORAGE_KEY);
  const n = parseInt(raw || '', 10);
  return PREMATCH_PAUSE_OPTIONS.some((o) => o.value === n) ? n : DEFAULT_PREMATCH_PAUSE_MS;
}

function readStoredSyncPauseMs() {
  if (typeof window === 'undefined') return DEFAULT_SYNC_PAUSE_MS;
  const raw = localStorage.getItem(SYNC_PAUSE_STORAGE_KEY);
  const n = parseInt(raw || '', 10);
  return SYNC_PAUSE_OPTIONS.some((o) => o.value === n) ? n : DEFAULT_SYNC_PAUSE_MS;
}

async function sleepCancellable(ms: number, cancelRef: { current: boolean }) {
  if (ms <= 0) return;
  const step = 100;
  let elapsed = 0;
  while (elapsed < ms) {
    if (cancelRef.current) return;
    const chunk = Math.min(step, ms - elapsed);
    await new Promise((resolve) => setTimeout(resolve, chunk));
    elapsed += chunk;
  }
}

export function PartidosView() {
  const queryClient = useQueryClient();
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);
  const [sinArbitro, setSinArbitro] = useState(false);
  const [sinStats, setSinStats] = useState(false);
  const [applied, setApplied] = useState({
    desde: defaultDesde(),
    hasta: defaultHasta(),
    sinArbitro: false,
    sinStats: false,
  });
  const [filters, setFilters] = useState<PartidosClientFilters>(DEFAULT_PARTIDOS_FILTERS);
  const [sortMode, setSortMode] = useState<PartidosSortMode>('fecha_asc');
  const [syncOnlyMissing, setSyncOnlyMissing] = useState(true);
  const [syncPauseMs, setSyncPauseMs] = useState(DEFAULT_SYNC_PAUSE_MS);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncProgress, setSyncProgress] = useState<SyncRangeProgressState | null>(null);
  const syncCancelRef = useRef(false);
  const [promediosOnlyStale, setPromediosOnlyStale] = useState(true);
  const [promediosPauseMs, setPromediosPauseMs] = useState(DEFAULT_PROMEDIOS_PAUSE_MS);
  const [promediosBusy, setPromediosBusy] = useState(false);
  const [promediosMsg, setPromediosMsg] = useState('');
  const [promediosProgress, setPromediosProgress] = useState<PromediosRangeProgressState | null>(
    null,
  );
  const promediosCancelRef = useRef(false);
  const [sampleSyncBusy, setSampleSyncBusy] = useState(false);
  const [sampleSyncMsg, setSampleSyncMsg] = useState('');
  const [sampleSyncProgress, setSampleSyncProgress] =
    useState<PromediosSampleSyncProgressState | null>(null);
  const sampleSyncCancelRef = useRef(false);
  const [preMatchOnlyMissing, setPreMatchOnlyMissing] = useState(true);
  const [preMatchPauseMs, setPreMatchPauseMs] = useState(DEFAULT_PREMATCH_PAUSE_MS);
  const [preMatchBusy, setPreMatchBusy] = useState(false);
  const [preMatchMsg, setPreMatchMsg] = useState('');
  const [preMatchProgress, setPreMatchProgress] = useState<PreMatchRangeProgressState | null>(
    null,
  );
  const preMatchCancelRef = useRef(false);
  const [syncRowId, setSyncRowId] = useState<number | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairMsg, setRepairMsg] = useState('');
  const [statsModal, setStatsModal] = useState<Omit<RowModal, 'referee'> | null>(null);
  const [promediosModal, setPromediosModal] = useState<Omit<RowModal, 'referee'> | null>(null);
  const [estimadasModal, setEstimadasModal] = useState<Omit<RowModal, 'referee'> | null>(null);
  const [refereeModal, setRefereeModal] = useState<RowModal | null>(null);
  const [liveOddsModal, setLiveOddsModal] = useState<Omit<RowModal, 'referee'> | null>(null);
  const [preMatchModal, setPreMatchModal] = useState<Omit<RowModal, 'referee'> | null>(null);
  const [promptModal, setPromptModal] = useState<
    (Omit<RowModal, 'referee'> & { kind: PromptKind }) | null
  >(null);
  const [syncPeriodMsg, setSyncPeriodMsg] = useState<string | null>(null);

  useEffect(() => {
    setSyncPauseMs(readStoredSyncPauseMs());
    setPromediosPauseMs(readStoredPromediosPauseMs());
    setPreMatchPauseMs(readStoredPreMatchPauseMs());
  }, []);

  function handlePromediosPauseChange(ms: number) {
    setPromediosPauseMs(ms);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PROMEDIOS_PAUSE_STORAGE_KEY, String(ms));
    }
  }

  function handlePreMatchPauseChange(ms: number) {
    setPreMatchPauseMs(ms);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREMATCH_PAUSE_STORAGE_KEY, String(ms));
    }
  }

  function handleSyncPauseChange(ms: number) {
    setSyncPauseMs(ms);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SYNC_PAUSE_STORAGE_KEY, String(ms));
    }
  }

  const query = useQuery({
    queryKey: ['partidos', applied],
    queryFn: () =>
      fetchPartidos({
        desde: applied.desde,
        hasta: applied.hasta,
        sinArbitro: applied.sinArbitro,
        sinStats: applied.sinStats,
      }),
  });

  const filtered = useMemo(() => {
    const rows = query.data?.data ?? [];
    const f = filterPartidosRows(rows, filters);
    return sortPartidosRows(f, sortMode);
  }, [query.data?.data, filters, sortMode]);

  const meta = query.data?.meta;
  const allRows = query.data?.data ?? [];

  const quickCounts = useMemo(() => {
    let live = 0;
    let ft = 0;
    let ns = 0;
    let sinArb = 0;
    let sinSt = 0;
    for (const r of allRows) {
      const e = String(r.estado).toUpperCase();
      if (['1H', '2H', 'HT', 'ET', 'LIVE', 'P', 'BT'].includes(e)) live++;
      else if (['FT', 'AET', 'PEN'].includes(e)) ft++;
      else if (e === 'NS' || e === 'TBD') ns++;
      if (r.sinArbitro) sinArb++;
      if (!r.tieneEstadisticas) sinSt++;
    }
    return { live, ft, ns, sinArb, sinSt };
  }, [allRows]);

  function applyServerFilters() {
    setApplied({ desde, hasta, sinArbitro, sinStats });
  }

  function patchFilter(patch: Partial<PartidosClientFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function handleSyncRange() {
    if (
      !confirm(
        `¿Sincronizar estadísticas (FLB) de ligas destacadas del ${applied.desde} al ${applied.hasta}? Se procesará partido por partido con barra de progreso.`,
      )
    ) {
      return;
    }
    setSyncBusy(true);
    setSyncMsg('');
    syncCancelRef.current = false;
    setSyncProgress({
      phase: 'planning',
      total: 0,
      current: 0,
      ok: 0,
      failed: 0,
      currentFixture: null,
      recentLog: [],
      pauseMs: syncPauseMs,
      sourceBreakdown: emptySourceBreakdown(),
    });

    try {
      const plan = await fetchSyncStatsPlan({
        desde: applied.desde,
        hasta: applied.hasta,
        onlyMissing: syncOnlyMissing,
      });
      if (!plan.success) {
        const msg = plan.error || 'No se pudo planificar la sincronización';
        setSyncMsg(msg);
        toastError('Sincronizar rango (FLB)', msg);
        setSyncProgress({
          phase: 'error',
          total: 0,
          current: 0,
          ok: 0,
          failed: 0,
          currentFixture: null,
          recentLog: [`Error de plan: ${msg}`],
          pauseMs: syncPauseMs,
          sourceBreakdown: emptySourceBreakdown(),
          errorMessage: msg,
          errorDetail: null,
          errorCopyText: `Sincronizar rango FLB\nRango: ${applied.desde} → ${applied.hasta}\nError: ${msg}\nFecha: ${new Date().toISOString()}`,
        });
        return;
      }

      const fixtures = plan.fixtures ?? [];
      if (!fixtures.length) {
        const msg = 'No hay partidos pendientes de sincronizar en ese rango.';
        setSyncMsg(msg);
        toastWarning('Sincronizar rango (FLB)', msg);
        setSyncProgress({
          phase: 'done',
          total: 0,
          current: 0,
          ok: 0,
          failed: 0,
          currentFixture: null,
          recentLog: [msg],
          pauseMs: syncPauseMs,
          sourceBreakdown: emptySourceBreakdown(),
        });
        return;
      }

      let ok = 0;
      let failed = 0;
      let sourceBreakdown = emptySourceBreakdown();
      const recentLog: string[] = [`Plan: ${fixtures.length} partido(s)`];

      const progressBase = () => ({
        total: fixtures.length,
        pauseMs: syncPauseMs,
        sourceBreakdown,
      });

      setSyncProgress({
        phase: 'syncing',
        current: 0,
        ok: 0,
        failed: 0,
        currentFixture: fixtures[0] ?? null,
        recentLog: [`Plan: ${fixtures.length} partido(s) en ${plan.days ?? 0} día(s)`],
        ...progressBase(),
      });

      for (let i = 0; i < fixtures.length; i += 1) {
        if (syncCancelRef.current) {
          setSyncProgress({
            phase: 'cancelled',
            current: i,
            ok,
            failed,
            currentFixture: fixtures[i] ?? null,
            recentLog: recentLog.slice(-12),
            isPausing: false,
            ...progressBase(),
          });
          setSyncMsg(
            `Cancelado: ${sourceBreakdown.flb.length} FLB · ${sourceBreakdown.apiFootball.length} APIF · ${failed} fallo(s).`,
          );
          break;
        }

        const fx = fixtures[i];
        setSyncProgress({
          phase: 'syncing',
          current: i,
          ok,
          failed,
          currentFixture: fx,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });

        try {
          const result = await syncPartidoStats(fx.fixtureId);
          const { bucket, entry, logLine } = classifySyncResult(result, fx);
          sourceBreakdown = appendToBreakdown(sourceBreakdown, bucket, entry);
          recentLog.push(logLine);
          if (bucket === 'failed' || bucket === 'none') {
            failed += 1;
          } else {
            ok += 1;
          }
        } catch (e) {
          failed += 1;
          const entry = {
            fixtureId: fx.fixtureId,
            label: `${fx.homeTeam} vs ${fx.awayTeam}`,
            source: 'failed' as const,
            detail: (e as Error).message,
          };
          sourceBreakdown = appendToBreakdown(sourceBreakdown, 'failed', entry);
          recentLog.push(`✗ ${fx.fixtureId} ${entry.label} — ${entry.detail}`);
        }

        setSyncProgress({
          phase: 'syncing',
          current: i + 1,
          ok,
          failed,
          currentFixture: fixtures[i + 1] ?? null,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });

        if (i < fixtures.length - 1 && syncPauseMs > 0 && !syncCancelRef.current) {
          setSyncProgress({
            phase: 'syncing',
            current: i + 1,
            ok,
            failed,
            currentFixture: fixtures[i + 1] ?? null,
            recentLog: recentLog.slice(-12),
            isPausing: true,
            ...progressBase(),
          });
          await sleepCancellable(syncPauseMs, syncCancelRef);
        }
      }

      if (!syncCancelRef.current) {
        setSyncProgress({
          phase: 'done',
          current: fixtures.length,
          ok,
          failed,
          currentFixture: null,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });
        setSyncMsg(
          `FLB: ${sourceBreakdown.flb.length} · API-Football: ${sourceBreakdown.apiFootball.length} · sin stats: ${sourceBreakdown.none.length}${failed ? ` · fallos: ${failed}` : ''}`,
        );
      }

      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
    } catch (e) {
      const formatted = formatCaughtError(e);
      setSyncMsg(formatted.message);
      toastError('Sincronizar rango (FLB)', e);
      setSyncProgress({
        phase: 'error',
        total: 0,
        current: 0,
        ok: 0,
        failed: 0,
        currentFixture: null,
        recentLog: [`✗ ${formatted.message}`],
        pauseMs: syncPauseMs,
        sourceBreakdown: emptySourceBreakdown(),
        errorMessage: formatted.message,
        errorDetail: formatted.detail,
        errorCopyText: `Sincronizar rango FLB\nRango: ${applied.desde} → ${applied.hasta}\n${formatted.copyText}`,
      });
    } finally {
      setSyncBusy(false);
    }
  }

  function handleSyncProgressCancel() {
    if (syncProgress?.phase === 'planning' || syncProgress?.phase === 'syncing') {
      syncCancelRef.current = true;
      return;
    }
    setSyncProgress(null);
  }

  async function handleRecalcPromediosRange() {
    if (
      !confirm(
        `¿Recalcular promedios especiales del ${applied.desde} al ${applied.hasta}? Se procesará partido por partido (solo BD, sin APIs externas).`,
      )
    ) {
      return;
    }
    setPromediosBusy(true);
    setPromediosMsg('');
    promediosCancelRef.current = false;
    const startedAtMs = Date.now();
    setPromediosProgress({
      phase: 'planning',
      total: 0,
      current: 0,
      ok: 0,
      failed: 0,
      currentFixture: null,
      recentLog: ['Excluye Friendlies (10, 666, 667) al calcular la muestra…'],
      pauseMs: promediosPauseMs,
      startedAtMs,
    });

    try {
      const plan = await fetchPromediosRecalcPlan({
        desde: applied.desde,
        hasta: applied.hasta,
        onlyStale: promediosOnlyStale,
      });
      if (!plan.success) {
        const msg = plan.error || 'No se pudo planificar el recálculo';
        setPromediosMsg(msg);
        toastError('Recalcular promedios', msg);
        setPromediosProgress({
          phase: 'error',
          total: 0,
          current: 0,
          ok: 0,
          failed: 0,
          currentFixture: null,
          recentLog: [`Error de plan: ${msg}`],
          pauseMs: promediosPauseMs,
          startedAtMs,
          errorMessage: msg,
          errorDetail: null,
          errorCopyText: `Recalcular promedios\nRango: ${applied.desde} → ${applied.hasta}\nError: ${msg}\nFecha: ${new Date().toISOString()}`,
        });
        return;
      }

      const fixtures = plan.fixtures ?? [];
      if (!fixtures.length) {
        const msg = promediosOnlyStale
          ? 'No hay partidos con promedios desactualizados en ese rango.'
          : 'No hay partidos destacados en ese rango.';
        setPromediosMsg(msg);
        toastWarning('Recalcular promedios', msg);
        setPromediosProgress({
          phase: 'done',
          total: 0,
          current: 0,
          ok: 0,
          failed: 0,
          currentFixture: null,
          recentLog: [msg],
          pauseMs: promediosPauseMs,
          startedAtMs,
        });
        return;
      }

      let ok = 0;
      let failed = 0;
      const recentLog: string[] = [
        `Plan: ${fixtures.length} partido(s) · sin amistosos en la muestra`,
      ];

      const progressBase = () => ({
        total: fixtures.length,
        pauseMs: promediosPauseMs,
        startedAtMs,
      });

      setPromediosProgress({
        phase: 'recalculating',
        current: 0,
        ok: 0,
        failed: 0,
        currentFixture: fixtures[0] ?? null,
        recentLog: [
          `Plan: ${fixtures.length} partido(s) en ${plan.days ?? 0} día(s) · excluye Friendlies`,
        ],
        ...progressBase(),
      });

      for (let i = 0; i < fixtures.length; i += 1) {
        if (promediosCancelRef.current) {
          setPromediosProgress({
            phase: 'cancelled',
            current: i,
            ok,
            failed,
            currentFixture: fixtures[i] ?? null,
            recentLog: recentLog.slice(-12),
            isPausing: false,
            ...progressBase(),
          });
          setPromediosMsg(`Cancelado: ${ok} OK · ${failed} fallo(s).`);
          break;
        }

        const fx = fixtures[i];
        setPromediosProgress({
          phase: 'recalculating',
          current: i,
          ok,
          failed,
          currentFixture: fx,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });

        try {
          const result = await recalculatePartidoPromedios(fx.fixtureId);
          if (!result.success) {
            failed += 1;
            recentLog.push(
              `✗ ${fx.fixtureId} ${fx.homeTeam} vs ${fx.awayTeam} — ${result.error || 'error'}`,
            );
          } else {
            ok += 1;
            recentLog.push(
              `✓ ${fx.fixtureId} ${result.metricsCount ?? 28} métricas · ${fx.homeTeam} vs ${fx.awayTeam}`,
            );
          }
        } catch (e) {
          failed += 1;
          recentLog.push(
            `✗ ${fx.fixtureId} ${fx.homeTeam} vs ${fx.awayTeam} — ${(e as Error).message}`,
          );
        }

        setPromediosProgress({
          phase: 'recalculating',
          current: i + 1,
          ok,
          failed,
          currentFixture: fixtures[i + 1] ?? null,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });

        if (i < fixtures.length - 1 && promediosPauseMs > 0 && !promediosCancelRef.current) {
          setPromediosProgress({
            phase: 'recalculating',
            current: i + 1,
            ok,
            failed,
            currentFixture: fixtures[i + 1] ?? null,
            recentLog: recentLog.slice(-12),
            isPausing: true,
            ...progressBase(),
          });
          await sleepCancellable(promediosPauseMs, promediosCancelRef);
        }
      }

      if (!promediosCancelRef.current) {
        setPromediosProgress({
          phase: 'done',
          current: fixtures.length,
          ok,
          failed,
          currentFixture: null,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });
        setPromediosMsg(`${ok} recalculados${failed ? ` · ${failed} fallo(s)` : ''}.`);
      }
    } catch (e) {
      const formatted = formatCaughtError(e);
      setPromediosMsg(formatted.message);
      toastError('Recalcular promedios', e);
      setPromediosProgress({
        phase: 'error',
        total: 0,
        current: 0,
        ok: 0,
        failed: 0,
        currentFixture: null,
        recentLog: [`✗ ${formatted.message}`],
        pauseMs: promediosPauseMs,
        startedAtMs,
        errorMessage: formatted.message,
        errorDetail: formatted.detail,
        errorCopyText: `Recalcular promedios\nRango: ${applied.desde} → ${applied.hasta}\n${formatted.copyText}`,
      });
    } finally {
      setPromediosBusy(false);
    }
  }

  function handlePromediosProgressCancel() {
    if (
      promediosProgress?.phase === 'planning' ||
      promediosProgress?.phase === 'recalculating'
    ) {
      promediosCancelRef.current = true;
      return;
    }
    setPromediosProgress(null);
  }

  async function handlePromediosSampleSyncRange() {
    if (
      !confirm(
        `¿Sincronizar stats de muestras de promedios y recalcular del ${applied.desde} al ${applied.hasta}? Primero FLB de partidos sin stats en la muestra, luego recalcula y guarda.`,
      )
    ) {
      return;
    }

    setSampleSyncBusy(true);
    setSampleSyncMsg('');
    sampleSyncCancelRef.current = false;
    const startedAtMs = Date.now();
    const pauseMs = syncPauseMs;

    setSampleSyncProgress({
      phase: 'planning',
      syncTotal: 0,
      syncCurrent: 0,
      syncOk: 0,
      syncFailed: 0,
      recalcTotal: 0,
      recalcCurrent: 0,
      recalcOk: 0,
      recalcFailed: 0,
      currentSample: null,
      currentFixture: null,
      recentLog: ['Buscando muestras sin estadísticas…'],
      pauseMs,
      startedAtMs,
    });

    try {
      const plan = await fetchPromediosSampleSyncPlan({
        desde: applied.desde,
        hasta: applied.hasta,
        onlyWithMissingSamples: true,
      });

      if (!plan.success) {
        const msg = plan.error || 'No se pudo planificar el proceso';
        setSampleSyncMsg(msg);
        toastError('Sync muestras + promedios', msg);
        setSampleSyncProgress({
          phase: 'error',
          syncTotal: 0,
          syncCurrent: 0,
          syncOk: 0,
          syncFailed: 0,
          recalcTotal: 0,
          recalcCurrent: 0,
          recalcOk: 0,
          recalcFailed: 0,
          currentSample: null,
          currentFixture: null,
          recentLog: [`Error: ${msg}`],
          pauseMs,
          startedAtMs,
          errorMessage: msg,
          errorDetail: null,
          errorCopyText: `Sync muestras + promedios\nRango: ${applied.desde} → ${applied.hasta}\nError: ${msg}`,
        });
        return;
      }

      const samples = plan.uniqueMissingSamples ?? [];
      const fixtures = plan.fixtures ?? [];
      const sampleIds = plan.uniqueMissingSampleIds ?? samples.map((s) => s.fixtureId);

      if (!samples.length && !fixtures.length) {
        const msg = 'No hay muestras sin stats ni partidos a recalcular en ese rango.';
        setSampleSyncMsg(msg);
        toastWarning('Sync muestras + promedios', msg);
        setSampleSyncProgress({
          phase: 'done',
          syncTotal: 0,
          syncCurrent: 0,
          syncOk: 0,
          syncFailed: 0,
          recalcTotal: 0,
          recalcCurrent: 0,
          recalcOk: 0,
          recalcFailed: 0,
          currentSample: null,
          currentFixture: null,
          recentLog: [msg],
          pauseMs,
          startedAtMs,
        });
        return;
      }

      let syncOk = 0;
      let syncFailed = 0;
      let recalcOk = 0;
      let recalcFailed = 0;
      const recentLog: string[] = [
        `Plan: ${sampleIds.length} muestra(s) a sync · ${fixtures.length} partido(s) a recalcular`,
      ];

      const base = () => ({
        syncTotal: sampleIds.length,
        recalcTotal: fixtures.length,
        pauseMs,
        startedAtMs,
      });

      // —— Fase 1: sync FLB de muestras sin stats ——
      if (sampleIds.length > 0) {
        setSampleSyncProgress({
          phase: 'syncing_samples',
          syncCurrent: 0,
          syncOk: 0,
          syncFailed: 0,
          recalcCurrent: 0,
          recalcOk: 0,
          recalcFailed: 0,
          currentSample: samples[0] ?? null,
          currentFixture: null,
          recentLog: recentLog.slice(-14),
          isPausing: false,
          ...base(),
        });

        for (let i = 0; i < sampleIds.length; i += 1) {
          if (sampleSyncCancelRef.current) {
            setSampleSyncProgress({
              phase: 'cancelled',
              syncCurrent: i,
              syncOk,
              syncFailed,
              recalcCurrent: 0,
              recalcOk,
              recalcFailed,
              currentSample: samples[i] ?? null,
              currentFixture: null,
              recentLog: recentLog.slice(-14),
              isPausing: false,
              ...base(),
            });
            setSampleSyncMsg(
              `Cancelado en sync: ${syncOk} OK · ${syncFailed} fallo(s).`,
            );
            return;
          }

          const sid = sampleIds[i];
          const meta = samples[i] ?? samples.find((s) => s.fixtureId === sid) ?? null;
          setSampleSyncProgress({
            phase: 'syncing_samples',
            syncCurrent: i,
            syncOk,
            syncFailed,
            recalcCurrent: 0,
            recalcOk,
            recalcFailed,
            currentSample: meta,
            currentFixture: null,
            recentLog: recentLog.slice(-14),
            isPausing: false,
            ...base(),
          });

          try {
            const result = await syncPartidoStats(sid);
            if (!result.success) {
              syncFailed += 1;
              recentLog.push(
                `✗ sync ${sid} ${meta ? `${meta.homeTeam} vs ${meta.awayTeam}` : ''} — ${result.error || result.message || 'error'}`,
              );
            } else {
              syncOk += 1;
              recentLog.push(
                `✓ sync ${sid} ${meta ? `${meta.homeTeam} vs ${meta.awayTeam}` : ''}`,
              );
            }
          } catch (e) {
            syncFailed += 1;
            recentLog.push(
              `✗ sync ${sid} — ${(e as Error).message}`,
            );
          }

          setSampleSyncProgress({
            phase: 'syncing_samples',
            syncCurrent: i + 1,
            syncOk,
            syncFailed,
            recalcCurrent: 0,
            recalcOk,
            recalcFailed,
            currentSample: samples[i + 1] ?? null,
            currentFixture: null,
            recentLog: recentLog.slice(-14),
            isPausing: false,
            ...base(),
          });

          if (i < sampleIds.length - 1 && pauseMs > 0 && !sampleSyncCancelRef.current) {
            setSampleSyncProgress({
              phase: 'syncing_samples',
              syncCurrent: i + 1,
              syncOk,
              syncFailed,
              recalcCurrent: 0,
              recalcOk,
              recalcFailed,
              currentSample: samples[i + 1] ?? null,
              currentFixture: null,
              recentLog: recentLog.slice(-14),
              isPausing: true,
              ...base(),
            });
            await sleepCancellable(pauseMs, sampleSyncCancelRef);
          }
        }
      }

      if (sampleSyncCancelRef.current) {
        setSampleSyncProgress({
          phase: 'cancelled',
          syncCurrent: sampleIds.length,
          syncOk,
          syncFailed,
          recalcCurrent: 0,
          recalcOk,
          recalcFailed,
          currentSample: null,
          currentFixture: null,
          recentLog: recentLog.slice(-14),
          isPausing: false,
          ...base(),
        });
        setSampleSyncMsg(`Cancelado: sync ${syncOk} OK · ${syncFailed} fallo(s).`);
        return;
      }

      recentLog.push(
        `→ Recalculando ${fixtures.length} promedio(s)…`,
      );

      // —— Fase 2: recalcular promedios de partidos del rango ——
      setSampleSyncProgress({
        phase: 'recalculating',
        syncCurrent: sampleIds.length,
        syncOk,
        syncFailed,
        recalcCurrent: 0,
        recalcOk: 0,
        recalcFailed: 0,
        currentSample: null,
        currentFixture: fixtures[0] ?? null,
        recentLog: recentLog.slice(-14),
        isPausing: false,
        ...base(),
      });

      for (let i = 0; i < fixtures.length; i += 1) {
        if (sampleSyncCancelRef.current) {
          setSampleSyncProgress({
            phase: 'cancelled',
            syncCurrent: sampleIds.length,
            syncOk,
            syncFailed,
            recalcCurrent: i,
            recalcOk,
            recalcFailed,
            currentSample: null,
            currentFixture: fixtures[i] ?? null,
            recentLog: recentLog.slice(-14),
            isPausing: false,
            ...base(),
          });
          setSampleSyncMsg(
            `Cancelado en recalc: sync ${syncOk} · recalc ${recalcOk} OK · ${recalcFailed} fallo(s).`,
          );
          return;
        }

        const fx = fixtures[i];
        setSampleSyncProgress({
          phase: 'recalculating',
          syncCurrent: sampleIds.length,
          syncOk,
          syncFailed,
          recalcCurrent: i,
          recalcOk,
          recalcFailed,
          currentSample: null,
          currentFixture: fx,
          recentLog: recentLog.slice(-14),
          isPausing: false,
          ...base(),
        });

        try {
          const result = await recalculatePartidoPromedios(fx.fixtureId);
          if (!result.success) {
            recalcFailed += 1;
            recentLog.push(
              `✗ recalc ${fx.fixtureId} ${fx.homeTeam} vs ${fx.awayTeam} — ${result.error || 'error'}`,
            );
          } else {
            recalcOk += 1;
            recentLog.push(
              `✓ recalc ${fx.fixtureId} ${result.metricsCount ?? 28} métricas · ${fx.homeTeam} vs ${fx.awayTeam}`,
            );
          }
        } catch (e) {
          recalcFailed += 1;
          recentLog.push(
            `✗ recalc ${fx.fixtureId} — ${(e as Error).message}`,
          );
        }

        setSampleSyncProgress({
          phase: 'recalculating',
          syncCurrent: sampleIds.length,
          syncOk,
          syncFailed,
          recalcCurrent: i + 1,
          recalcOk,
          recalcFailed,
          currentSample: null,
          currentFixture: fixtures[i + 1] ?? null,
          recentLog: recentLog.slice(-14),
          isPausing: false,
          ...base(),
        });

        if (
          i < fixtures.length - 1 &&
          promediosPauseMs > 0 &&
          !sampleSyncCancelRef.current
        ) {
          await sleepCancellable(promediosPauseMs, sampleSyncCancelRef);
        }
      }

      if (!sampleSyncCancelRef.current) {
        setSampleSyncProgress({
          phase: 'done',
          syncCurrent: sampleIds.length,
          syncOk,
          syncFailed,
          recalcCurrent: fixtures.length,
          recalcOk,
          recalcFailed,
          currentSample: null,
          currentFixture: null,
          recentLog: recentLog.slice(-14),
          isPausing: false,
          ...base(),
        });
        setSampleSyncMsg(
          `Sync ${syncOk}/${sampleIds.length}${syncFailed ? ` (${syncFailed} fallo)` : ''} · Recalc ${recalcOk}/${fixtures.length}${recalcFailed ? ` (${recalcFailed} fallo)` : ''}.`,
        );
      }
    } catch (e) {
      const formatted = formatCaughtError(e);
      setSampleSyncMsg(formatted.message);
      toastError('Sync muestras + promedios', e);
      setSampleSyncProgress({
        phase: 'error',
        syncTotal: 0,
        syncCurrent: 0,
        syncOk: 0,
        syncFailed: 0,
        recalcTotal: 0,
        recalcCurrent: 0,
        recalcOk: 0,
        recalcFailed: 0,
        currentSample: null,
        currentFixture: null,
        recentLog: [`✗ ${formatted.message}`],
        pauseMs,
        startedAtMs,
        errorMessage: formatted.message,
        errorDetail: formatted.detail,
        errorCopyText: `Sync muestras + promedios\nRango: ${applied.desde} → ${applied.hasta}\n${formatted.copyText}`,
      });
    } finally {
      setSampleSyncBusy(false);
    }
  }

  function handleSampleSyncProgressCancel() {
    if (
      sampleSyncProgress?.phase === 'planning' ||
      sampleSyncProgress?.phase === 'syncing_samples' ||
      sampleSyncProgress?.phase === 'recalculating'
    ) {
      sampleSyncCancelRef.current = true;
      return;
    }
    setSampleSyncProgress(null);
  }

  function looksLikeRateLimit(msg: string) {
    const m = msg.toLowerCase();
    return (
      m.includes('429') ||
      m.includes('rate limit') ||
      m.includes('rate_limit') ||
      m.includes('too many requests') ||
      m.includes('openai_rate_limit')
    );
  }

  async function handleGeneratePreMatchRange() {
    if (
      !confirm(
        `¿Generar análisis IA prepartido del ${applied.desde} al ${applied.hasta}? Se respeta la pausa entre partidos (como el cron GPT). Cada análisis puede tardar 30–90s.`,
      )
    ) {
      return;
    }

    setPreMatchBusy(true);
    setPreMatchMsg('');
    preMatchCancelRef.current = false;
    const startedAtMs = Date.now();
    let effectivePauseMs = preMatchPauseMs;

    setPreMatchProgress({
      phase: 'planning',
      total: 0,
      current: 0,
      ok: 0,
      skipped: 0,
      failed: 0,
      currentFixture: null,
      recentLog: ['Planificando… · pausa tipo cron entre partidos'],
      pauseMs: effectivePauseMs,
      startedAtMs,
    });

    try {
      const plan = await fetchPreMatchPlan({
        desde: applied.desde,
        hasta: applied.hasta,
        onlyMissing: preMatchOnlyMissing,
      });

      if (!plan.success) {
        const msg = plan.error || 'No se pudo planificar la generación';
        setPreMatchMsg(msg);
        toastError('IA prepartido (rango)', msg);
        setPreMatchProgress({
          phase: 'error',
          total: 0,
          current: 0,
          ok: 0,
          skipped: 0,
          failed: 0,
          currentFixture: null,
          recentLog: [`Error de plan: ${msg}`],
          pauseMs: effectivePauseMs,
          startedAtMs,
          errorMessage: msg,
          errorDetail: null,
          errorCopyText: `IA prepartido\nRango: ${applied.desde} → ${applied.hasta}\nError: ${msg}`,
        });
        return;
      }

      if (plan.recommendedPauseMs && plan.recommendedPauseMs > effectivePauseMs) {
        effectivePauseMs = plan.recommendedPauseMs;
        setPreMatchPauseMs(effectivePauseMs);
        if (typeof window !== 'undefined') {
          localStorage.setItem(PREMATCH_PAUSE_STORAGE_KEY, String(effectivePauseMs));
        }
      }

      const fixtures = plan.fixtures ?? [];
      if (!fixtures.length) {
        const msg = preMatchOnlyMissing
          ? 'No hay partidos destacados sin análisis (o incompletos) en ese rango.'
          : 'No hay partidos destacados en ese rango.';
        setPreMatchMsg(msg);
        toastWarning('IA prepartido (rango)', msg);
        setPreMatchProgress({
          phase: 'done',
          total: 0,
          current: 0,
          ok: 0,
          skipped: 0,
          failed: 0,
          currentFixture: null,
          recentLog: [msg],
          pauseMs: effectivePauseMs,
          startedAtMs,
          llmProvider: plan.llmProvider ?? null,
        });
        return;
      }

      let ok = 0;
      let skipped = 0;
      let failed = 0;
      const recentLog: string[] = [
        `Plan: ${fixtures.length} partido(s)` +
          (plan.pauseNote ? ` · ${plan.pauseNote}` : ''),
      ];

      const progressBase = () => ({
        total: fixtures.length,
        pauseMs: effectivePauseMs,
        startedAtMs,
        llmProvider: plan.llmProvider ?? null,
      });

      setPreMatchProgress({
        phase: 'generating',
        current: 0,
        ok: 0,
        skipped: 0,
        failed: 0,
        currentFixture: fixtures[0] ?? null,
        recentLog: recentLog.slice(-12),
        ...progressBase(),
      });

      for (let i = 0; i < fixtures.length; i += 1) {
        if (preMatchCancelRef.current) {
          setPreMatchProgress({
            phase: 'cancelled',
            current: i,
            ok,
            skipped,
            failed,
            currentFixture: fixtures[i] ?? null,
            recentLog: recentLog.slice(-12),
            isPausing: false,
            ...progressBase(),
          });
          setPreMatchMsg(`Cancelado: ${ok} OK · ${skipped} omitido(s) · ${failed} fallo(s).`);
          break;
        }

        const fx = fixtures[i];
        const force = !preMatchOnlyMissing || fx.needsForce;
        setPreMatchProgress({
          phase: 'generating',
          current: i,
          ok,
          skipped,
          failed,
          currentFixture: fx,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });

        let didSkip = false;
        try {
          const result = await triggerPreMatchAnalysisManual(fx.fixtureId, force);
          if (result.skipped) {
            didSkip = true;
            skipped += 1;
            recentLog.push(
              `○ ${fx.fixtureId} omitido · ${fx.homeTeam} vs ${fx.awayTeam}`,
            );
          } else if (!result.ok) {
            failed += 1;
            const err = result.message || result.error || result.reason || 'error';
            recentLog.push(
              `✗ ${fx.fixtureId} ${fx.homeTeam} vs ${fx.awayTeam} — ${err}`,
            );
            if (looksLikeRateLimit(err)) {
              effectivePauseMs = Math.min(90000, effectivePauseMs + 15000);
              recentLog.push(
                `⏳ Rate limit: pausa aumentada a ${effectivePauseMs / 1000}s`,
              );
            }
          } else {
            ok += 1;
            recentLog.push(
              `✓ ${fx.fixtureId} ${result.published ?? 0} picks · ${fx.homeTeam} vs ${fx.awayTeam}`,
            );
          }
        } catch (e) {
          failed += 1;
          const err = (e as Error).message || String(e);
          recentLog.push(
            `✗ ${fx.fixtureId} ${fx.homeTeam} vs ${fx.awayTeam} — ${err}`,
          );
          if (looksLikeRateLimit(err)) {
            effectivePauseMs = Math.min(90000, effectivePauseMs + 15000);
            recentLog.push(
              `⏳ Rate limit: pausa aumentada a ${effectivePauseMs / 1000}s`,
            );
          }
        }

        setPreMatchProgress({
          phase: 'generating',
          current: i + 1,
          ok,
          skipped,
          failed,
          currentFixture: fixtures[i + 1] ?? null,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });

        // Como el cron: no pausar tras omitidos (already_exists)
        if (
          i < fixtures.length - 1 &&
          effectivePauseMs > 0 &&
          !didSkip &&
          !preMatchCancelRef.current
        ) {
          setPreMatchProgress({
            phase: 'generating',
            current: i + 1,
            ok,
            skipped,
            failed,
            currentFixture: fixtures[i + 1] ?? null,
            recentLog: recentLog.slice(-12),
            isPausing: true,
            ...progressBase(),
          });
          await sleepCancellable(effectivePauseMs, preMatchCancelRef);
        }
      }

      if (!preMatchCancelRef.current) {
        setPreMatchProgress({
          phase: 'done',
          current: fixtures.length,
          ok,
          skipped,
          failed,
          currentFixture: null,
          recentLog: recentLog.slice(-12),
          isPausing: false,
          ...progressBase(),
        });
        setPreMatchMsg(
          `${ok} generados${skipped ? ` · ${skipped} omitido(s)` : ''}${failed ? ` · ${failed} fallo(s)` : ''}.`,
        );
      }
    } catch (e) {
      const formatted = formatCaughtError(e);
      setPreMatchMsg(formatted.message);
      toastError('IA prepartido (rango)', e);
      setPreMatchProgress({
        phase: 'error',
        total: 0,
        current: 0,
        ok: 0,
        skipped: 0,
        failed: 0,
        currentFixture: null,
        recentLog: [`✗ ${formatted.message}`],
        pauseMs: effectivePauseMs,
        startedAtMs,
        errorMessage: formatted.message,
        errorDetail: formatted.detail,
        errorCopyText: `IA prepartido\nRango: ${applied.desde} → ${applied.hasta}\n${formatted.copyText}`,
      });
    } finally {
      setPreMatchBusy(false);
    }
  }

  function handlePreMatchProgressCancel() {
    if (
      preMatchProgress?.phase === 'planning' ||
      preMatchProgress?.phase === 'generating'
    ) {
      preMatchCancelRef.current = true;
      return;
    }
    setPreMatchProgress(null);
  }

  async function handleSyncOne(fixtureId: number) {
    setSyncRowId(fixtureId);
    try {
      const result = await syncPartidoStats(fixtureId);
      if (!result.success) {
        toastError(
          `Sync stats #${fixtureId}`,
          result.error || result.message || 'Error al sincronizar',
          {
            detail: result.statisticsSourceDetail || result.statisticsSourceReason || null,
          },
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      const src = result.statisticsSource || result.statsSource || 'flb';
      toastSuccess(
        `Sync #${fixtureId}`,
        result.message || `Estadísticas OK (${src})`,
      );
    } catch (e) {
      toastError(`Sync stats #${fixtureId}`, e);
    } finally {
      setSyncRowId(null);
    }
  }

  async function handleRepairReferees() {
    if (
      !confirm(
        `¿Reparar árbitros faltantes del ${applied.desde} al ${applied.hasta}? (API-Football y, si falta, FLB)`,
      )
    ) {
      return;
    }
    setRepairBusy(true);
    setRepairMsg('');
    try {
      const result = await repairPartidosReferees({
        desde: applied.desde,
        hasta: applied.hasta,
      });
      if (!result.success) {
        const msg = result.error || 'Error al reparar árbitros';
        setRepairMsg(msg);
        toastError('Reparar árbitros', msg);
      } else {
        const apif = result.totalUpdatedFromApiFootball ?? 0;
        const flb = result.totalUpdatedFromFlb ?? 0;
        const msg = `Actualizados: ${result.totalUpdated ?? 0} / ${result.totalCandidates ?? 0} (API-Football: ${apif} · FLB: ${flb}) · ${result.daysProcessed ?? 0} días`;
        setRepairMsg(msg);
        toastSuccess('Reparar árbitros', msg);
        await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      }
    } catch (e) {
      setRepairMsg((e as Error).message);
      toastError('Reparar árbitros', e);
    } finally {
      setRepairBusy(false);
    }
  }

  async function handleSyncPeriodTables() {
    setSyncPeriodMsg(null);
    try {
      const result = await syncPeriodSnapshotTables();
      if (!result.success) {
        const msg = result.error || result.message || 'Error';
        setSyncPeriodMsg(msg);
        toastError('Sincronizar tablas de periodos', msg);
        return;
      }
      const msg = result.message || 'Tabla sincronizada';
      setSyncPeriodMsg(msg);
      toastSuccess('Periodos', msg);
    } catch (e) {
      setSyncPeriodMsg((e as Error).message);
      toastError('Sincronizar tablas de periodos', e);
    }
  }

  function toggleQuickFilter(patch: Partial<PartidosClientFilters>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      const key = Object.keys(patch)[0] as keyof PartidosClientFilters;
      const val = patch[key];
      if (prev[key] === val) {
        if (key === 'estado') next.estado = '';
        else if (key === 'stats') next.stats = 'all';
        else if (key === 'arbitro') next.arbitro = 'all';
      }
      return next;
    });
  }

  return (
    <div className="p-3 pb-6 sm:p-6 lg:p-8">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Partidos</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
          Ligas destacadas · estadísticas vía{' '}
          <strong className="font-medium text-emerald-400/90">Live-Football-Data (FLB)</strong>
          {' '}con nombres canónicos en BD. Marcador y árbitro siguen en API-Football.
        </p>
      </header>

      {/* Filtros servidor */}
      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827]/80 p-3 sm:p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Rango y filtros de carga
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <DateField label="Desde" value={desde} onChange={setDesde} />
          <DateField label="Hasta" value={hasta} onChange={setHasta} />
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={sinArbitro}
              onChange={(e) => setSinArbitro(e.target.checked)}
              className="rounded border-white/20"
            />
            Solo sin árbitro
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={sinStats}
              onChange={(e) => setSinStats(e.target.checked)}
              className="rounded border-white/20"
            />
            Solo sin estadísticas
          </label>
          <button
            type="button"
            onClick={applyServerFilters}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
          >
            Buscar
          </button>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-slate-500">
            Sincronizar estadísticas FLB del rango visible (ligas destacadas, partido a partido con
            progreso)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={syncOnlyMissing}
                onChange={(e) => setSyncOnlyMissing(e.target.checked)}
                className="rounded border-white/20"
              />
              Solo partidos sin estadísticas
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <span className="whitespace-nowrap">Pausa entre partidos</span>
              <select
                value={syncPauseMs}
                disabled={syncBusy}
                onChange={(e) => handleSyncPauseChange(parseInt(e.target.value, 10))}
                className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
              >
                {SYNC_PAUSE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleSyncRange}
              disabled={syncBusy || preMatchBusy}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto"
            >
              {syncBusy ? 'Sincronizando rango…' : 'Sincronizar rango (FLB)'}
            </button>
            <button
              type="button"
              onClick={handleRepairReferees}
              disabled={repairBusy || preMatchBusy}
              className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 sm:w-auto"
            >
              {repairBusy ? 'Reparando…' : 'Reparar árbitros'}
            </button>
            <button
              type="button"
              onClick={handleSyncPeriodTables}
              className="w-full rounded-lg bg-violet-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 sm:w-auto"
            >
              Sync tabla periodos (lab)
            </button>
            {syncMsg && <span className="text-xs text-slate-400">{syncMsg}</span>}
            {repairMsg && <span className="text-xs text-amber-300">{repairMsg}</span>}
            {syncPeriodMsg && <span className="text-xs text-violet-300">{syncPeriodMsg}</span>}
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-slate-500">
            Recalcular promedios especiales del rango (córners recibidos, pases, posesión, etc.) —
            solo consulta BD. No incluye partidos de Friendlies (ligas 10, 666, 667) en la muestra.
            Muestra un popup con el avance partido a partido.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={promediosOnlyStale}
                onChange={(e) => setPromediosOnlyStale(e.target.checked)}
                className="rounded border-white/20"
              />
              Solo desactualizados (sin registro o métricas en cero)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <span className="whitespace-nowrap">Pausa entre partidos</span>
              <select
                value={promediosPauseMs}
                disabled={promediosBusy}
                onChange={(e) => handlePromediosPauseChange(parseInt(e.target.value, 10))}
                className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
              >
                {PROMEDIOS_PAUSE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleRecalcPromediosRange}
              disabled={promediosBusy || syncBusy || preMatchBusy || sampleSyncBusy}
              className="w-full rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50 sm:w-auto"
            >
              {promediosBusy ? 'Recalculando promedios…' : 'Recalcular promedios (rango)'}
            </button>
            {promediosMsg && <span className="text-xs text-violet-300">{promediosMsg}</span>}
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-slate-500">
            Proceso combinado: revisa las muestras (últimos 5 local/visitante) de los partidos del
            rango, sincroniza FLB las que no tienen estadísticas y luego recalcula y guarda los
            promedios. Usa la misma pausa FLB del sync de rango.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <button
              type="button"
              onClick={handlePromediosSampleSyncRange}
              disabled={
                sampleSyncBusy || syncBusy || promediosBusy || preMatchBusy
              }
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50 sm:w-auto"
            >
              {sampleSyncBusy
                ? 'Sync muestras + promedios…'
                : 'Sync muestras + recalcular promedios'}
            </button>
            {sampleSyncMsg && <span className="text-xs text-teal-300">{sampleSyncMsg}</span>}
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-slate-500">
            Generar análisis IA prepartido del rango (ligas destacadas). Respeta la pausa del cron
            entre partidos (GPT ~15s / Gemini ~25s) y muestra progreso partido a partido. Cada
            llamada al LLM puede tardar 30–90s.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={preMatchOnlyMissing}
                onChange={(e) => setPreMatchOnlyMissing(e.target.checked)}
                className="rounded border-white/20"
              />
              Solo sin análisis o incompletos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <span className="whitespace-nowrap">Pausa entre partidos</span>
              <select
                value={preMatchPauseMs}
                disabled={preMatchBusy}
                onChange={(e) => handlePreMatchPauseChange(parseInt(e.target.value, 10))}
                className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
              >
                {PREMATCH_PAUSE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleGeneratePreMatchRange}
              disabled={preMatchBusy || syncBusy || promediosBusy || sampleSyncBusy}
              className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 sm:w-auto"
            >
              {preMatchBusy ? 'Generando IA prepartido…' : 'Generar IA prepartido (rango)'}
            </button>
            {preMatchMsg && <span className="text-xs text-indigo-300">{preMatchMsg}</span>}
          </div>
        </div>
      </section>

      {/* Resumen */}
      {meta && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Pill>
            Periodo: <strong>{meta.desde}</strong> → <strong>{meta.hasta}</strong>
          </Pill>
          <Pill>
            Mostrando: <strong>{filtered.length}</strong>
            {filtered.length !== meta.total && (
              <span className="text-slate-500"> / {meta.total} cargados</span>
            )}
          </Pill>
          <Pill warn>
            Sin árbitro: <strong>{meta.sinArbitroCount}</strong>
          </Pill>
          <Pill warn>
            Sin stats: <strong>{meta.sinStatsCount}</strong>
          </Pill>
          {meta.totalEnRango !== meta.total && (
            <Pill>
              En rango total: <strong>{meta.totalEnRango}</strong>
            </Pill>
          )}
        </div>
      )}

      {!query.isLoading && allRows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <QuickChip
            active={filters.estado === 'live'}
            onClick={() => toggleQuickFilter({ estado: 'live' })}
            label={`En vivo (${quickCounts.live})`}
          />
          <QuickChip
            active={filters.estado === 'ft'}
            onClick={() => toggleQuickFilter({ estado: 'ft' })}
            label={`Finalizados (${quickCounts.ft})`}
          />
          <QuickChip
            active={filters.estado === 'ns'}
            onClick={() => toggleQuickFilter({ estado: 'ns' })}
            label={`Por jugar (${quickCounts.ns})`}
          />
          <QuickChip
            active={filters.arbitro === 'without'}
            onClick={() => toggleQuickFilter({ arbitro: 'without' })}
            label={`Sin árbitro (${quickCounts.sinArb})`}
          />
          <QuickChip
            active={filters.stats === 'without'}
            onClick={() => toggleQuickFilter({ stats: 'without' })}
            label={`Sin stats (${quickCounts.sinSt})`}
          />
        </div>
      )}

      {/* Filtros cliente */}
      <section className="mb-4 rounded-xl border border-white/10 bg-[#0c1017]/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Búsqueda y filtros en tabla
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="col-span-full flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
            Buscar
            <input
              type="search"
              value={filters.search}
              onChange={(e) => patchFilter({ search: e.target.value })}
              placeholder="Equipo, liga, árbitro, ID…"
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <SelectFilter
            label="Liga"
            value={filters.liga}
            onChange={(v) => patchFilter({ liga: v })}
            options={[
              { value: '', label: 'Todas' },
              ...(meta?.ligas ?? []).map((l) => ({ value: l, label: l })),
            ]}
          />
          <SelectFilter
            label="País"
            value={filters.pais}
            onChange={(v) => patchFilter({ pais: v })}
            options={[
              { value: '', label: 'Todos' },
              ...(meta?.paises ?? []).map((p) => ({ value: p, label: p })),
            ]}
          />
          <SelectFilter
            label="Estado"
            value={filters.estado}
            onChange={(v) => patchFilter({ estado: v })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'ns', label: 'Por jugar' },
              { value: 'live', label: 'En vivo' },
              { value: 'ft', label: 'Finalizado' },
              { value: 'other', label: 'Otros' },
            ]}
          />
          <SelectFilter
            label="Stats BD"
            value={filters.stats}
            onChange={(v) => patchFilter({ stats: v as PartidosClientFilters['stats'] })}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'with', label: 'Con stats' },
              { value: 'without', label: 'Sin stats' },
            ]}
          />
          <SelectFilter
            label="Árbitro"
            value={filters.arbitro}
            onChange={(v) => patchFilter({ arbitro: v as PartidosClientFilters['arbitro'] })}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'with', label: 'Asignado' },
              { value: 'without', label: 'Sin asignar' },
            ]}
          />
          <SelectFilter
            label="Orden"
            value={sortMode}
            onChange={(v) => setSortMode(v as PartidosSortMode)}
            options={[
              { value: 'fecha_asc', label: 'Fecha ↑' },
              { value: 'fecha_desc', label: 'Fecha ↓' },
              { value: 'partido_asc', label: 'Partido A-Z' },
              { value: 'liga_asc', label: 'Liga A-Z' },
              { value: 'estado_asc', label: 'Estado' },
            ]}
          />
        </div>
        {(filters.search ||
          filters.liga ||
          filters.pais ||
          filters.estado ||
          filters.stats !== 'all' ||
          filters.arbitro !== 'all') && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_PARTIDOS_FILTERS)}
            className="mt-3 text-xs text-indigo-400 hover:underline"
          >
            Limpiar filtros de tabla
          </button>
        )}
      </section>

      {query.isLoading && (
        <p className="py-12 text-center text-slate-500">Cargando partidos…</p>
      )}
      {query.isError && (
        <p className="py-8 text-center text-red-300">{(query.error as Error).message}</p>
      )}

      {!query.isLoading && !query.isError && (
        <>
          {/* Vista móvil: tarjetas */}
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => (
              <PartidoMobileCard
                key={row.fixtureid}
                row={row}
                dateRange={applied}
                onStats={() =>
                  setStatsModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                onPromedios={() =>
                  setPromediosModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                onEstimadas={() =>
                  setEstimadasModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                onReferee={() =>
                  setRefereeModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                    referee: row.fixturereferee,
                  })
                }
                onLiveOdds={() =>
                  setLiveOddsModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                onPreMatch={() =>
                  setPreMatchModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                onLivePromptV2={() =>
                  setPromptModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                    kind: 'live-v2',
                  })
                }
                showLiveOdds={row.estadoBadgeClass === 'live'}
                onSyncFlb={() => handleSyncOne(row.fixtureid)}
                syncBusy={syncRowId === row.fixtureid}
              />
            ))}
            {filtered.length === 0 && (
              <p className="rounded-xl border border-white/10 px-4 py-10 text-center text-slate-500">
                Sin partidos para los filtros seleccionados.
              </p>
            )}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-[#0c1017] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-3 text-left">ID</th>
                  <th className="px-3 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Partido</th>
                  <th className="px-3 py-3 text-left">Liga</th>
                  <th className="px-3 py-3 text-left">Marcador</th>
                  <th className="px-3 py-3 text-left">Estado</th>
                  <th className="px-3 py-3 text-left">Árbitro</th>
                  <th className="px-3 py-3 text-left">Stats</th>
                  <th className="px-3 py-3 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <PartidoTableRow
                    key={row.fixtureid}
                    row={row}
                    dateRange={applied}
                    onStats={() =>
                      setStatsModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    onPromedios={() =>
                      setPromediosModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    onEstimadas={() =>
                      setEstimadasModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    onReferee={() =>
                      setRefereeModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                        referee: row.fixturereferee,
                      })
                    }
                    onLiveOdds={() =>
                      setLiveOddsModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    onPreMatch={() =>
                      setPreMatchModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    onLivePromptV2={() =>
                      setPromptModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                        kind: 'live-v2',
                      })
                    }
                    showLiveOdds={row.estadoBadgeClass === 'live'}
                    onSyncFlb={() => handleSyncOne(row.fixtureid)}
                    syncBusy={syncRowId === row.fixtureid}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      Sin partidos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {statsModal && (
        <PartidoStatsModal
          fixtureId={statsModal.fixtureId}
          matchLabel={statsModal.label}
          onClose={() => setStatsModal(null)}
          onSynced={() => queryClient.invalidateQueries({ queryKey: ['partidos'] })}
        />
      )}
      {promediosModal && (
        <PromediosModal
          fixtureId={promediosModal.fixtureId}
          matchLabel={promediosModal.label}
          onClose={() => setPromediosModal(null)}
        />
      )}
      {estimadasModal && (
        <EstadisticasEstimadasModal
          fixtureId={estimadasModal.fixtureId}
          matchLabel={estimadasModal.label}
          onClose={() => setEstimadasModal(null)}
        />
      )}
      {refereeModal && (
        <RefereeModal
          fixtureId={refereeModal.fixtureId}
          matchLabel={refereeModal.label}
          currentReferee={refereeModal.referee}
          onClose={() => setRefereeModal(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['partidos'] })}
        />
      )}
      {liveOddsModal && (
        <LiveOddsModal
          fixtureId={liveOddsModal.fixtureId}
          matchLabel={liveOddsModal.label}
          onClose={() => setLiveOddsModal(null)}
        />
      )}
      {preMatchModal && (
        <PreMatchAnalysisModal
          fixtureId={preMatchModal.fixtureId}
          matchLabel={preMatchModal.label}
          onClose={() => setPreMatchModal(null)}
        />
      )}
      {promptModal && (
        <PromptModal
          fixtureId={promptModal.fixtureId}
          matchLabel={promptModal.label}
          kind={promptModal.kind}
          onClose={() => setPromptModal(null)}
        />
      )}
      {syncProgress && (
        <SyncRangeProgressModal
          progress={syncProgress}
          desde={applied.desde}
          hasta={applied.hasta}
          onlyMissing={syncOnlyMissing}
          pauseMs={syncPauseMs}
          onCancel={handleSyncProgressCancel}
        />
      )}
      {promediosProgress && (
        <PromediosRangeProgressModal
          progress={promediosProgress}
          desde={applied.desde}
          hasta={applied.hasta}
          onlyStale={promediosOnlyStale}
          pauseMs={promediosPauseMs}
          onCancel={handlePromediosProgressCancel}
        />
      )}
      {sampleSyncProgress && (
        <PromediosSampleSyncProgressModal
          progress={sampleSyncProgress}
          desde={applied.desde}
          hasta={applied.hasta}
          pauseMs={syncPauseMs}
          onCancel={handleSampleSyncProgressCancel}
        />
      )}
      {preMatchProgress && (
        <PreMatchRangeProgressModal
          progress={preMatchProgress}
          desde={applied.desde}
          hasta={applied.hasta}
          onlyMissing={preMatchOnlyMissing}
          pauseMs={preMatchPauseMs}
          onCancel={handlePreMatchProgressCancel}
        />
      )}
    </div>
  );
}

function matchLabel(row: PartidoRow) {
  return `${row.local} vs ${row.visitante}`;
}

function PartidoMobileCard({
  row,
  dateRange,
  onStats,
  onPromedios,
  onEstimadas,
  onReferee,
  onLiveOdds,
  onPreMatch,
  onLivePromptV2,
  onSyncFlb,
  syncBusy,
  showLiveOdds,
}: {
  row: PartidoRow;
  dateRange: { desde: string; hasta: string };
  onStats: () => void;
  onPromedios: () => void;
  onEstimadas: () => void;
  onReferee: () => void;
  onLiveOdds: () => void;
  onPreMatch: () => void;
  onLivePromptV2: () => void;
  onSyncFlb: () => void;
  syncBusy?: boolean;
  showLiveOdds?: boolean;
}) {
  const iaHref = `/pronosticos-ia?search=${row.fixtureid}&desde=${dateRange.desde}&hasta=${dateRange.hasta}`;

  return (
    <article className="rounded-xl border border-white/10 bg-[#111827] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug text-slate-100">
            {row.local} <span className="text-slate-600">vs</span> {row.visitante}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {row.fechaDisplay} · ID {row.fixtureid}
          </p>
        </div>
        <EstadoBadge estado={row.estado} badgeClass={row.estadoBadgeClass} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MobileField label="Marcador" value={row.marcador} />
        <MobileField
          label="Stats"
          value={
            row.tieneEstadisticas ? (
              <span className="text-emerald-300">Sí</span>
            ) : (
              <span className="text-red-300">No</span>
            )
          }
        />
        <MobileField label="Liga" value={row.liga} className="col-span-2" />
        <MobileField
          label="Árbitro"
          value={row.sinArbitro ? 'Sin asignar' : row.fixturereferee}
          className="col-span-2"
          valueClassName={row.sinArbitro ? 'text-red-300' : 'text-slate-300'}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
        <ActionBtn label={syncBusy ? '…' : 'Sync FLB'} onClick={onSyncFlb} disabled={syncBusy} />
        <ActionBtn label="Stats" onClick={onStats} />
        <ActionBtn label="Promedios" onClick={onPromedios} />
        <ActionBtn label="Est. estimadas" onClick={onEstimadas} />
        <ActionBtn label="Árbitro" onClick={onReferee} />
        <ActionBtn label="IA pre" onClick={onPreMatch} />
        <ActionBtn label="Prompt V2" onClick={onLivePromptV2} />
        {showLiveOdds && <ActionBtn label="Cuotas live" onClick={onLiveOdds} />}
        <Link
          href={iaHref}
          className="rounded border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-violet-500/40 hover:text-violet-300"
        >
          IA
        </Link>
      </div>
    </article>
  );
}

function MobileField({
  label,
  value,
  className = '',
  valueClassName = 'text-slate-300',
}: {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-0.5 truncate ${valueClassName}`}>{value}</p>
    </div>
  );
}

function PartidoTableRow({
  row,
  dateRange,
  onStats,
  onPromedios,
  onEstimadas,
  onReferee,
  onLiveOdds,
  onPreMatch,
  onLivePromptV2,
  onSyncFlb,
  syncBusy,
  showLiveOdds,
}: {
  row: PartidoRow;
  dateRange: { desde: string; hasta: string };
  onStats: () => void;
  onPromedios: () => void;
  onEstimadas: () => void;
  onReferee: () => void;
  onLiveOdds: () => void;
  onPreMatch: () => void;
  onLivePromptV2: () => void;
  onSyncFlb: () => void;
  syncBusy?: boolean;
  showLiveOdds?: boolean;
}) {
  const iaHref = `/pronosticos-ia?search=${row.fixtureid}&desde=${dateRange.desde}&hasta=${dateRange.hasta}`;

  return (
    <tr className="border-b border-white/5 align-top hover:bg-indigo-500/5">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">
        {row.fixtureid}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-400">{row.fechaDisplay}</td>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-200">
          {row.local} <span className="text-slate-600">vs</span> {row.visitante}
        </div>
      </td>
      <td className="max-w-[140px] px-3 py-2 text-slate-400">
        <div className="truncate">{row.liga}</div>
        {row.pais && <div className="truncate text-xs text-slate-600">{row.pais}</div>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-200">{row.marcador}</td>
      <td className="px-3 py-2">
        <EstadoBadge estado={row.estado} badgeClass={row.estadoBadgeClass} />
      </td>
      <td
        className={`max-w-[160px] px-3 py-2 text-sm ${
          row.sinArbitro ? 'text-red-300' : 'text-slate-300'
        }`}
      >
        {row.sinArbitro ? 'Sin asignar' : row.fixturereferee}
      </td>
      <td className="px-3 py-2">
        {row.tieneEstadisticas ? (
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
            Sí
          </span>
        ) : (
          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
            No
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <ActionBtn label={syncBusy ? '…' : 'Sync FLB'} onClick={onSyncFlb} disabled={syncBusy} />
          <ActionBtn label="Stats" onClick={onStats} />
          <ActionBtn label="Promedios" onClick={onPromedios} />
          <ActionBtn label="Est. estimadas" onClick={onEstimadas} />
          <ActionBtn label="Árbitro" onClick={onReferee} />
          <ActionBtn label="IA pre" onClick={onPreMatch} />
          <ActionBtn label="Prompt V2" onClick={onLivePromptV2} />
          {showLiveOdds && <ActionBtn label="Cuotas live" onClick={onLiveOdds} />}
          <Link
            href={iaHref}
            className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 hover:border-violet-500/40 hover:text-violet-300"
          >
            IA
          </Link>
        </div>
      </td>
    </tr>
  );
}

function EstadoBadge({
  estado,
  badgeClass,
}: {
  estado: string;
  badgeClass: PartidoRow['estadoBadgeClass'];
}) {
  const styles = {
    ns: 'bg-slate-500/20 text-slate-300',
    ft: 'bg-emerald-500/20 text-emerald-300',
    live: 'bg-amber-500/20 text-amber-300',
    other: 'bg-indigo-500/20 text-indigo-300',
  }[badgeClass];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {estado}
    </span>
  );
}

function Pill({
  children,
  warn,
}: {
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs text-slate-300 ${
        warn ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-[#111827]'
      }`}
    >
      {children}
    </span>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
      />
    </label>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-2 text-sm text-slate-200"
      >
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50 sm:px-2 sm:py-0.5 sm:text-[10px]"
    >
      {label}
    </button>
  );
}

function QuickChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-indigo-500/50 bg-indigo-600/25 text-indigo-200'
          : 'border-white/10 bg-[#111827] text-slate-400 hover:border-white/20 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
