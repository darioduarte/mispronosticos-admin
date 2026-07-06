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
  missing_fixture_row: 'Sin datos del fixture en BD',
  no_flb_event_mapping: 'No se pudo mapear el partido a un evento FLB',
  flb_stats_empty: 'FLB devolvió stats vacías o sin métricas mapeables',
  flb_fetch_failed: 'Error al consultar estadísticas en FLB',
  api_football_embedded: 'Stats embebidas en GET /fixtures',
  api_football_dedicated: 'Stats desde GET /fixtures/statistics',
  api_football_fetch_failed: 'API-Football no devolvió estadísticas',
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
