'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchExperimentalPrompt,
  fetchLivePrompt,
  fetchPreMatchPrompt,
} from '@/lib/api';
import { TextModal } from './text-modal';

export type PromptKind = 'pre-match' | 'experimental' | 'live';

const TITLES: Record<PromptKind, string> = {
  'pre-match': 'Prompt IA (producción)',
  experimental: 'Prompt IA (experimental)',
  live: 'Prompt en vivo (producción)',
};

type Props = {
  fixtureId: number;
  matchLabel: string;
  kind: PromptKind;
  onClose: () => void;
};

export function PromptModal({ fixtureId, matchLabel, kind, onClose }: Props) {
  const query = useQuery({
    queryKey: ['prompt', kind, fixtureId],
    queryFn: async () => {
      if (kind === 'pre-match') return fetchPreMatchPrompt(fixtureId);
      if (kind === 'experimental') return fetchExperimentalPrompt(fixtureId);
      return fetchLivePrompt(fixtureId);
    },
  });

  const text =
    query.data?.fullText ??
    query.data?.prompt ??
    (query.isError ? (query.error as Error).message : query.isLoading ? '' : 'Sin contenido');

  const liveMeta =
    kind === 'live' && query.data?.liveSnapshot
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
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  const subtitle = [matchLabel, liveMeta].filter(Boolean).join(' — ');

  return (
    <TextModal
      title={TITLES[kind]}
      subtitle={subtitle}
      text={text}
      loading={query.isLoading}
      loadingLabel={kind === 'live' ? 'Generando prompt en vivo (stats + cuotas API)…' : undefined}
      onClose={onClose}
    />
  );
}
