'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchExperimentalPrompt,
  fetchLivePrompt,
  fetchLivePromptV2,
  fetchPeriodSnapshots,
  fetchPreMatchPrompt,
  capturePeriodSnapshot,
} from '@/lib/api';
import { TextModal } from './text-modal';
import { useState } from 'react';

export type PromptKind = 'pre-match' | 'experimental' | 'live' | 'live-v2';

const TITLES: Record<PromptKind, string> = {
  'pre-match': 'Prompt IA (producción)',
  experimental: 'Prompt IA (experimental)',
  live: 'Prompt en vivo (producción)',
  'live-v2': 'Prompt en vivo V2 (preview / lab)',
};

const ASOF_OPTIONS = [
  { value: '', label: 'Ahora (live API)' },
  { value: 'min30', label: "Como en 30'" },
  { value: 'ht', label: 'Como en entretiempo' },
  { value: 'min60', label: "Como en 60'" },
  { value: 'ft', label: 'Como en final 90′' },
  { value: 'et', label: 'Como en final prórroga' },
  { value: 'pen', label: 'Como en penales' },
];

type Props = {
  fixtureId: number;
  matchLabel: string;
  kind: PromptKind;
  onClose: () => void;
};

export function PromptModal({ fixtureId, matchLabel, kind, onClose }: Props) {
  const [asOf, setAsOf] = useState('');
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);

  const periodsQuery = useQuery({
    queryKey: ['period-snapshots', fixtureId],
    queryFn: () => fetchPeriodSnapshots(fixtureId),
    enabled: kind === 'live-v2',
  });

  const query = useQuery({
    queryKey: ['prompt', kind, fixtureId, asOf],
    queryFn: async () => {
      if (kind === 'pre-match') return fetchPreMatchPrompt(fixtureId);
      if (kind === 'experimental') return fetchExperimentalPrompt(fixtureId);
      if (kind === 'live-v2') {
        return fetchLivePromptV2(fixtureId, { asOf: asOf || null });
      }
      return fetchLivePrompt(fixtureId);
    },
  });

  const text =
    query.data?.fullText ??
    query.data?.prompt ??
    (query.isError ? (query.error as Error).message : query.isLoading ? '' : 'Sin contenido');

  const liveMeta =
    (kind === 'live' || kind === 'live-v2') && query.data?.liveSnapshot
      ? [
          query.data.liveSnapshot.status?.minute != null
            ? `min ${query.data.liveSnapshot.status.minute}'`
            : null,
          query.data.liveSnapshot.score
            ? `${query.data.liveSnapshot.score.home ?? 0}-${query.data.liveSnapshot.score.away ?? 0}`
            : null,
          query.data.includesOdds
            ? query.data.hasOdds
              ? 'con Bloque 5 (cuotas en vivo)'
              : 'sin cuotas en API (Bloque 5 vacío)'
            : null,
          query.data.promptLength ? `${query.data.promptLength} caracteres` : null,
          kind === 'live-v2' && query.data.usedDbAsOf ? 'fuente BD (asOf)' : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  const subtitle = [matchLabel, liveMeta].filter(Boolean).join(' — ');

  const periods = periodsQuery.data?.periods ?? [];

  async function handleCapture(periodKey?: string) {
    setCaptureBusy(true);
    setCaptureMsg(null);
    try {
      const res = await capturePeriodSnapshot(fixtureId, periodKey);
      if (!res.success) {
        setCaptureMsg(res.error || 'No se pudo capturar');
      } else {
        setCaptureMsg(`Capturado: ${res.periodKey}`);
        await periodsQuery.refetch();
        await query.refetch();
      }
    } catch (e) {
      setCaptureMsg((e as Error).message);
    } finally {
      setCaptureBusy(false);
    }
  }

  const toolbar =
    kind === 'live-v2' ? (
      <div className="mb-3 space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-slate-300">
        <p className="font-medium text-violet-200">
          Solo preview admin — no publica a la app ni cambia el prompt de producción.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-slate-500">asOf (lab)</span>
            <select
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="rounded border border-white/10 bg-[#0b0f14] px-2 py-1 text-slate-200"
            >
              {ASOF_OPTIONS.map((o) => (
                <option key={o.value || 'now'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={captureBusy}
            onClick={() => handleCapture()}
            className="rounded border border-white/15 px-2 py-1 text-slate-200 hover:border-violet-400/50 disabled:opacity-50"
          >
            {captureBusy ? 'Capturando…' : 'Capturar periodo ahora'}
          </button>
        </div>
        {periods.length > 0 ? (
          <p className="text-slate-400">
            Snapshots BD:{' '}
            {periods
              .map(
                (p) =>
                  `${p.label} ${p.scoreHome ?? '—'}-${p.scoreAway ?? '—'}`,
              )
              .join(' · ')}
          </p>
        ) : (
          <p className="text-amber-300/80">
            Sin snapshots en BD aún. En un live, usa “Capturar periodo ahora” o espera HT/FT.
          </p>
        )}
        {captureMsg && <p className="text-emerald-300">{captureMsg}</p>}
      </div>
    ) : null;

  return (
    <TextModal
      title={TITLES[kind]}
      subtitle={subtitle}
      text={text}
      loading={query.isLoading}
      loadingLabel={
        kind === 'live-v2'
          ? 'Generando prompt live V2 (evolución + picks previos)…'
          : kind === 'live'
            ? 'Generando prompt en vivo (stats + cuotas API)…'
            : undefined
      }
      onClose={onClose}
      headerExtra={toolbar}
    />
  );
}
