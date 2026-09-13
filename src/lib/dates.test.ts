/**
 * Tests de todayBogota (formato, sin red).
 *   npx tsx --test src/lib/dates.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { todayBogota } from './dates';

describe('todayBogota', () => {
  it('devuelve YYYY-MM-DD en America/Bogota', () => {
    const got = todayBogota();
    assert.match(got, /^\d{4}-\d{2}-\d{2}$/);
    const expected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    assert.equal(got, expected);
  });
});
