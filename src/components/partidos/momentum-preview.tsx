'use client';

import type { FixtureMomentumResponse, MomentumEvent } from '@/lib/types';

const LANE_H = 72;

function eventMark(ev: MomentumEvent) {
  if (ev.type === 'goal') return '●';
  if (ev.type === 'red') return '■';
  return '▮';
}

function eventColor(ev: MomentumEvent) {
  if (ev.type === 'goal') return ev.side === 'home' ? '#7dd3fc' : '#fdba74';
  if (ev.type === 'red') return '#f87171';
  return '#facc15';
}

function pair(label: string, values?: [number | null, number | null] | null) {
  if (!values) return null;
  const [home, away] = values;
  if (home == null && away == null) return null;
  return (
    <div key={label} className="flex items-center justify-between gap-3 text-xs text-slate-300">
      <span className="w-8 text-right tabular-nums text-sky-300">{home ?? '—'}</span>
      <span className="flex-1 text-center text-slate-500">{label}</span>
      <span className="w-8 tabular-nums text-orange-300">{away ?? '—'}</span>
    </div>
  );
}

export function MomentumPreview({ data }: { data: FixtureMomentumResponse }) {
  const bars = data.bars || [];
  const events = data.events || [];
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const lastMinute = Math.max(90, ...bars.map((b) => b.minute), ...events.map((e) => e.minute));
  const width = Math.max(640, lastMinute * 7);

  function x(minute: number) {
    return ((minute - 0.5) / lastMinute) * width;
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/60 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>
          {data.momentumFound
            ? `${bars.length} minutos de momentum`
            : 'Sin serie de momentum'}
        </span>
        {data.eventId ? <span>eventId {data.eventId}</span> : null}
        {data.coverageLevel ? <span>cobertura {data.coverageLevel}</span> : null}
      </div>
      {data.error ? <p className="text-sm text-amber-300">{data.error}</p> : null}

      <div className="overflow-x-auto">
        <svg width={width} height={LANE_H * 2 + 28} role="img" aria-label="Momentum del partido">
          <text x={4} y={14} fill="#7dd3fc" fontSize={11}>
            Local
          </text>
          <text x={4} y={LANE_H + 26} fill="#fdba74" fontSize={11}>
            Visita
          </text>
          {[15, 30, 45, 60, 75, 90].filter((m) => m <= lastMinute).map((m) => (
            <g key={m}>
              <line
                x1={x(m)}
                x2={x(m)}
                y1={18}
                y2={LANE_H * 2 + 8}
                stroke="rgba(255,255,255,0.08)"
              />
              <text x={x(m)} y={LANE_H * 2 + 22} fill="#94a3b8" fontSize={10} textAnchor="middle">
                {m === 45 ? 'HT' : `${m}'`}
              </text>
            </g>
          ))}
          {bars.map((bar) => {
            const h = (Math.abs(bar.value) / max) * (LANE_H - 22);
            const home = bar.value >= 0;
            const y = home ? 18 + (LANE_H - 22 - h) : LANE_H + 18;
            return (
              <rect
                key={`${bar.minute}-${bar.value}`}
                x={x(bar.minute) - 2}
                y={home ? y : LANE_H + 18}
                width={4}
                height={Math.max(h, bar.value === 0 ? 1 : 2)}
                fill={home ? '#38bdf8' : '#fb923c'}
                opacity={0.9}
              >
                <title>{`Min ${bar.minute}: ${bar.value}`}</title>
              </rect>
            );
          })}
          {events.map((ev, i) => (
            <text
              key={`${ev.side}-${ev.minute}-${ev.type}-${i}`}
              x={x(ev.minute)}
              y={ev.side === 'home' ? 32 : LANE_H + 36}
              fill={eventColor(ev)}
              fontSize={11}
              textAnchor="middle"
            >
              <title>{`${ev.type} ${ev.minute}'`}</title>
              {eventMark(ev)}
            </text>
          ))}
        </svg>
      </div>

      <div className="mx-auto max-w-sm space-y-1">
        {pair('Posesión', data.summary?.possession)}
        {pair('Tiros totales', data.summary?.totalShots)}
        {pair('A puerta', data.summary?.shotsOn)}
        {pair('Fuera', data.summary?.shotsOff)}
        {pair('Córners', data.summary?.corners)}
        {pair('Amarillas', data.summary?.yellow)}
        {pair('Rojas', data.summary?.red)}
      </div>
    </div>
  );
}
