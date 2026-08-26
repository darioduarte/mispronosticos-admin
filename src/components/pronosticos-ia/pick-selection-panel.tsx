'use client';

import { useMemo, useState } from 'react';
import {
  CFG,
  buildSelectedPicksMarkdown,
  runWalkForwardBacktest,
  selectPicks,
  type HistoryCase,
  type PickLabel,
  type RankingMode,
  type ScoredPick,
  type SelectPicksResult,
  type WalkForwardBacktest,
} from '@/lib/pick-selection-engine';
import {
  categoriaKey,
  parseCuotaDecimal,
  parseFixtureDateMs,
  parseProb,
  torneoKey,
} from '@/lib/pronosticos-ia-stats';
import type { PronosticoIaRow } from '@/lib/types';

type Props = {
  rows: PronosticoIaRow[];
  result: SelectPicksResult;
  backtest: WalkForwardBacktest | null;
};

export function rowsToHistoryCases(rows: PronosticoIaRow[]): HistoryCase[] {
  const out: HistoryCase[] = [];
  for (const row of rows) {
    if (row.resultado_clase !== 'acertado' && row.resultado_clase !== 'fallido') {
      continue;
    }
    const pModelo = parseProb(row.probabilidad);
    const cuota = parseCuotaDecimal(row);
    if (pModelo == null || cuota == null) continue;
    const p = pModelo > 1 ? pModelo / 100 : pModelo;
    if (!(p > 0 && p < 1)) continue;
    out.push({
      id: String(row.pronostico_id),
      fixtureId: Number(row.fixtureid) || 0,
      categoria: categoriaKey(row),
      torneo: torneoKey(row),
      pModelo: p,
      cuota,
      fixtureDateMs: parseFixtureDateMs(row.fixturedate),
      hit: row.resultado_clase === 'acertado',
    });
  }
  return out;
}

export function scorePronosticoRows(
  scoreRows: PronosticoIaRow[],
  historyRows: PronosticoIaRow[],
): {
  byId: Map<string, ScoredPick>;
  result: SelectPicksResult;
  backtest: WalkForwardBacktest;
  history: HistoryCase[];
} {
  const history = rowsToHistoryCases(historyRows);
  const inputs = scoreRows.map((row) => {
    const prob = parseProb(row.probabilidad);
    const cuota = parseCuotaDecimal(row);
    return {
      id: String(row.pronostico_id),
      fixtureId: Number(row.fixtureid) || 0,
      categoria: categoriaKey(row),
      torneo: torneoKey(row),
      probabilidad: prob ?? NaN,
      cuota: cuota ?? NaN,
      fixtureDateMs: parseFixtureDateMs(row.fixturedate),
    };
  });
  const result = selectPicks(inputs, history);
  const rejectedIds = new Set(result.rejectedSameFixture.map((r) => r.id));
  const byId = new Map<string, ScoredPick>();
  for (const s of result.rankedByComposite) {
    byId.set(
      s.id,
      rejectedIds.has(s.id)
        ? result.rejectedSameFixture.find((r) => r.id === s.id)!
        : s,
    );
  }
  const backtest = runWalkForwardBacktest(history);
  return { byId, result, backtest, history };
}

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function pp(x: number) {
  return `${(x * 100).toFixed(1)} pp`;
}

export function PickSelectionPanel({ rows, result, backtest }: Props) {
  const [copied, setCopied] = useState(false);
  const [openReasons, setOpenReasons] = useState<string | null>(null);
  const [rankMode, setRankMode] = useState<RankingMode>('composite');

  const rowById = useMemo(() => {
    const m = new Map<string, PronosticoIaRow>();
    for (const r of rows) m.set(String(r.pronostico_id), r);
    return m;
  }, [rows]);

  const bankPerf = useMemo(() => {
    let ac = 0;
    let fa = 0;
    let pe = 0;
    let stake = 0;
    let retorno = 0;
    for (const s of result.selected) {
      const row = rowById.get(s.id);
      const clase = row?.resultado_clase ?? 'pendiente';
      if (clase === 'acertado') {
        ac += 1;
        stake += 1;
        retorno += 1 / s.qImpl;
      } else if (clase === 'fallido') {
        fa += 1;
        stake += 1;
      } else {
        pe += 1;
      }
    }
    const resolved = ac + fa;
    const rate = resolved > 0 ? (100 * ac) / resolved : null;
    const profit = retorno - stake;
    const roi = stake > 0 ? (100 * profit) / stake : null;
    return { ac, fa, pe, resolved, rate, stake, profit, roi };
  }, [result.selected, rowById]);

  const rankedView = useMemo(() => {
    switch (rankMode) {
      case 'ev':
        return result.rankedByEv.filter((s) => s.label === 'seleccionable').slice(0, 25);
      case 'confianza':
        return result.rankedByConfianza
          .filter((s) => s.label === 'seleccionable')
          .slice(0, 25);
      case 'riesgo':
        return result.rankedByRiesgo
          .filter((s) => s.label === 'seleccionable')
          .slice(0, 25);
      default:
        return result.selected;
    }
  }, [rankMode, result]);

  if (rows.length === 0) return null;

  const extras = new Map(
    rows.map((r) => [
      String(r.pronostico_id),
      {
        local: String(r.equipo_local || r.teamshomename || '—'),
        visitante: String(r.equipo_visitante || r.teamsawayname || '—'),
        liga: [r.pais, r.liga].filter(Boolean).join(' · ') || '—',
        tipo: String(r.pronostico_tipo || '—'),
        pronostico: String(r.pronostico || '—'),
        resultado: r.resultado_clase,
        marcador:
          r.goalshome != null && r.goalsaway != null
            ? `${r.goalshome}-${r.goalsaway}`
            : null,
        mensaje: r.resultado_mensaje,
      },
    ]),
  );

  async function copyBank() {
    const md = buildSelectedPicksMarkdown(result.selected, extras);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mb-4 space-y-4 rounded-xl border border-emerald-500/20 bg-[#151b24] p-3 sm:mb-6 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-emerald-200">
            Motor de selección (cuantitativo)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Calibración jerárquica walk-forward · shrinkage k={CFG.shrinkK} · score solo
            ordena (no es probabilidad) · máx. 1 pick/partido
          </p>
        </div>
        <button
          type="button"
          onClick={copyBank}
          disabled={result.selected.length === 0}
          className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {copied ? 'Copiado' : `Copiar bank (${result.selected.length})`}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Visibles" value={String(rows.length)} />
        <Stat
          label="Seleccionables"
          value={String(result.counts.seleccionable)}
          accent="text-emerald-300"
        />
        <Stat
          label="Dudosos"
          value={String(result.counts.dudoso)}
          accent="text-amber-300"
        />
        <Stat
          label="Descartar"
          value={String(result.counts.descartar)}
          accent="text-red-300"
        />
      </div>

      {result.selected.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Bank ✓" value={String(bankPerf.ac)} accent="text-emerald-300" />
          <Stat label="Bank ✗" value={String(bankPerf.fa)} accent="text-red-300" />
          <Stat label="Bank pend." value={String(bankPerf.pe)} accent="text-slate-400" />
          <Stat
            label="% bank evaluados"
            value={bankPerf.rate != null ? `${bankPerf.rate.toFixed(1)}%` : '—'}
            accent="text-indigo-300"
          />
          <Stat
            label="ROI bank (1u)"
            value={
              bankPerf.roi != null
                ? `${bankPerf.profit >= 0 ? '+' : ''}${bankPerf.profit.toFixed(2)}u (${bankPerf.roi >= 0 ? '+' : ''}${bankPerf.roi.toFixed(0)}%)`
                : '—'
            }
            accent={
              bankPerf.roi == null
                ? 'text-slate-400'
                : bankPerf.roi >= 0
                  ? 'text-emerald-300'
                  : 'text-red-300'
            }
          />
        </div>
      )}

      {backtest && (
        <div className="rounded-lg border border-white/10 bg-[#0b0f14] p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Backtest walk-forward
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">{backtest.note}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Hist. resuelto" value={String(backtest.nHistory)} />
            <Stat
              label="Bank WF hits"
              value={
                backtest.byComposite.hitRate != null
                  ? `${(backtest.byComposite.hitRate * 100).toFixed(1)}% (${backtest.byComposite.hits}/${backtest.byComposite.nResolved})`
                  : '—'
              }
              accent="text-emerald-300"
            />
            <Stat
              label="ROI WF compuesto"
              value={
                backtest.byComposite.roi != null
                  ? `${backtest.byComposite.profit >= 0 ? '+' : ''}${backtest.byComposite.profit.toFixed(2)}u (${backtest.byComposite.roi >= 0 ? '+' : ''}${backtest.byComposite.roi.toFixed(0)}%)`
                  : '—'
              }
            />
            <Stat
              label="ROI WF por EV"
              value={
                backtest.byEv.roi != null
                  ? `${backtest.byEv.profit >= 0 ? '+' : ''}${backtest.byEv.profit.toFixed(2)}u (${backtest.byEv.roi >= 0 ? '+' : ''}${backtest.byEv.roi.toFixed(0)}%)`
                  : '—'
              }
            />
          </div>
          <p className="mt-2 text-[10px] text-slate-600">
            Max DD compuesto: {backtest.byComposite.maxDrawdown.toFixed(2)}u · Max DD EV:{' '}
            {backtest.byEv.maxDrawdown.toFixed(2)}u · picks WF:{' '}
            {backtest.byComposite.nSelected}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['composite', 'Compuesto (bank)'],
            ['ev', 'Valor esperado'],
            ['confianza', 'Confiabilidad'],
            ['riesgo', 'Riesgo ↑'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setRankMode(mode)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs ${
              rankMode === mode
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rankedView.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-[#0c1017] text-slate-400">
              <tr>
                <th className="px-2 py-2">Resultado</th>
                <th className="px-2 py-2">Score</th>
                <th className="px-2 py-2">Partido</th>
                <th className="px-2 py-2">Pick</th>
                <th className="px-2 py-2">p_mod</th>
                <th className="px-2 py-2">p_cal</th>
                <th className="px-2 py-2">q_impl</th>
                <th className="px-2 py-2">Edge</th>
                <th className="px-2 py-2">EV</th>
                <th className="px-2 py-2">SweetΔ</th>
                <th className="px-2 py-2">Conf</th>
                <th className="px-2 py-2">Riesgo</th>
                <th className="px-2 py-2">n_eff</th>
                <th className="px-2 py-2">IC95</th>
                <th className="px-2 py-2">Motivos</th>
              </tr>
            </thead>
            <tbody>
              {rankedView.map((s) => {
                const ex = extras.get(s.id);
                return (
                  <tr key={`${rankMode}-${s.id}`} className="border-t border-white/5 align-top">
                    <td className="px-2 py-2">
                      <ResultChip
                        clase={ex?.resultado ?? 'pendiente'}
                        marcador={ex?.marcador}
                        mensaje={ex?.mensaje}
                      />
                    </td>
                    <td className="px-2 py-2 font-semibold text-emerald-300">
                      {s.score.toFixed(1)}
                      <div className="text-[9px] font-normal text-slate-600">orden</div>
                    </td>
                    <td className="px-2 py-2 text-slate-200">
                      {ex?.local} vs {ex?.visitante}
                      <div className="text-[10px] text-slate-500">{ex?.liga}</div>
                    </td>
                    <td className="max-w-[200px] px-2 py-2 text-slate-300">
                      <div className="line-clamp-2">{ex?.pronostico}</div>
                      <div className="text-[10px] text-slate-500">{ex?.tipo}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-300">{pct(s.pModelo)}</td>
                    <td className="px-2 py-2 text-slate-300">
                      {pct(s.pCalibrada)}
                      <div className="text-[9px] text-slate-600">{s.calibLevel}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-300">{pct(s.qImpl)}</td>
                    <td className="px-2 py-2 text-slate-300">{pp(s.edgeVsMarket)}</td>
                    <td className="px-2 py-2 text-slate-300">
                      {(s.ev * 100).toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-slate-300">{pp(s.distSweetSpot)}</td>
                    <td className="px-2 py-2 text-slate-300">
                      {(s.confianza * 100).toFixed(0)}%
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {(s.riesgo * 100).toFixed(0)}%
                    </td>
                    <td className="px-2 py-2 text-slate-300">{s.nEff}</td>
                    <td className="px-2 py-2 text-slate-400">
                      {s.ci95
                        ? `${pct(s.ci95.low)}–${pct(s.ci95.high)}`
                        : '—'}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-indigo-300 hover:text-indigo-200"
                        onClick={() =>
                          setOpenReasons((id) => (id === s.id ? null : s.id))
                        }
                      >
                        {openReasons === s.id ? 'Ocultar' : 'Ver'}
                      </button>
                      {openReasons === s.id && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-slate-500">
                          {s.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Ningún pick supera los gates (calibración jerárquica, EV, edge, cuota ≥{' '}
          {CFG.minOdds}, score compuesto ≥ {CFG.scoreSelect}) con la vista filtrada
          actual.
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold sm:text-lg ${accent ?? 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}

function ResultChip({
  clase,
  marcador,
  mensaje,
}: {
  clase: string;
  marcador?: string | null;
  mensaje?: string | null;
}) {
  const styles =
    clase === 'acertado'
      ? 'bg-emerald-500/20 text-emerald-300'
      : clase === 'fallido'
        ? 'bg-red-500/20 text-red-300'
        : 'bg-slate-500/20 text-slate-300';
  const label =
    clase === 'acertado' ? 'Acertado' : clase === 'fallido' ? 'Fallido' : 'Pendiente';
  return (
    <div>
      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles}`}>
        {label}
      </span>
      {marcador && (
        <div className="mt-0.5 text-[10px] text-slate-500">{marcador}</div>
      )}
      {mensaje && (
        <div className="mt-0.5 max-w-[140px] truncate text-[10px] text-slate-600" title={mensaje}>
          {mensaje}
        </div>
      )}
    </div>
  );
}

export function SelectionLabelBadge({ label }: { label: PickLabel }) {
  const styles =
    label === 'seleccionable'
      ? 'bg-emerald-500/20 text-emerald-300'
      : label === 'dudoso'
        ? 'bg-amber-500/20 text-amber-300'
        : 'bg-red-500/20 text-red-300';
  const text =
    label === 'seleccionable'
      ? 'Seleccionable'
      : label === 'dudoso'
        ? 'Dudoso'
        : 'Descartar';
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles}`}>
      {text}
    </span>
  );
}
