/**
 * Tests de matching de cuotas live (sin red).
 *   npx tsx --test src/lib/live-odds-match.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findLiveOddForTipo,
  inferTipoSide,
  isCuotaSospechosa,
  normalizeOddsText,
  parseLiveOddsSections,
  promptLineSectionMap,
} from './live-odds-match';

const ODDS = [
  'Goals:',
  'Over (2.5): 1.90',
  'Under (2.5): 1.85',
  '',
  'Home Goals:',
  'Over (0.5): 1.40',
  'Under (0.5): 2.80',
  '',
  'Away Goals:',
  '- Over 0.5 : 1.55',
  '- Under 0.5 : 2.40',
].join('\n');

describe('normalizeOddsText', () => {
  it('normaliza tildes y recorta', () => {
    assert.equal(normalizeOddsText('  Más de 2,5  '), 'mas de 2,5');
  });
});

describe('inferTipoSide', () => {
  it('detecta over/under en español e inglés', () => {
    assert.equal(inferTipoSide('Menos 2.5 goles'), 'under');
    assert.equal(inferTipoSide('Over 2.5'), 'over');
    assert.equal(inferTipoSide('1X2 local'), null);
  });
});

describe('isCuotaSospechosa', () => {
  it('marca under ≥4, over ≤1.08 y cuotas ≥8', () => {
    assert.equal(
      isCuotaSospechosa({ tipo: 'Under 2.5', cuota_casa: '4.20' }),
      true,
    );
    assert.equal(
      isCuotaSospechosa({ tipo: 'Over 2.5', cuota_casa_display: '1.05' }),
      true,
    );
    assert.equal(isCuotaSospechosa({ tipo: '1X2', cuota_casa: 9 }), true);
    assert.equal(isCuotaSospechosa({ tipo: 'Under 2.5', cuota_casa: '1.85' }), false);
    assert.equal(isCuotaSospechosa({ tipo: 'Over 2.5', cuota_casa: 'n/a' }), false);
  });
});

describe('parseLiveOddsSections', () => {
  it('parsea cabeceras y líneas Over/Under', () => {
    const sections = parseLiveOddsSections(ODDS);
    assert.equal(sections.length, 3);
    assert.equal(sections[0].name, 'Goals');
    assert.equal(sections[0].lines.length, 2);
    assert.equal(sections[0].lines[0].side, 'over');
    assert.equal(sections[0].lines[0].line, 2.5);
    assert.equal(sections[0].lines[0].odd, 1.9);
    assert.equal(sections[2].name, 'Away Goals');
    assert.equal(sections[2].lines[1].side, 'under');
  });
});

describe('findLiveOddForTipo', () => {
  it('empareja under 2.5 del bloque de partido', () => {
    const match = findLiveOddForTipo({
      tipo: 'Menos 2.5',
      oddsText: ODDS,
      storedCuota: 1.85,
    });
    assert.ok(match);
    assert.equal(match!.side, 'under');
    assert.equal(match!.linea, 2.5);
    assert.equal(match!.odd, 1.85);
    assert.equal(match!.oppositeOdd, 1.9);
    assert.equal(match!.swapped, false);
    assert.equal(match!.section, 'Goals');
  });

  it('usa el bloque local/visitante y detecta cuota invertida', () => {
    const home = findLiveOddForTipo({
      tipo: 'Over 0.5 local',
      oddsText: ODDS,
      homeTeam: 'Barcelona',
      awayTeam: 'Madrid',
    });
    assert.ok(home);
    assert.equal(home!.section, 'Home Goals');
    assert.equal(home!.odd, 1.4);

    const swapped = findLiveOddForTipo({
      tipo: 'Menos 2.5',
      oddsText: ODDS,
      storedCuota: 1.9,
    });
    assert.ok(swapped);
    assert.equal(swapped!.swapped, true);
    assert.equal(swapped!.odd, 1.85);
  });

  it('devuelve null si falta lado, línea o texto', () => {
    assert.equal(findLiveOddForTipo({ tipo: '1X2', oddsText: ODDS }), null);
    assert.equal(findLiveOddForTipo({ tipo: 'Under 2.5' }), null);
  });
});

describe('promptLineSectionMap', () => {
  it('arrastra la cabecera de sección por línea', () => {
    const map = promptLineSectionMap(ODDS);
    const goalsIdx = ODDS.split('\n').findIndex((l) => l.startsWith('Goals:'));
    const overIdx = ODDS.split('\n').findIndex((l) => l.includes('Over (2.5)'));
    assert.equal(map[goalsIdx], 'Goals');
    assert.equal(map[overIdx], 'Goals');
  });
});
