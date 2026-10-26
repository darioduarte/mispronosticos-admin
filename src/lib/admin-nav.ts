export type NavItem = { href: string; label: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/monitoreo', label: 'Monitoreo' },
      { href: '/notificaciones', label: 'Notificaciones' },
    ],
  },
  {
    id: 'operacion-vivo',
    label: 'Operación en vivo',
    items: [
      { href: '/control-analisis-vivo', label: 'Control de análisis en vivo' },
      { href: '/control-analisis-prepartido', label: 'Control de análisis prepartido' },
      { href: '/control-crons', label: 'Control de crons' },
      { href: '/parametros-en-vivo', label: 'Parámetros en vivo' },
    ],
  },
  {
    id: 'datos',
    label: 'Datos y partidos',
    items: [
      { href: '/partidos', label: 'Partidos' },
      { href: '/historias', label: 'Historias' },
      { href: '/ligas', label: 'Ligas' },
      { href: '/estadisticas-ligas-destacadas', label: 'Estadísticas ligas destacadas' },
      { href: '/arbitros', label: 'Árbitros' },
    ],
  },
  {
    id: 'ia',
    label: 'Pronósticos IA',
    items: [
      { href: '/pronosticos-ia', label: 'Pronósticos IA' },
      { href: '/pronosticos-ia-vivo', label: 'Pronósticos IA vivo' },
      { href: '/errores-cuota-ia', label: 'Errores de cuota' },
      { href: '/predictions-table', label: 'Tabla predicciones' },
    ],
  },
  {
    id: 'analisis-expertos',
    label: 'Análisis de expertos',
    items: [
      { href: '/analisis-expertos/pronosticos', label: 'Pronósticos' },
      { href: '/analisis-expertos/estados', label: 'Estados de pronóstico' },
      { href: '/analisis-expertos/deportes', label: 'Deportes' },
      { href: '/analisis-expertos/campeonatos', label: 'Campeonatos' },
      { href: '/analisis-expertos/noticias', label: 'Noticias' },
    ],
  },
  {
    id: 'negocio',
    label: 'Negocio',
    items: [
      { href: '/suscripciones', label: 'Suscripciones' },
      { href: '/trials', label: 'Trials' },
      { href: '/promociones', label: 'Vendedores y códigos' },
      { href: '/documentos-legales', label: 'Documentos legales' },
      { href: '/sugerencias', label: 'Sugerencias' },
    ],
  },
  {
    id: 'errores',
    label: 'Errores y pagos',
    items: [
      { href: '/errores', label: 'Errores' },
      { href: '/errores-pago', label: 'Errores de pago' },
      { href: '/webhooks-pago', label: 'Webhooks de pago' },
    ],
  },
];

export function normalizeNavQuery(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(`${href}/`)) return true;
  return false;
}

export function activeNavGroupId(groups: NavGroup[], pathname: string) {
  return (
    groups.find((group) => group.items.some((item) => isActivePath(pathname, item.href)))?.id ??
    null
  );
}

export function filterNavGroups(groups: NavGroup[], query: string): NavGroup[] {
  const needle = normalizeNavQuery(query);
  if (!needle) return groups;
  return groups
    .map((group) => {
      if (normalizeNavQuery(group.label).includes(needle)) return group;
      const items = group.items.filter((item) => normalizeNavQuery(item.label).includes(needle));
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
}
