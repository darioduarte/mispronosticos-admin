/**
 * Partición del prompt en vivo guardado.
 *   npx tsx --test src/lib/live-prompt-lab.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  composeLiveLabPrompt,
  readLabDraft,
  splitLiveStoredPrompt,
  writeLabDraft,
} from './live-prompt-lab';

const STORED = `BLOQUE 4 — partido
Barcelona contra Arsenal. Minuto 67.

══════════════════════════════════════════
BLOQUE 6 — RAZONAMIENTO PREVIO (interno)
══════════════════════════════════════════
Exactamente 3 pronósticos.`;

describe('splitLiveStoredPrompt', () => {
  it('deja el partido fuera de las reglas', () => {
    const parts = splitLiveStoredPrompt(STORED);
    assert.equal(parts.split, true);
    assert.match(parts.context, /Barcelona contra Arsenal/);
    assert.doesNotMatch(parts.context, /BLOQUE 6/);
    assert.match(parts.rules, /Exactamente 3/);
  });

  it('arma la copia de prueba con el mismo partido', () => {
    const parts = splitLiveStoredPrompt(STORED);
    const lab = composeLiveLabPrompt(parts.context, 'Publica de 0 a 3.', 'LAB', true);
    assert.match(lab, /Barcelona contra Arsenal/);
    assert.match(lab, /Publica de 0 a 3/);
    assert.match(lab, /ediciones guardadas/);
    assert.doesNotMatch(lab, /Exactamente 3/);
  });
});

describe('borrador del navegador', () => {
  it('ignora un borrador vacío', () => {
    const storage = {
      value: '{"version":"lab-v1","rules":"  "}',
      getItem() {
        return this.value;
      },
      setItem(key: string, value: string) {
        assert.equal(key, 'mp-live-prompt-lab-draft');
        this.value = value;
      },
    };
    assert.equal(readLabDraft(storage), null);
    writeLabDraft(storage, { version: 'lab-v1', rules: 'Nueva política' });
    assert.equal(readLabDraft(storage)?.rules, 'Nueva política');
  });
});
