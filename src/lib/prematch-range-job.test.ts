import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPreMatchJobWatching,
  preMatchJobBanner,
  showPreMatchProgressChip,
} from './prematch-range-job';

describe('ventana del rango prepartido', () => {
  it('un lote pausado sigue visible y no se anuncia como cancelado', () => {
    assert.equal(isPreMatchJobWatching('paused_batch'), true);
    assert.equal(isPreMatchJobWatching('generating'), true);
    assert.equal(isPreMatchJobWatching('done'), false);
    assert.equal(preMatchJobBanner('paused_batch'), 'Análisis IA prepartido en segundo plano');
    assert.equal(preMatchJobBanner('cancelled'), 'Análisis IA prepartido cancelado');
  });

  it('cerrar un lote pausado no esconde el acceso al progreso', () => {
    assert.equal(showPreMatchProgressChip('paused_batch', false, 'job-1', 'job-1'), true);
    assert.equal(showPreMatchProgressChip('done', false, 'job-1', 'job-1'), false);
    assert.equal(showPreMatchProgressChip('generating', true, null, 'job-1'), false);
  });
});
