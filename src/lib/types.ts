export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};

export type PronosticoIaRow = {
  pronostico_id: string;
  fixtureid: number;
  fecha: string;
  fixturedate?: string | null;
  pais: string | null;
  liga: string | null;
  equipo_local?: string | null;
  equipo_visitante?: string | null;
  teamshomename: string | null;
  teamsawayname: string | null;
  pronostico_tipo: string | null;
  pronostico: string | null;
  categoria_pronostico?: string | null;
  categoria_normalizada: string | null;
  linea_normalizada: string | null;
  equipo_normalizado: string | null;
  probabilidad: string | number | null;
  resultado_acertado: boolean | null;
  resultado_mensaje: string | null;
  resultado_clase: 'acertado' | 'fallido' | 'pendiente';
  estado_partido: string | null;
  goalshome: number | null;
  goalsaway: number | null;
  cuota_display: string | null;
  cuota_decimal: number | null;
  cuota_llm_decimal: number | null;
  cuota_bookmaker?: string | null;
  cuota_value_text?: string | null;
  cuota_bet_name?: string | null;
  totalUsuariosGuardado?: number;
};

export type FixtureStatisticsResponse = {
  success: boolean;
  dataSource?: string;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  fixturereferee?: string | null;
  marcador: {
    estado: string | null;
    marcadorFinal: string | null;
    marcadorDescanso: string | null;
    golesTotales: number | null;
  };
  rows: { tipo: string; local: string; visitante: string }[];
  error?: string;
};

export type PronosticosIaMeta = {
  desde: string;
  hasta: string;
  total: number;
  acertados: number;
  fallidos: number;
  pendientes: number;
  categorias: string[];
  torneos: { key: string; pais: string; liga: string }[];
};

export type PronosticosIaResponse = {
  success: boolean;
  data: PronosticoIaRow[];
  meta: PronosticosIaMeta;
  message?: string;
};

export type PromptResponse = {
  success: boolean;
  fullText?: string;
  prompt?: string;
  fixtureId?: number;
  error?: string;
};

export type MelbetOddItem = {
  linea?: string;
  betName?: string;
  odd?: string | number;
  bookmaker?: string;
  value?: string;
};

export type MelbetOddsStructured = Record<string, MelbetOddItem[]>;

export type MelbetOddsResponse = {
  matched?: boolean;
  link?: string;
  reason?: string;
  odds?: unknown;
  oddsStructured?: MelbetOddsStructured;
  debug?: Record<string, unknown>;
  error?: string;
};

export type ComparadorRow = {
  pronostico_id?: string;
  pronostico_tipo?: string;
  pronostico?: string;
  probabilidad?: string | number | null;
  categoria_normalizada?: string | null;
  resultado_clase?: string;
  resultado_mensaje?: string | null;
};

export type ComparadorResponse = {
  success: boolean;
  meta?: {
    goalshome?: number | null;
    goalsaway?: number | null;
    estado_partido?: string | null;
  };
  analisis_general?: string | null;
  summaryPersisted?: { total: number; acertados: number; fallidos: number; pendientes: number };
  summaryPegados?: { total: number; acertados: number; fallidos: number; pendientes: number };
  veredicto?: { texto?: string };
  persisted?: ComparadorRow[];
  pegados?: ComparadorRow[];
  error?: string;
};

export type OddsReferenciaResponse = {
  success: boolean;
  odds?: Record<string, MelbetOddItem[] | unknown>;
  error?: string;
};

export type PartidoRow = {
  fixtureid: number;
  fixturedate?: string | null;
  fechaDisplay: string;
  liga: string;
  pais: string;
  leagueid?: number | null;
  local: string;
  visitante: string;
  estado: string;
  estadoBadgeClass: 'ns' | 'ft' | 'live' | 'other';
  goalshome?: number | string | null;
  goalsaway?: number | string | null;
  marcador: string;
  fixturereferee: string;
  sinArbitro: boolean;
  tieneEstadisticas: boolean;
};

export type PartidosMeta = {
  desde: string;
  hasta: string;
  total: number;
  totalEnRango: number;
  sinArbitroCount: number;
  sinStatsCount: number;
  ligas: string[];
  paises: string[];
  sinArbitroFilter: boolean;
  sinStatsFilter: boolean;
};

export type PartidosResponse = {
  success: boolean;
  data: PartidoRow[];
  meta: PartidosMeta;
  error?: string;
};

export type RefereeSearchItem = {
  name: string;
  count?: number | null;
  disciplineLabel?: string;
  disciplineStatus?: string;
  recencyLabel?: string;
  lastMatchDateDisplay?: string | null;
  daysSinceLastMatch?: number | null;
};

export type RefereeSearchResponse = {
  success: boolean;
  query: string;
  referees: RefereeSearchItem[];
  needsQuery?: boolean;
  minChars?: number | null;
};

export type RefereeHistoryMatch = {
  fixtureId?: number;
  fecha?: string;
  fechaDisplay?: string;
  partido?: string;
  amarillas?: number | string | null;
  rojas?: number | string | null;
  faltas?: number | string | null;
};

export type RefereeHistoryResponse = {
  success: boolean;
  name?: string;
  summary?: Record<string, unknown>;
  summaryLabel?: string;
  matches?: RefereeHistoryMatch[];
  error?: string;
};

export type SyncStatsResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  daysProcessed?: number;
  fixturesUpdated?: number;
  [key: string]: unknown;
};

export type RepairRefereesResponse = {
  success: boolean;
  desde?: string;
  hasta?: string;
  daysProcessed?: number;
  totalCandidates?: number;
  totalUpdated?: number;
  stillMissingCount?: number;
  failedCount?: number;
  error?: string;
};

export type PartidoStatisticsApiResponse = {
  success: boolean;
  fixtureId?: number;
  fixtureApi?: unknown;
  statisticsApi?: unknown;
  statisticsApiError?: string | null;
  error?: string;
};
