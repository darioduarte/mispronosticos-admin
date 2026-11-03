'use client';

import Link from 'next/link';
import type { PartidoRow } from '@/lib/types';

export type MatchOpsAction =
  | 'stats'
  | 'promedios'
  | 'estimadas'
  | 'referee'
  | 'prematch-analysis'
  | 'prompts'
  | 'live-analysis'
  | 'prompt-live'
  | 'prompt-live-v2'
  | 'prematch-odds'
  | 'live-odds'
  | 'melbet'
  | 'odds-ref'
  | 'comparador';

type Item = {
  action: MatchOpsAction;
  label: string;
  detail: string;
};

const IA_ITEMS: Item[] = [
  {
    action: 'prematch-analysis',
    label: 'Pronósticos prepartido',
    detail: 'Los picks ya publicados, y generar o regenerar el análisis',
  },
  {
    action: 'prompts',
    label: 'Prompts prepartido',
    detail: 'El guardado en base, el que se arma ahora y el de prueba',
  },
  {
    action: 'live-analysis',
    label: 'Pronósticos en vivo',
    detail: 'Los análisis publicados durante el partido',
  },
  {
    action: 'prompt-live',
    label: 'Prompt en vivo',
    detail: 'El prompt de producción del minuto actual',
  },
  {
    action: 'prompt-live-v2',
    label: 'Prompt en vivo V2',
    detail: 'Vista de laboratorio, sin publicar en la app',
  },
];

const ODDS_ITEMS: Item[] = [
  { action: 'prematch-odds', label: 'Cuotas prepartido', detail: 'Líneas que usa el análisis previo' },
  { action: 'live-odds', label: 'Cuotas en vivo', detail: 'Mercados del partido en juego' },
  { action: 'melbet', label: 'Melbet', detail: 'Cuotas complementarias del proveedor' },
  { action: 'odds-ref', label: 'Referencia de cuotas', detail: 'Bloque de cuotas guardado para el pronóstico' },
  { action: 'comparador', label: 'Comparador', detail: 'Contrastar un JSON pegado con los picks del partido' },
];

const DATA_ITEMS: Item[] = [
  { action: 'stats', label: 'Estadísticas', detail: 'Stats del partido, FLB e historial' },
  { action: 'promedios', label: 'Promedios', detail: 'Promedios especiales de local y visita' },
  { action: 'estimadas', label: 'Estadísticas estimadas', detail: 'Líneas estimadas del partido' },
  { action: 'referee', label: 'Árbitro', detail: 'Árbitro asignado y corrección' },
];

type Props = {
  row: PartidoRow;
  dateRange: { desde: string; hasta: string };
  syncBusy: boolean;
  eventsBusy: boolean;
  onClose: () => void;
  onAction: (action: MatchOpsAction) => void;
  onSyncFlb: () => void;
  onSyncEvents: () => void;
};

export function MatchOpsPanel({
  row,
  dateRange,
  syncBusy,
  eventsBusy,
  onClose,
  onAction,
  onSyncFlb,
  onSyncEvents,
}: Props) {
  const iaHref = `/pronosticos-ia?search=${row.fixtureid}&desde=${dateRange.desde}&hasta=${dateRange.hasta}`;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/55"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#121820] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="match-ops-title"
      >
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                Panel del partido
              </p>
              <h2 id="match-ops-title" className="mt-1 text-lg font-semibold leading-snug text-white">
                {row.local} <span className="text-slate-500">vs</span> {row.visitante}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {row.liga}
                {row.pais ? ` · ${row.pais}` : ''} · {row.fechaDisplay}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-white"
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded bg-white/5 px-2 py-1 text-slate-300">ID {row.fixtureid}</span>
            <span className="rounded bg-white/5 px-2 py-1 text-slate-300">{row.estado}</span>
            <span className="rounded bg-white/5 px-2 py-1 text-slate-300">{row.marcador}</span>
            <span className="rounded bg-white/5 px-2 py-1 text-slate-300">
              Stats {row.tieneEstadisticas ? 'sí' : 'no'}
            </span>
            <span className="rounded bg-white/5 px-2 py-1 text-slate-300">
              {row.sinArbitro ? 'Sin árbitro' : row.fixturereferee}
            </span>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <Section title="Pronósticos de IA" items={IA_ITEMS} onAction={onAction} />
          <Section title="Cuotas" items={ODDS_ITEMS} onAction={onAction} />
          <Section title="Datos del partido" items={DATA_ITEMS} onAction={onAction} />

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Sincronizar
            </h3>
            <div className="mt-2 space-y-2">
              <SyncButton
                label="Sync FLB"
                detail="Traer estadísticas del proveedor para este partido"
                busy={syncBusy}
                onClick={onSyncFlb}
              />
              <SyncButton
                label="Eventos"
                detail="Actualizar goles, tarjetas y cambios"
                busy={eventsBusy}
                onClick={onSyncEvents}
              />
            </div>
          </section>
        </div>

        <footer className="border-t border-white/10 px-5 py-3">
          <Link
            href={iaHref}
            className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline"
          >
            Abrir este partido en Pronósticos IA
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function Section({
  title,
  items,
  onAction,
}: {
  title: string;
  items: Item[];
  onAction: (action: MatchOpsAction) => void;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <button
            key={item.action}
            type="button"
            onClick={() => onAction(item.action)}
            className="block w-full rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2.5 text-left hover:border-indigo-400/40 hover:bg-indigo-500/10"
          >
            <span className="block text-sm font-medium text-slate-100">{item.label}</span>
            <span className="mt-0.5 block text-xs leading-snug text-slate-500">{item.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SyncButton({
  label,
  detail,
  busy,
  onClick,
}: {
  label: string;
  detail: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="block w-full rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2.5 text-left hover:border-emerald-400/40 hover:bg-emerald-500/10 disabled:opacity-60"
    >
      <span className="block text-sm font-medium text-slate-100">{busy ? 'Trabajando…' : label}</span>
      <span className="mt-0.5 block text-xs leading-snug text-slate-500">{detail}</span>
    </button>
  );
}
