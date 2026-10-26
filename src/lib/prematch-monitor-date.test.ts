/**
 * Fecha del radar prepartido.
 *   npx tsx --test src/lib/prematch-monitor-date.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bogotaCalendarDate } from './prematch-monitor-date';

describe('bogotaCalendarDate', () => {
  it('usa el calendario de Bogotá y suma días sin depender de la hora UTC', () => {
    const lateUtc = new Date('2026-10-27T03:30:00.000Z');
    assert.equal(bogotaCalendarDate(lateUtc, 0), '2026-10-26');
    assert.equal(bogotaCalendarDate(lateUtc, 1), '2026-10-27');
  });
});
