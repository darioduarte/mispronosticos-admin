'use client';

import {
  computePronosticosIaStats,
  formatCategoriaLabel,
  type PronosticosIaStats,
  type StatsOptions,
} from '@/lib/pronosticos-ia-stats';
import type { PronosticoIaRow } from '@/lib/types';
import { useMemo } from 'react';

type Props = {
  rows: PronosticoIaRow[];
  options: StatsOptions;
  onOptionsChange: (patch: Partial<StatsOptions>) => void;
};

export function PronosticosIaStatsPanel({ rows, options, onOptionsChange }: Props) {
  const stats = useMemo(
    () => computePronosticosIaStats(rows, options),
    [rows, options],
  );

  if (rows.length === 0) return null;

  return (
    <section className="mb-6 space-y-6 rounded-xl border border-white/10 bg-[#151b24] p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Indicadores de rendimiento (vista filtrada)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Los porcentajes se recalculan con las filas visibles según tus filtros.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <NumberControl
          label="Mín. evaluados ranking"
          value={options.minEvalRanking}
          onChange={(v) => onOptionsChange({ minEvalRanking: v })}
        />
        <NumberControl
          label="Ventana reciente (días)"
          value={options.rollingDays}
          onChange={(v) => onOptionsChange({ rollingDays: v })}
        />
        <NumberControl
          label="Mín. muestra fiable"
          value={options.minEvalSegments}
          onChange={(v) => onOptionsChange({ minEvalSegments: v })}
        />
      </div>

      <SummaryCards stats={stats} />

      <div>
        <p className="mb-2 text-xs text-slate-500">Distribución del resultado</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
          <div className="bg-emerald-500/80" style={{ width: `${stats.bar.ac}%` }} />
          <div className="bg-red-500/70" style={{ width: `${stats.bar.fa}%` }} />
          <div className="bg-slate-500/50" style={{ width: `${stats.bar.pe}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {stats.bar.ac.toFixed(0)}% aciertos · {stats.bar.fa.toFixed(0)}% fallos ·{' '}
          {stats.bar.pe.toFixed(0)}% pendientes
        </p>
      </div>

      <ExtraIndicators stats={stats} rollingDays={options.rollingDays} />

      <RankingTable
        title="Ranking por categoría"
        rows={stats.categorias.map((r, i) => ({
          rank: i + 1,
          cols: [
            formatCategoriaLabel(r.label),
            String(r.total),
            String(r.ac),
            String(r.fa),
            String(r.pe),
            String(r.resolved),
            r.rate != null ? `${r.rate.toFixed(1)}%` : '—',
            r.wilson,
            r.avgProb != null ? `${r.avgProb.toFixed(1)}%` : '—',
          ],
          lowSample: r.lowSample,
        }))}
        headers={['#', 'Categoría', 'Total', '✓', '✗', 'Pend.', 'Eval.', '% acierto', 'IC 95%', 'Prob. media']}
      />

      <RankingTable
        title="Ranking por torneo"
        rows={stats.torneos.map((r, i) => ({
          rank: i + 1,
          cols: [
            (r as { pais?: string }).pais ?? '—',
            (r as { liga?: string }).liga ?? r.label,
            String(r.total),
            String(r.ac),
            String(r.fa),
            String(r.pe),
            String(r.resolved),
            r.rate != null ? `${r.rate.toFixed(1)}%` : '—',
            r.wilson,
            r.avgProb != null ? `${r.avgProb.toFixed(1)}%` : '—',
          ],
          lowSample: r.lowSample,
        }))}
        headers={['#', 'País', 'Competición', 'Total', '✓', '✗', 'Pend.', 'Eval.', '% acierto', 'IC 95%', 'Prob. media']}
      />

      <RankingTable
        title="Calibración por tramo de probabilidad"
        rows={stats.calibracion.map((r) => ({
          rank: 0,
          cols: [
            r.label,
            String(r.eval),
            r.rate != null ? `${r.rate.toFixed(1)}%` : '—',
            `${r.mid}%`,
            r.delta != null ? `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)} p.p.` : '—',
            r.wilson,
          ],
          lowSample: r.eval > 0 && r.eval < options.minEvalSegments,
        }))}
        headers={['Tramo', 'Eval.', '% realizado', 'Centro tramo', 'Δ calibración', 'IC 95%']}
        hideRank
      />

      <RankingTable
        title="Segmentación por línea"
        rows={stats.lineas.map((r) => ({
          rank: 0,
          cols: [
            r.label,
            String(r.total),
            String(r.resolved),
            r.rate != null ? `${r.rate.toFixed(1)}%` : '—',
            r.avgProb != null ? `${r.avgProb.toFixed(1)}%` : '—',
            r.wilson,
          ],
          lowSample: r.lowSample,
        }))}
        headers={['Tramo línea', 'Total', 'Eval.', '% acierto', 'Prob. media', 'IC 95%']}
        hideRank
      />

      <RankingTable
        title="Edge implícito (modelo vs mercado)"
        rows={stats.edge.map((r) => ({
          rank: 0,
          cols: [
            r.label,
            String(r.total),
            String(r.resolved),
            r.rate != null ? `${r.rate.toFixed(1)}%` : '—',
            r.avgProb != null ? `${r.avgProb.toFixed(1)}%` : '—',
            (r as { implAvg?: number | null }).implAvg != null
              ? `${(r as { implAvg: number }).implAvg.toFixed(1)}%`
              : '—',
            r.wilson,
          ],
          lowSample: r.lowSample,
        }))}
        headers={['Tramo Δ', 'Filas', 'Eval.', '% acierto', 'Prob. mod.', 'Implícita', 'IC 95%']}
        hideRank
      />
    </section>
  );
}

function NumberControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-slate-400">
      {label}
      <input
        type="number"
        min={1}
        max={365}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="w-24 rounded border border-white/10 bg-[#0b0f14] px-2 py-1 text-slate-200"
      />
    </label>
  );
}

function SummaryCards({ stats }: { stats: PronosticosIaStats }) {
  const cards = [
    { label: '% aciertos / evaluados', value: stats.rateResolved != null ? `${stats.rateResolved.toFixed(1)}%` : '—', accent: 'text-indigo-300' },
    { label: 'Total visibles', value: String(stats.total) },
    { label: 'Acertados', value: String(stats.ac), accent: 'text-emerald-400' },
    { label: 'Fallidos', value: String(stats.fa), accent: 'text-red-400' },
    { label: 'Pendientes', value: String(stats.pe), accent: 'text-slate-400' },
    { label: '% aciertos / total', value: stats.rateTotal != null ? `${stats.rateTotal.toFixed(1)}%` : '—' },
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

function ExtraIndicators({ stats, rollingDays }: { stats: PronosticosIaStats; rollingDays: number }) {
  const rr = stats.rolling.recent;
  const ro = stats.rolling.older;
  const rRes = rr.ac + rr.fa;
  const oRes = ro.ac + ro.fa;
  const rRate = rRes > 0 ? ((100 * rr.ac) / rRes).toFixed(1) : '—';
  const oRate = oRes > 0 ? ((100 * ro.ac) / oRes).toFixed(1) : '—';

  return (
    <ul className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
      <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
        Prob. media declarada:{' '}
        <strong className="text-slate-200">
          {stats.avgProb != null ? `${stats.avgProb.toFixed(1)}%` : '—'}
        </strong>
      </li>
      <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
        Picks de valor: <strong className="text-slate-200">{stats.pickValorCount}</strong>
      </li>
      <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
        Partidos únicos: <strong className="text-slate-200">{stats.uniqueFixtures}</strong>
      </li>
      <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
        Reciente ({rollingDays}d): <strong className="text-slate-200">{rRate}%</strong> ({rr.ac}/{rRes})
      </li>
      <li className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
        Histórico (&gt;{rollingDays}d): <strong className="text-slate-200">{oRate}%</strong> ({ro.ac}/{oRes})
      </li>
    </ul>
  );
}

function RankingTable({
  title,
  headers,
  rows,
  hideRank,
}: {
  title: string;
  headers: string[];
  rows: { rank: number; cols: string[]; lowSample: boolean }[];
  hideRank?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-200">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-[#0c1017] text-slate-400">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-2 py-2 text-left font-medium uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${title}-${idx}`}
                className={`border-t border-white/5 ${row.lowSample ? 'opacity-50' : ''}`}
              >
                {!hideRank && (
                  <td className="px-2 py-1.5 text-slate-500">{row.rank}</td>
                )}
                {row.cols.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1.5 text-slate-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
