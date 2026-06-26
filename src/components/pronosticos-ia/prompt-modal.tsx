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
  live: 'Prompt en vivo',
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

  return (
    <TextModal
      title={TITLES[kind]}
      subtitle={matchLabel}
      text={text}
      loading={query.isLoading}
      onClose={onClose}
    />
  );
}
