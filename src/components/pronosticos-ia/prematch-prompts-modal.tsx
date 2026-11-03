'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  fetchExperimentalPrompt,
  fetchPreMatchPrompt,
  fetchStoredPreMatchPrompt,
} from '@/lib/api';
import { TextModal } from './text-modal';

type Source = 'stored' | 'current' | 'experimental';

const TABS: { id: Source; label: string }[] = [
  { id: 'stored', label: 'Guardado' },
  { id: 'current', label: 'Actual' },
  { id: 'experimental', label: 'Prueba' },
];

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

export function PrematchPromptsModal({ fixtureId, matchLabel, onClose }: Props) {
  const [source, setSource] = useState<Source>('stored');

  const query = useQuery({
    queryKey: ['prematch-prompts', source, fixtureId],
    queryFn: () => {
      if (source === 'stored') return fetchStoredPreMatchPrompt(fixtureId);
      if (source === 'experimental') return fetchExperimentalPrompt(fixtureId);
      return fetchPreMatchPrompt(fixtureId);
    },
  });

  const text =
    query.data?.fullText ??
    query.data?.prompt ??
    (query.isError ? (query.error as Error).message : '');

  const note =
    source === 'stored'
      ? 'Es el texto que quedó en la base al generar el análisis. No incluye ajustes posteriores.'
      : source === 'current'
        ? 'Se arma ahora con la tabla, las zonas, las rondas y el resto de ajustes vigentes. No sustituye el análisis publicado.'
        : 'Generador de prueba. Hoy usa la misma plantilla que el actual y no se publica en la app.';

  const savedAt =
    source === 'stored' && query.data && 'updatedAt' in query.data && query.data.updatedAt
      ? new Date(String(query.data.updatedAt)).toLocaleString('es-CO', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : null;

  return (
    <TextModal
      title="Prompts prepartido"
      subtitle={[matchLabel, savedAt ? `guardado ${savedAt}` : null].filter(Boolean).join(' — ')}
      text={text}
      loading={query.isLoading}
      loadingLabel={
        source === 'stored'
          ? 'Leyendo el prompt guardado…'
          : 'Armando el prompt con los datos de ahora…'
      }
      onClose={onClose}
      headerExtra={
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSource(tab.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  source === tab.id
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                    : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{note}</p>
        </div>
      }
    />
  );
}
