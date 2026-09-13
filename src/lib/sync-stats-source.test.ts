/**
 * Tests de clasificación de fuente de stats (sin red / sin clipboard).
 *   npx tsx --test src/lib/sync-stats-source.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendToBreakdown,
  classifySyncResult,
  emptySourceBreakdown,
  formatSyncRangeReport,
  labelForSourceReason,
} from './sync-stats-source';
import type { SyncPartidoStatsResponse, SyncStatsPlanFixture } from './types';

const fx: SyncStatsPlanFixture = {
  fixtureId: 42,
  date: '2026-01-01',
  homeTeam: 'Local',
  awayTeam: 'Visitante',
  league: 'Liga',
  hasStats: false,
};

function result(partial: Partial<SyncPartidoStatsResponse>): SyncPartidoStatsResponse {
  return { success: true, ...partial };
}

describe('labelForSourceReason', () => {
  it('traduce códigos conocidos y formatea el resto', () => {
    assert.equal(
      labelForSourceReason('no_flb_event_mapping'),
      'No se pudo mapear el partido a un evento FLB',
    );
    assert.equal(
      labelForSourceReason('api_football_dedicated'),
      'Stats desde GET /fixtures/statistics',
    );
    assert.match(labelForSourceReason(null), /motivo no registrado/);
    assert.equal(labelForSourceReason('codigo_nuevo'), 'codigo nuevo');
  });
});

describe('classifySyncResult', () => {
  it('separa failed / flb / api-football / none', () => {
    const failed = classifySyncResult(result({ success: false, error: 'timeout' }), fx);
    assert.equal(failed.bucket, 'failed');
    assert.equal(failed.entry.source, 'failed');
    assert.match(failed.logLine, /timeout/);

    const flb = classifySyncResult(
      result({ statisticsSource: 'live-football-data', statisticsPersisted: true }),
      fx,
    );
    assert.equal(flb.bucket, 'flb');
    assert.equal(flb.entry.source, 'flb');

    const apif = classifySyncResult(
      result({
        statisticsSource: 'api-football',
        statisticsPersisted: true,
        statisticsSourceReason: 'flb_stats_empty',
      }),
      fx,
    );
    assert.equal(apif.bucket, 'apiFootball');
    assert.equal(apif.entry.reasonCode, 'flb_stats_empty');
    assert.match(String(apif.entry.reasonLabel), /stats vacías/);

    const none = classifySyncResult(
      result({ statisticsSource: 'flb', statisticsPersisted: false, message: 'sin persistir' }),
      fx,
    );
    assert.equal(none.bucket, 'none');
    assert.equal(none.entry.source, 'none');
  });
});

describe('appendToBreakdown y formatSyncRangeReport', () => {
  it('acumula buckets y arma el informe', () => {
    let bd = emptySourceBreakdown();
    const flb = classifySyncResult(
      result({ statsSource: 'flb', statisticsPersisted: true, statisticsSourceDetail: 'ok' }),
      fx,
    );
    const apif = classifySyncResult(
      result({
        statisticsSource: 'apif',
        statisticsPersisted: true,
        statisticsSourceReason: 'no_flb_event_mapping',
      }),
      { ...fx, fixtureId: 43, homeTeam: 'A', awayTeam: 'B' },
    );
    bd = appendToBreakdown(bd, flb.bucket, flb.entry);
    bd = appendToBreakdown(bd, apif.bucket, apif.entry);
    assert.equal(bd.flb.length, 1);
    assert.equal(bd.apiFootball.length, 1);

    const report = formatSyncRangeReport({
      desde: '2026-01-01',
      hasta: '2026-01-02',
      onlyMissing: true,
      pauseMs: 1500,
      phase: 'done',
      total: 2,
      current: 2,
      sourceBreakdown: bd,
    });
    assert.match(report, /Rango: 2026-01-01 → 2026-01-02/);
    assert.match(report, /solo partidos sin estadísticas/);
    assert.match(report, /1\.5 s/);
    assert.match(report, /Completado/);
    assert.match(report, /FLB \(Live-Football-Data\):\s+1/);
    assert.match(report, /MOTIVOS API-FOOTBALL/);
    assert.match(report, /No se pudo mapear/);
    assert.match(report, /Fin del informe/);
  });
});
