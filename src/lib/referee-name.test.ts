/**
 * Tests de normalización de nombre de árbitro (sin red).
 *   npx tsx --test src/lib/referee-name.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRefereeNameLinked, normalizeRefereeKey } from './referee-name';

describe('normalizeRefereeKey', () => {
  it('quita país, tildes y colapsa espacios', () => {
    assert.equal(normalizeRefereeKey('Mateu Lahoz, Spain'), 'mateu lahoz');
    assert.equal(normalizeRefereeKey('  José  Núñez  '), 'jose nunez');
    assert.equal(normalizeRefereeKey('   '), null);
    assert.equal(normalizeRefereeKey(null), null);
  });
});

describe('isRefereeNameLinked', () => {
  const aliases = [
    { aliasRaw: 'Mateu Lahoz', aliasKey: 'mateu lahoz' },
    { aliasRaw: 'A. Hernandez' },
  ];

  it('vacío cuenta como vinculado; compara raw y key', () => {
    assert.equal(isRefereeNameLinked('  ', aliases), true);
    assert.equal(isRefereeNameLinked('Mateu Lahoz', aliases), true);
    assert.equal(isRefereeNameLinked('Mateu Lahoz, Spain', aliases), true);
    assert.equal(isRefereeNameLinked('A. Hernández', aliases), true);
    assert.equal(isRefereeNameLinked('Otro Arbitro', aliases), false);
  });
});
