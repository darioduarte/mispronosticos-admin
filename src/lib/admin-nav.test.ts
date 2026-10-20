/**
 * Filtro del menú admin (sin DOM).
 *   npx tsx --test src/lib/admin-nav.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeNavGroupId, filterNavGroups, NAV_GROUPS } from './admin-nav';

describe('filterNavGroups', () => {
  it('devuelve todos los grupos si la búsqueda está vacía', () => {
    assert.equal(filterNavGroups(NAV_GROUPS, '   ').length, NAV_GROUPS.length);
  });

  it('encuentra una opción aunque la consulta lleve acentos o mayúsculas', () => {
    const found = filterNavGroups(NAV_GROUPS, 'ARBITROS');
    assert.deepEqual(
      found.map((group) => group.items.map((item) => item.label)),
      [['Árbitros']],
    );
  });

  it('si coincide el grupo, conserva todas sus opciones', () => {
    const found = filterNavGroups(NAV_GROUPS, 'pagos');
    assert.equal(found.length, 1);
    assert.equal(found[0]?.id, 'errores');
    assert.equal(found[0]?.items.length, 3);
  });

  it('no devuelve grupos sin coincidencias', () => {
    assert.deepEqual(filterNavGroups(NAV_GROUPS, 'zzzz-no-existe'), []);
  });
});

describe('activeNavGroupId', () => {
  it('abre el grupo de la ruta actual, incluidas las subrutas', () => {
    assert.equal(
      activeNavGroupId(NAV_GROUPS, '/analisis-expertos/pronosticos/123'),
      'analisis-expertos',
    );
  });
});
