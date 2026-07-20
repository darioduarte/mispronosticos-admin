import type { SyncPartidoStatsResponse, SyncStatsPlanFixture } from '@/lib/types';

export type SyncRangeResultEntry = {
  fixtureId: number;
  label: string;
  source: 'flb' | 'api-football' | 'none' | 'failed';
  reasonCode?: string;
  reasonLabel?: string;
  detail?: string;
};

export type SyncRangeSourceBreakdown = {
  flb: SyncRangeResultEntry[];
  apiFootball: SyncRangeResultEntry[];
  none: SyncRangeResultEntry[];
  failed: SyncRangeResultEntry[];
};

export function emptySourceBreakdown(): SyncRangeSourceBreakdown {
  return { flb: [], apiFootball: [], none: [], failed: [] };
}

const API_FALLBACK_LABELS: Record<string, string> = {
  flb_disabled: 'FLB desactivado en el servidor',
  flb_no_api_key: 'FLB sin key RapidAPI (LIVE_FOOTBALL_DATA_KEY)',
  missing_fixture_row: 'Sin datos del fixture en BD',
  no_flb_event_mapping: 'No se pudo mapear el partido a un evento FLB',
  flb_stats_empty: 'FLB devolvió stats vacías o sin métricas mapeables',
  flb_stats_unavailable: 'FLB vinculado pero sin stats detalladas (cobertura baja)',
  flb_fetch_failed: 'Error al consultar estadísticas en FLB',
  api_football_embedded: 'Stats embebidas en GET /fixtures',
  api_football_dedicated: 'Stats desde GET /fixtures/statistics',
  api_football_fixtures_ids: 'Stats embebidas vía GET /fixtures?ids=',
  api_football_fetch_failed: 'API-Football no devolvió estadísticas',
  api_football_rate_limited: 'API-Football rate limit (429)',
  api_football_stats_empty: 'API-Football sin stats para este partido',
};

export function labelForSourceReason(code?: string | null) {
  if (!code) return 'Fallback a API-Football (motivo no registrado)';
  const base = code.replace(/_dedicated$/, '');
  return API_FALLBACK_LABELS[base] || API_FALLBACK_LABELS[code] || code.replaceAll('_', ' ');
}

function normalizeStatsSource(raw?: string | null): 'flb' | 'api-football' | 'none' {
  const s = String(raw || '').toLowerCase();
  if (s === 'flb' || s === 'live-football-data') return 'flb';
  if (s === 'api-football' || s === 'apif' || s === 'api_football') return 'api-football';
  return 'none';
}

export function classifySyncResult(
  result: SyncPartidoStatsResponse,
  fx: SyncStatsPlanFixture,
): { bucket: keyof SyncRangeSourceBreakdown; entry: SyncRangeResultEntry; logLine: string } {
  const fixtureId = fx.fixtureId;
  const label = `${fx.homeTeam} vs ${fx.awayTeam}`;
  const base = { fixtureId, label };

  if (!result.success) {
    const detail = result.error || result.message || 'error de sincronización';
    return {
      bucket: 'failed',
      entry: { ...base, source: 'failed', detail },
      logLine: `✗ ${fixtureId} ${label} — ${detail}`,
    };
  }

  const src = normalizeStatsSource(result.statisticsSource || result.statsSource);
  const persisted = result.statisticsPersisted !== false;

  if (src === 'flb' && persisted) {
    const detail = result.statisticsSourceDetail || undefined;
    return {
      bucket: 'flb',
      entry: { ...base, source: 'flb', detail },
      logLine: `✓ FLB ${fixtureId} ${label}${detail ? ` (${detail})` : ''}`,
    };
  }

  if (src === 'api-football' && persisted) {
    const reasonCode = result.statisticsSourceReason || undefined;
    const reasonLabel = labelForSourceReason(reasonCode);
    const detail = result.statisticsSourceDetail || result.message || undefined;
    return {
      bucket: 'apiFootball',
      entry: {
        ...base,
        source: 'api-football',
        reasonCode,
        reasonLabel,
        detail,
      },
      logLine: `◆ APIF ${fixtureId} ${label} — ${reasonLabel}`,
    };
  }

  const detail = result.message || result.error || 'sin estadísticas persistidas';
  return {
    bucket: 'none',
    entry: { ...base, source: 'none', detail },
    logLine: `○ ${fixtureId} ${label} — ${detail}`,
  };
}

export function appendToBreakdown(
  breakdown: SyncRangeSourceBreakdown,
  bucket: keyof SyncRangeSourceBreakdown,
  entry: SyncRangeResultEntry,
): SyncRangeSourceBreakdown {
  return {
    ...breakdown,
    [bucket]: [...breakdown[bucket], entry],
  };
}

function formatEntryLines(entries: SyncRangeResultEntry[], opts?: { showReason?: boolean }) {
  if (!entries.length) return ['  (ninguno)'];
  return entries.flatMap((e, idx) => {
    const lines = [`${idx + 1}. [${e.fixtureId}] ${e.label}`];
    if (opts?.showReason && e.reasonLabel) {
      lines.push(`   Motivo: ${e.reasonLabel}`);
    }
    if (e.detail) {
      lines.push(`   Detalle: ${e.detail}`);
    }
    return lines;
  });
}

function summarizeApifReasons(entries: SyncRangeResultEntry[]) {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = e.reasonLabel || e.reasonCode || 'Sin motivo registrado';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export type SyncRangeReportInput = {
  desde: string;
  hasta: string;
  onlyMissing: boolean;
  pauseMs: number;
  phase: 'planning' | 'syncing' | 'done' | 'cancelled';
  total: number;
  current: number;
  sourceBreakdown: SyncRangeSourceBreakdown;
};

export function formatSyncRangeReport(input: SyncRangeReportInput): string {
  const bd = input.sourceBreakdown;
  const flb = bd.flb.length;
  const apif = bd.apiFootball.length;
  const none = bd.none.length;
  const failed = bd.failed.length;
  const processed = flb + apif + none + failed;

  const phaseLabel = {
    planning: 'Planificando',
    syncing: 'En curso',
    done: 'Completado',
    cancelled: 'Cancelado',
  }[input.phase];

  const lines: string[] = [
    'INFORME — SINCRONIZACIÓN DE ESTADÍSTICAS (FLB)',
    '='.repeat(48),
    `Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
    `Rango: ${input.desde} → ${input.hasta}`,
    `Modo: ${input.onlyMissing ? 'solo partidos sin estadísticas' : 'todos los destacados del rango'}`,
    `Pausa entre partidos: ${input.pauseMs > 0 ? `${input.pauseMs / 1000} s` : 'sin pausa'}`,
    `Estado: ${phaseLabel}`,
    `Progreso: ${input.current}/${input.total} partidos en cola · ${processed} procesados en este informe`,
    '',
    'RESUMEN',
    '-'.repeat(48),
    `FLB (Live-Football-Data):     ${flb}`,
    `API-Football (fallback):    ${apif}`,
    `Sin estadísticas guardadas: ${none}`,
    `Fallos de sincronización:   ${failed}`,
    '',
  ];

  if (apif > 0) {
    lines.push('MOTIVOS API-FOOTBALL (agrupado)', '-'.repeat(48));
    for (const [reason, count] of summarizeApifReasons(bd.apiFootball)) {
      lines.push(`  · ${count}× ${reason}`);
    }
    lines.push('');
  }

  lines.push(`DETALLE FLB (${flb})`, '-'.repeat(48), ...formatEntryLines(bd.flb), '');
  lines.push(
    `DETALLE API-FOOTBALL — FALLBACK (${apif})`,
    '-'.repeat(48),
    ...formatEntryLines(bd.apiFootball, { showReason: true }),
    '',
  );

  if (none > 0) {
    lines.push(`SIN ESTADÍSTICAS (${none})`, '-'.repeat(48), ...formatEntryLines(bd.none), '');
  }
  if (failed > 0) {
    lines.push(`FALLOS (${failed})`, '-'.repeat(48), ...formatEntryLines(bd.failed), '');
  }

  lines.push('—', 'Fin del informe');
  return lines.join('\n');
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback abajo */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
