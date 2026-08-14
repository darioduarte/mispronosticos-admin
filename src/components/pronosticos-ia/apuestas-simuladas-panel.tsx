'use client';

import {
  MATCH_SETTLE_MINUTE,
  computeApuestasSimuladas,
  computeCapitalSimultaneo,
  type ApuestasSimuladas,
  type CapitalSimultaneo,
} from '@/lib/pronosticos-ia-stats';
import type { PronosticoIaRow } from '@/lib/types';
import { useMemo } from 'react';

type Props = {
  rows: PronosticoIaRow[];
  stake: number;
  onStakeChange: (stake: number) => void;
};

function money(n: number): string {
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function signedMoney(n: number): string {
  const formatted = money(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `−${formatted}`;
  return formatted;
}

export function ApuestasSimuladasPanel({ rows, stake, onStakeChange }: Props) {
  const sim = useMemo(() => computeApuestasSimuladas(rows, stake), [rows, stake]);
  const cap = useMemo(() => computeCapitalSimultaneo(rows, stake), [rows, stake]);

  if (rows.length === 0) return null;

  return (
    <section className="mb-6 space-y-5 rounded-xl border border-amber-500/20 bg-[#151b24] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Simulación de apuestas</h2>
          <p className="mt-1 text-xs text-slate-500">
            Mismo valor en cada pick visible. El giro es la suma de apuestas; el pico simultáneo
            es el capital bloqueado a la vez (varios picks del mismo partido y partidos en paralelo).
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Apuesta por pick
          <input
            type="number"
            min={0}
            step="any"
            value={Number.isFinite(stake) ? stake : 0}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onStakeChange(Number.isFinite(v) && v >= 0 ? v : 0);
            }}
            className="w-32 rounded border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
          />
        </label>
      </div>

      <SummaryCards sim={sim} />

      <Breakdown sim={sim} />

      <CapitalSimultaneoBlock cap={cap} />

      {sim.sinCuota > 0 && (
        <p className="text-xs text-amber-300/80">
          {sim.sinCuota} pick{sim.sinCuota === 1 ? '' : 's'} sin cuota: no se apostaron.
        </p>
      )}
    </section>
  );
}

function SummaryCards({ sim }: { sim: ApuestasSimuladas }) {
  const beneficioAccent =
    sim.beneficio > 0 ? 'text-emerald-400' : sim.beneficio < 0 ? 'text-red-400' : 'text-white';
  const roiAccent =
    sim.roi != null && sim.roi > 0
      ? 'text-emerald-400'
      : sim.roi != null && sim.roi < 0
        ? 'text-red-400'
        : 'text-white';

  const cards = [
    { label: 'Picks apostados', value: String(sim.conCuota) },
    { label: 'Giro (suma de apuestas)', value: money(sim.apostadoTotal) },
    { label: 'Giro liquidado', value: money(sim.apostadoResuelto) },
    { label: 'Retorno (aciertos)', value: money(sim.retorno), accent: 'text-indigo-300' },
    { label: 'Beneficio', value: signedMoney(sim.beneficio), accent: beneficioAccent },
    {
      label: 'ROI del giro',
      value: sim.roi != null ? `${sim.roi >= 0 ? '+' : ''}${sim.roi.toFixed(1)}%` : '—',
      accent: roiAccent,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</p>
          <p className={`mt-1 text-lg font-bold ${c.accent ?? 'text-white'}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function Breakdown({ sim }: { sim: ApuestasSimuladas }) {
  const rows = [
    {
      label: 'Aciertos',
      picks: sim.acertados,
      apostado: sim.apostadoAciertos,
      resultado: sim.retorno,
      hint: 'retorno = apuesta × cuota',
      accent: 'text-emerald-300',
    },
    {
      label: 'Fallos',
      picks: sim.fallidos,
      apostado: sim.apostadoFallos,
      resultado: 0,
      hint: 'se pierde la apuesta',
      accent: 'text-red-300',
    },
    {
      label: 'Pendientes',
      picks: sim.pendientes,
      apostado: sim.apostadoPendiente,
      resultado: null,
      hint: 'en juego, no liquidado',
      accent: 'text-slate-300',
    },
  ];

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">Desglose según el filtro</p>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-[#0c1017] text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">Resultado</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">Picks</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">Apostado</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">Devuelto</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">Nota</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-white/5">
                <td className={`px-3 py-2 font-medium ${r.accent}`}>{r.label}</td>
                <td className="px-3 py-2 text-slate-300">{r.picks}</td>
                <td className="px-3 py-2 text-slate-300">{money(r.apostado)}</td>
                <td className="px-3 py-2 text-slate-300">
                  {r.resultado == null ? '—' : money(r.resultado)}
                </td>
                <td className="px-3 py-2 text-slate-500">{r.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
        <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
          Giro aún no liquidado:{' '}
          <strong className="text-slate-200">{money(sim.apostadoPendiente)}</strong>
          {sim.pendientes > 0 ? ` (${sim.pendientes} picks)` : ''}
        </li>
        <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
          Cuota media:{' '}
          <strong className="text-slate-200">
            {sim.cuotaMedia != null ? sim.cuotaMedia.toFixed(2) : '—'}
          </strong>
        </li>
        <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 sm:col-span-2">
          EV teórico (con probabilidad declarada):{' '}
          <strong
            className={
              sim.evTeorico == null
                ? 'text-slate-200'
                : sim.evTeorico > 0
                  ? 'text-emerald-300'
                  : sim.evTeorico < 0
                    ? 'text-red-300'
                    : 'text-slate-200'
            }
          >
            {sim.evTeorico != null ? signedMoney(sim.evTeorico) : '—'}
          </strong>
          <span className="ml-1 text-xs text-slate-600">
            si cada pick se liquidara según la prob. de la IA
          </span>
        </li>
      </ul>
    </div>
  );
}

function formatPicoWhen(ms: number | null): string {
  if (ms == null) return '—';
  return new Date(ms).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function CapitalSimultaneoBlock({ cap }: { cap: CapitalSimultaneo }) {
  const cards = [
    { label: 'Pico simultáneo', value: money(cap.pico), accent: 'text-amber-300' },
    { label: 'Picks abiertos en el pico', value: String(cap.picoPicks) },
    { label: 'Partidos en el pico', value: String(cap.picoPartidos) },
    {
      label: 'Peor partido (apilado)',
      value: cap.peorPartido ? money(cap.peorPartido.apostado) : '—',
    },
  ];

  return (
    <div className="space-y-3 border-t border-white/10 pt-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Capital simultáneo</h3>
        <p className="mt-1 text-xs text-slate-500">
          Cada pick queda abierto desde el minuto del análisis hasta el final del partido (min{' '}
          {MATCH_SETTLE_MINUTE}). Tres fases del mismo partido (30 / HT / 60) bloquean 3× el
          stake a la vez; si hay más partidos en esa hora, se suma. Es el efectivo que hace falta
          tener disponible, no el giro de la jornada.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-amber-500/15 bg-[#0b0f14] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 text-lg font-bold ${c.accent ?? 'text-white'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <ul className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
        <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
          Momento del pico:{' '}
          <strong className="text-slate-200">{formatPicoWhen(cap.picoAtMs)}</strong>
        </li>
        <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
          Capital medio en el tramo:{' '}
          <strong className="text-slate-200">
            {cap.capitalMedio != null ? money(cap.capitalMedio) : '—'}
          </strong>
        </li>
        <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
          Ahora mismo (partidos aún abiertos):{' '}
          <strong className="text-slate-200">{money(cap.capitalAhora)}</strong>
          {cap.picksAhora > 0
            ? ` · ${cap.picksAhora} picks / ${cap.partidosAhora} partido${cap.partidosAhora === 1 ? '' : 's'}`
            : ''}
        </li>
        <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
          {cap.peorPartido ? (
            <>
              Más apilado en un partido:{' '}
              <strong className="text-slate-200">{cap.peorPartido.label}</strong>
              {` · ${cap.peorPartido.picks} picks`}
            </>
          ) : (
            'Sin partido para apilar.'
          )}
        </li>
      </ul>

      {cap.picoPartidosDetalle.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-slate-500">
            Partidos que coincidieron en el pico (capital bloqueado a la vez)
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="bg-[#0c1017] text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">
                    Partido
                  </th>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">
                    Picks abiertos
                  </th>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">
                    Apostado
                  </th>
                </tr>
              </thead>
              <tbody>
                {cap.picoPartidosDetalle.map((p) => (
                  <tr key={p.fixtureid} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-200">{p.label}</td>
                    <td className="px-3 py-2 text-slate-300">{p.picks}</td>
                    <td className="px-3 py-2 font-medium text-amber-200">{money(p.apostado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cap.sinHorario > 0 && (
        <p className="text-xs text-amber-300/80">
          {cap.sinHorario} pick{cap.sinHorario === 1 ? '' : 's'} sin hora de saque: no entran en
          el pico (sí en el giro).
        </p>
      )}

      <p className="text-xs text-slate-600">
        Si filtras solo aciertos o una sola fase, el pico baja y no refleja el capital real de la
        jornada. Usa el rango de fechas y deja resultado/fase en «todos» para el máximo. Los
        mercados que se liquidan en el descanso pueden liberar capital antes; aquí se asume FT
        (estimación conservadora, un poco al alza).
      </p>
    </div>
  );
}
