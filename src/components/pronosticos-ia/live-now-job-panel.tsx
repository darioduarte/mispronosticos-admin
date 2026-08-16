'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCaughtError, toastError, toastSuccess, toastWarning } from '@/lib/admin-toast';
import {
  cancelLiveNowJob,
  fetchLiveNowJob,
  fetchLiveNowPlan,
  startLiveNowJob,
} from '@/lib/api';
import type { LiveNowJob } from '@/lib/types';
import {
  LiveNowProgressModal,
  type LiveNowProgressState,
} from '@/components/pronosticos-ia/live-now-progress';

const LIVE_NOW_PAUSE_STORAGE_KEY = 'pronosticos.liveNowPauseMs';
const LIVE_NOW_JOB_DISMISSED_KEY = 'pronosticos.liveNowJob.dismissedId';
const DEFAULT_LIVE_NOW_PAUSE_MS = 15000;
const LIVE_NOW_PAUSE_OPTIONS = [
  { value: 10000, label: '10 s' },
  { value: 15000, label: '15 s (recomendado)' },
  { value: 20000, label: '20 s' },
  { value: 30000, label: '30 s' },
  { value: 45000, label: '45 s' },
  { value: 60000, label: '60 s' },
  { value: 90000, label: '90 s (tras 429)' },
] as const;

function isLiveNowJobActive(phase: LiveNowJob['phase'] | undefined) {
  return phase === 'planning' || phase === 'generating';
}

function jobToProgress(job: LiveNowJob): LiveNowProgressState {
  return {
    phase: job.phase,
    total: job.total,
    current: job.current,
    ok: job.ok,
    skipped: job.skipped,
    failed: job.failed,
    currentFixture: job.currentFixture,
    recentLog: job.recentLog || [],
    isPausing: job.isPausing,
    pauseMs: job.pauseMs,
    startedAtMs: job.startedAtMs,
    llmProvider: job.llmProvider,
    errorMessage: job.errorMessage,
    errorDetail: job.errorDetail,
    errorCopyText: [
      'IA en vivo (cola segundo plano)',
      job.errorMessage,
      job.errorDetail,
      ...(job.failures || []).map(
        (f) => `${f.fixtureId} ${f.homeTeam} vs ${f.awayTeam}: ${f.error}`,
      ),
    ]
      .filter(Boolean)
      .join('\n'),
    failures: job.failures,
  };
}

function readStoredPauseMs() {
  if (typeof window === 'undefined') return DEFAULT_LIVE_NOW_PAUSE_MS;
  const raw = localStorage.getItem(LIVE_NOW_PAUSE_STORAGE_KEY);
  const n = parseInt(raw || '', 10);
  return LIVE_NOW_PAUSE_OPTIONS.some((o) => o.value === n) ? n : DEFAULT_LIVE_NOW_PAUSE_MS;
}

type Props = {
  onFinished?: () => void;
  /** `embedded`: fila dentro de un panel (p. ej. Partidos). `card`: bloque propio. */
  variant?: 'card' | 'embedded';
};

export function LiveNowJobPanel({ onFinished, variant = 'card' }: Props) {
  const [pauseMs, setPauseMs] = useState(DEFAULT_LIVE_NOW_PAUSE_MS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [job, setJob] = useState<LiveNowJob | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const prevPhaseRef = useRef<LiveNowJob['phase'] | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    setPauseMs(readStoredPauseMs());
  }, []);

  function handlePauseChange(ms: number) {
    setPauseMs(ms);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LIVE_NOW_PAUSE_STORAGE_KEY, String(ms));
    }
  }

  function applyJob(next: LiveNowJob | null, autoOpen: boolean) {
    if (!next) {
      setJob(null);
      setBusy(false);
      return;
    }

    const active = isLiveNowJobActive(next.phase);
    const dismissed =
      typeof window !== 'undefined' ? sessionStorage.getItem(LIVE_NOW_JOB_DISMISSED_KEY) : null;

    setJob(next);
    setBusy(active);

    if (!active) {
      setMsg(
        `${next.ok} generados${next.skipped ? ` · ${next.skipped} omitido(s)` : ''}${
          next.failed ? ` · ${next.failed} fallo(s)` : ''
        }.`,
      );
    }

    if (!active && dismissed === next.jobId) {
      setDismissedId(next.jobId);
      setModalOpen(false);
      return;
    }

    if (autoOpen) {
      setModalOpen(true);
    }
  }

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const data = await fetchLiveNowJob();
        if (stopped) return;
        applyJob(data.job, true);
      } catch {
        /* sin job previo */
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!job || !isLiveNowJobActive(job.phase)) return;
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const data = await fetchLiveNowJob();
          applyJob(data.job, false);
        } catch {
          /* poll silencioso */
        }
      })();
    }, 2000);
    return () => window.clearInterval(id);
  }, [job?.jobId, job?.phase]);

  useEffect(() => {
    if (!job) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = job.phase;
    if (prev == null || (prev !== 'planning' && prev !== 'generating')) return;
    if (job.phase === 'done') {
      toastSuccess(
        'IA en vivo (ahora)',
        `${job.ok} generados${job.skipped ? ` · ${job.skipped} omitido(s)` : ''}${
          job.failed ? ` · ${job.failed} fallo(s)` : ''
        }.`,
      );
      onFinishedRef.current?.();
    } else if (job.phase === 'error') {
      toastError('IA en vivo (ahora)', job.errorMessage || 'Error en la generación masiva');
    } else if (job.phase === 'cancelled') {
      toastWarning(
        'IA en vivo (ahora)',
        `Cancelado: ${job.ok} OK · ${job.skipped} omitido(s) · ${job.failed} fallo(s).`,
      );
      onFinishedRef.current?.();
    }
  }, [job]);

  async function handleStart() {
    setBusy(true);
    setMsg('');
    setModalOpen(true);
    setDismissedId(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(LIVE_NOW_JOB_DISMISSED_KEY);
    }

    try {
      let confirmText =
        '¿Generar análisis IA en vivo de todos los partidos destacados en juego ahora (minuto 1+ / HT / ET)? El proceso corre en el servidor, uno a uno, con pausa entre partidos.';
      try {
        const plan = await fetchLiveNowPlan();
        const n = plan.total ?? plan.fixtures?.length ?? 0;
        if (n === 0) {
          setBusy(false);
          setModalOpen(false);
          const empty = 'No hay partidos destacados en vivo en este momento.';
          setMsg(empty);
          toastWarning('IA en vivo (ahora)', empty);
          return;
        }
        const preview = (plan.fixtures || [])
          .slice(0, 8)
          .map((fx) => `• ${fx.homeTeam} vs ${fx.awayTeam} (${fx.statusLabel})`)
          .join('\n');
        const extra = n > 8 ? `\n… y ${n - 8} más` : '';
        confirmText = `¿Generar análisis IA en vivo de ${n} partido(s) en juego ahora?\n\n${preview}${extra}\n\nCola en segundo plano: un partido a la vez, con pausa de ${pauseMs / 1000}s. Puedes salir de la página.`;
      } catch {
        /* confirm genérico si el plan falla */
      }

      if (!window.confirm(confirmText)) {
        setBusy(false);
        setModalOpen(false);
        return;
      }

      const result = await startLiveNowJob({ pauseMs });

      if (result.alreadyRunning && result.job) {
        toastWarning(
          'IA en vivo (ahora)',
          'Ya hay una generación masiva en curso. Mostrando ese proceso.',
        );
        applyJob(result.job, true);
        return;
      }

      if (!result.job) {
        const err = result.error || 'No se pudo encolar la generación';
        setBusy(false);
        setMsg(err);
        toastError('IA en vivo (ahora)', err);
        return;
      }

      if (result.job.pauseMs && result.job.pauseMs > pauseMs) {
        handlePauseChange(result.job.pauseMs);
      }

      applyJob(result.job, true);
      toastSuccess(
        'IA en vivo (ahora)',
        'Generación encolada en segundo plano. Puedes salir de esta página.',
      );
    } catch (e) {
      const formatted = formatCaughtError(e);
      setBusy(false);
      setMsg(formatted.message);
      toastError('IA en vivo (ahora)', e);
    }
  }

  async function handleProgressCancel() {
    if (isLiveNowJobActive(job?.phase)) {
      try {
        const result = await cancelLiveNowJob();
        if (result.job) applyJob(result.job, true);
        if (result.error) {
          toastWarning('IA en vivo (ahora)', result.error);
        } else {
          toastSuccess(
            'IA en vivo (ahora)',
            'Cancelación pedida. Se detiene al terminar el partido en curso.',
          );
        }
      } catch (e) {
        toastError('IA en vivo (ahora)', e);
      }
      return;
    }
    if (job?.jobId && typeof window !== 'undefined') {
      sessionStorage.setItem(LIVE_NOW_JOB_DISMISSED_KEY, job.jobId);
      setDismissedId(job.jobId);
    }
    setModalOpen(false);
  }

  const controls = (
    <>
      <p className="mb-2 text-xs text-slate-500">
        Generar análisis IA en vivo de todos los partidos destacados que están jugando ahora
        (minuto 1 en adelante, entretiempo, 2T o el minuto actual). Corre en cola, un partido a
        la vez, con pausa entre llamadas para no saturar GPT. Puedes salir de la página.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <span className="whitespace-nowrap">Pausa entre partidos</span>
          <select
            value={pauseMs}
            disabled={busy}
            onChange={(e) => handlePauseChange(parseInt(e.target.value, 10))}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
          >
            {LIVE_NOW_PAUSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={busy}
          className="w-full rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 sm:w-auto"
        >
          {busy ? 'Generando IA en vivo…' : 'Generar IA en vivo (ahora)'}
        </button>
        {job && !modalOpen && dismissedId !== job.jobId && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-lg border border-orange-500/40 px-4 py-2.5 text-sm text-orange-200 hover:bg-orange-500/10 sm:w-auto"
          >
            Ver progreso IA en vivo
          </button>
        )}
        {msg && <span className="text-xs text-orange-300">{msg}</span>}
      </div>
    </>
  );

  return (
    <>
      {variant !== 'embedded' && job && !modalOpen && dismissedId !== job.jobId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-orange-100">
              {isLiveNowJobActive(job.phase)
                ? 'Análisis IA en vivo en segundo plano'
                : job.phase === 'done'
                  ? 'Análisis IA en vivo finalizado'
                  : job.phase === 'error'
                    ? 'Análisis IA en vivo con error'
                    : 'Análisis IA en vivo cancelado'}
            </p>
            <p className="mt-0.5 text-xs text-orange-200/70">
              {job.total > 0 ? `${job.current} de ${job.total}` : 'Planificando'}
              {` · ${job.ok} OK`}
              {job.failed ? ` · ${job.failed} fallo(s)` : ''}
              {job.phase === 'error' && job.errorMessage ? ` · ${job.errorMessage}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-orange-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
          >
            Ver detalle
          </button>
        </div>
      )}

      {variant === 'embedded' ? (
        <div className="mt-4 border-t border-white/10 pt-4">{controls}</div>
      ) : (
        <section className="mb-4 rounded-xl border border-orange-500/20 bg-[#151b24] p-3 sm:mb-6 sm:p-4">
          {controls}
        </section>
      )}

      {modalOpen && job && (
        <LiveNowProgressModal
          progress={jobToProgress(job)}
          pauseMs={pauseMs}
          onCancel={() => void handleProgressCancel()}
          onMinimize={
            isLiveNowJobActive(job.phase)
              ? () => setModalOpen(false)
              : undefined
          }
        />
      )}
    </>
  );
}
