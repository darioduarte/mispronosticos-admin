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

export type H2HMatchRow = {
  fixtureid: number;
  fechaDisplay: string;
  local: string;
  visitante: string;
  marcador: string;
  estado: string;
  estadoBadgeClass: 'ns' | 'ft' | 'live' | 'other';
  liga: string;
  tieneEstadisticas: boolean;
};

export type FixtureH2HResponse = {
  success: boolean;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  betweenMatches: H2HMatchRow[];
  homeLast5: H2HMatchRow[];
  awayLast5: H2HMatchRow[];
  summary: {
    total: number;
    withStats: number;
    withoutStats: number;
  };
  error?: string;
};

export type H2HSyncStatsResponse = {
  success: boolean;
  parentFixtureId: number;
  requested: number;
  syncedOk: number;
  syncedFailed: number;
  results: { fixtureId: number; success: boolean; error?: string; hadStatisticsInApi?: boolean }[];
  h2h: FixtureH2HResponse;
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
  includesOdds?: boolean;
  hasOdds?: boolean;
  promptLength?: number;
  liveSnapshot?: {
    status?: { minute?: number | null; short?: string };
    score?: { home?: number; away?: number };
    fetchedAt?: string;
  };
  error?: string;
};

export type LiveOddsResponse = {
  success: boolean;
  fixtureId?: number;
  minute?: number | null;
  hasOdds?: boolean;
  oddsBlock?: string;
  apiFootball?: {
    oddsLive?: unknown;
    oddsLiveBets?: unknown;
  };
  endpoints?: {
    oddsLive?: string;
    oddsLiveBets?: string;
  };
  liveSnapshot?: unknown;
  marketsSummary?: {
    liveShots?: boolean;
    liveFouls?: boolean;
    liveCards?: boolean;
  };
  error?: string;
};

export type LiveAnalysisPick = {
  id: string;
  tipo: string;
  probabilidad: number | null;
  cuota_decimal: number | null;
  explicacion: string;
  categoria_pronostico: string;
  minute: number | null;
  createdAt: string;
};

export type LiveAnalysisRun = {
  id: string;
  windowKey: string;
  minute: number | null;
  scoreHome: number | null;
  scoreAway: number | null;
  status: string | null;
  analysisSummary: string | null;
  publishedCount: number;
  createdAt: string;
  picks: LiveAnalysisPick[];
};

export type LiveAnalysisRunsResponse = {
  ok: boolean;
  fixtureId: number;
  fixture: {
    fixtureid: number;
    teamshomename?: string | null;
    teamsawayname?: string | null;
    fixturestatusshort?: string | null;
    fixturestatuselapsed?: number | null;
    goalshome?: number | null;
    goalsaway?: number | null;
    fixturedate?: string | null;
  } | null;
  runs: LiveAnalysisRun[];
  totalRuns: number;
  totalPicks: number;
  error?: string;
};

export type PreMatchAnalysisPick = {
  id: string | number;
  tipo: string;
  pronostico?: string | null;
  probabilidad: number | null;
  cuota_llm_decimal?: number | null;
  cuota_decimal?: number | null;
  explicacion: string;
  categoria_pronostico: string;
  createdAt?: string;
};

export type PreMatchAnalysis = {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  analysis: string;
  createdAt?: string;
  updatedAt?: string;
  publishedCount: number;
  picks: PreMatchAnalysisPick[];
};

export type PreMatchAnalysisResponse = {
  ok: boolean;
  fixtureId: number;
  fixture: {
    fixtureid: number;
    teamshomename?: string | null;
    teamsawayname?: string | null;
    leaguename?: string | null;
    fixturestatusshort?: string | null;
    fixturestatuselapsed?: number | null;
    goalshome?: number | null;
    goalsaway?: number | null;
    fixturedate?: string | null;
  } | null;
  analysis: PreMatchAnalysis | null;
  hasAnalysis?: boolean;
  publishedCount?: number;
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
  fixtureId?: number | string;
  aliasUsed?: string | null;
  date?: string;
  dateDisplay?: string;
  dateTimeDisplay?: string | null;
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  score?: string | null;
  yellowTotal?: number | string | null;
  redTotal?: number | string | null;
  foulsTotal?: number | string | null;
  hasStats?: boolean;
};

export type RefereeHistoryResponse = {
  success: boolean;
  name?: string;
  summary?: Record<string, unknown>;
  summaryLabel?: string;
  matches?: RefereeHistoryMatch[];
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

export type PartidoStatisticsFlbResponse = {
  success: boolean;
  fixtureId?: number;
  eventId?: string | null;
  mapping?: FlbMappingRow | null;
  flbRaw?: unknown;
  mapped?: unknown;
  matchDetail?: unknown;
  coverageLevel?: string | null;
  flbStatsError?: string | null;
  error?: string;
};

export type FlbMappingRow = {
  fixtureId: number;
  flbEventId: string;
  source: 'auto' | 'manual' | 'cache';
  homeFlbName?: string | null;
  awayFlbName?: string | null;
  matchScore?: number | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FlbCandidateRow = {
  eventId: string | null;
  home: string;
  away: string;
  score: number;
  homeScore?: number | null;
  awayScore?: number | null;
  ongoing?: boolean;
  started?: boolean;
  timeTS?: number | null;
};

export type FlbCandidatesResponse = {
  success: boolean;
  fixtureId?: number;
  flbEnabled?: boolean;
  flbQueryDate?: string | null;
  datesQueried?: string[];
  manualDate?: string | null;
  dateOverride?: boolean;
  flbMatchCount?: number;
  mapping?: FlbMappingRow | null;
  failureReason?: string | null;
  fetchError?: string | null;
  candidates?: FlbCandidateRow[];
  dayMatches?: FlbCandidateRow[];
  fixture?: {
    homeTeam?: string;
    awayTeam?: string;
    fixturedate?: string;
    primaryDate?: string | null;
    flbCalendarDate?: string | null;
    goalshome?: string | null;
    goalsaway?: string | null;
    leagueid?: number;
  };
  error?: string;
};

export type FlbMappingSaveResponse = {
  success: boolean;
  fixtureId?: number;
  mapping?: FlbMappingRow;
  deleted?: boolean;
  message?: string;
  error?: string;
};

export type SyncPartidoStatsResponse = {
  success: boolean;
  fixtureId?: number;
  statisticsPersisted?: boolean;
  statisticsSource?: string;
  statisticsSourceReason?: string | null;
  statisticsSourceDetail?: string | null;
  statsSource?: string;
  goalshome?: number | string | null;
  goalsaway?: number | string | null;
  fixturestatuselapsed?: number | null;
  fixturestatusextra?: number | null;
  statusShort?: string;
  redisLive?: { snapshot?: boolean; stats?: boolean };
  apiFootballMissing?: boolean;
  apiFootballMiss?: {
    code?: string;
    status?: number | null;
    message?: string;
    detail?: string;
  } | null;
  message?: string;
  error?: string;
  statistics?: FixtureStatisticsResponse;
};

export type SyncStatsPlanFixture = {
  fixtureId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  hasStats: boolean;
};

export type SyncStatsPlanResponse = {
  success: boolean;
  dateFrom?: string;
  dateTo?: string;
  onlyMissing?: boolean;
  days?: number;
  total?: number;
  fixtures?: SyncStatsPlanFixture[];
  byDay?: Record<string, { count: number; fixtureIds: number[] }>;
  error?: string;
};

export type SyncStatsResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  summary?: string;
  daysProcessed?: number;
  fixturesUpdated?: number;
  totals?: {
    processed?: number;
    failed?: number;
    missingAfter?: number;
    flbUpdated?: number;
  };
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

export type PromedioMetricRow = {
  key: string;
  label: string;
  side: 'home' | 'away';
  statType: string;
  teamScope: 'self' | 'opponent';
  live: number | null;
  stored: number | null;
  delta: number | null;
  aligned: boolean;
};

export type PromediosSummaryResponse = {
  success: boolean;
  found?: boolean;
  fixture?: {
    fixtureid: number;
    fecha: string | null;
    local: string;
    visitante: string;
    teamshomeid: number;
    teamsawayid: number;
    liga?: string;
  };
  procedure?: string;
  storedAt?: string | null;
  hasStored?: boolean;
  metrics?: PromedioMetricRow[];
  fuente?: {
    resumen: string;
    tablas: string[];
    muestraRegla: string;
  };
  error?: string;
};

export type PromedioMuestraRow = {
  fixtureid: number;
  fecha: string | null;
  partido: string;
  rival: string;
  valor: number | null;
  statType: string;
  teamScope: string;
  statRowsMatched?: number;
  duplicateStatRows?: boolean;
  hasStat?: boolean;
  fixtureHasStatistics?: boolean;
  usedInAverage?: boolean;
  excludedReason?: string | null;
};

export type PromedioDiagnosticoRow = {
  fixtureid: number;
  fecha: string | null;
  partido: string;
  liga: string;
  rolEnPartido: string;
  estado: string;
  finalizado: boolean;
  enMuestraActual: boolean;
  cumpleRolMetrica: boolean;
  exclusionReason: string | null;
};

export type PromediosMuestraResponse = {
  success: boolean;
  found?: boolean;
  metric?: {
    key: string;
    label: string;
    side: string;
    statType: string;
    teamScope: string;
    sideLabel: string;
    teamScopeLabel: string;
  };
  fixture?: {
    fixtureid: number;
    local: string;
    visitante: string;
  };
  muestra?: PromedioMuestraRow[];
  sampleSize?: number;
  usedInAverageCount?: number;
  promedioCalculado?: number | null;
  promedioSpReplica?: number | null;
  spJoinRows?: number;
  hasDuplicateStats?: boolean;
  liveFromProcedure?: number | null;
  storedInDb?: number | null;
  integrityOk?: boolean;
  integrityNote?: string | null;
  muestraCriterio?: {
    teamId: number;
    rolRequerido: string;
    descripcion: string;
    notaCopas: string;
  };
  diagnosticoReciente?: PromedioDiagnosticoRow[];
  procedure?: string;
  error?: string;
};

export type PromediosRecalculateResponse = {
  success: boolean;
  fixtureid?: number;
  created?: boolean;
  date?: string;
  metricsCount?: number;
  integrity?: {
    fixturesTouched?: string[];
    removedTeams?: number;
    removedData?: number;
  } | null;
  summary?: PromediosSummaryResponse | null;
  error?: string;
};

export type PromediosRecalcPlanFixture = {
  fixtureId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  reason: 'sin_registro' | 'metricas_desactualizadas';
};

export type PromediosRecalcPlanResponse = {
  success: boolean;
  dateFrom?: string;
  dateTo?: string;
  onlyStale?: boolean;
  days?: number;
  total?: number;
  fixtures?: PromediosRecalcPlanFixture[];
  byDay?: Record<string, { count: number; fixtureIds: number[] }>;
  error?: string;
};

export type PromediosRecalcRangeResponse = {
  success: boolean;
  dateFrom?: string;
  dateTo?: string;
  onlyStale?: boolean;
  daysProcessed?: number;
  total?: number;
  repaired?: number[];
  failed?: { fixtureId: number; error: string }[];
  summary?: string;
  error?: string;
};

export type LigaRow = {
  id: string;
  name: string;
  type: string | null;
  logo: string | null;
  countryName: string;
  countryCode: string | null;
  countryFlag: string | null;
  active: boolean;
  outstanding: boolean;
  trusPrediction: boolean;
  lock: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type LigaSeasonRow = {
  id: string;
  year: string;
  start: string | null;
  end: string | null;
  current: boolean;
  events: boolean;
  lineups: boolean;
  statisticsFixtures: boolean;
  statisticsPlayers: boolean;
  standings: boolean;
  players: boolean;
  topScorers: boolean;
  topAssists: boolean;
  topCards: boolean;
  injuries: boolean;
  predictions: boolean;
  odds: boolean;
};

export type LigasResponse = {
  success: boolean;
  data?: LigaRow[];
  meta?: {
    total: number;
    limit: number;
    offset: number;
    countries: string[];
    summary: {
      totalInDb: number;
      outstanding: number;
      active: number;
      locked: number;
    };
  };
  error?: string;
};

export type LigaDetailResponse = {
  success: boolean;
  league?: LigaRow & { seasons: LigaSeasonRow[] };
  error?: string;
};

export type LigaPatchPayload = Partial<
  Pick<LigaRow, 'active' | 'outstanding' | 'trusPrediction' | 'lock'>
>;

export type LigaPatchResponse = {
  success: boolean;
  league?: LigaRow;
  error?: string;
};

export type LigaSyncResponse = {
  success: boolean;
  message?: string;
  league?: LigaRow & { seasons: LigaSeasonRow[] };
  error?: string;
};

export type RefereeAliasRow = {
  id: string;
  refereeId: string;
  aliasRaw: string;
  aliasKey: string;
  aliasType: 'api' | 'abbrev' | 'nickname' | 'manual';
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ArbitroRow = {
  id: string;
  canonicalName: string;
  country?: string | null;
  notes?: string | null;
  aliases: RefereeAliasRow[];
  aliasCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ArbitrosResponse = {
  success: boolean;
  data?: ArbitroRow[];
  meta?: { total: number; limit: number; offset: number };
  error?: string;
};

export type ArbitroDetailResponse = {
  success: boolean;
  referee?: ArbitroRow;
  error?: string;
};

export type ArbitroUnlinkedRow = {
  name: string;
  fixtureCount: number;
};

export type ArbitrosUnlinkedResponse = {
  success: boolean;
  data?: ArbitroUnlinkedRow[];
  error?: string;
};

export type ArbitroSuggestRow = {
  name: string;
  fixtureCount: number;
  confidence: 'alta' | 'media';
};

export type ArbitroSuggestResponse = {
  success: boolean;
  name?: string;
  suggestions?: ArbitroSuggestRow[];
  error?: string;
};

export type ArbitroCreatePayload = {
  canonicalName: string;
  country?: string;
  notes?: string;
  initialAlias?: string;
  aliasType?: RefereeAliasRow['aliasType'];
};

export type ArbitroCreateResponse = {
  success: boolean;
  referee?: ArbitroRow;
  error?: string;
};

export type ArbitroPatchPayload = {
  canonicalName?: string;
  country?: string | null;
  notes?: string | null;
};

export type ArbitroPatchResponse = {
  success: boolean;
  referee?: ArbitroRow;
  error?: string;
};

export type ArbitroAddAliasPayload = {
  aliasRaw: string;
  aliasType?: RefereeAliasRow['aliasType'];
  source?: string;
};

export type ArbitroAddAliasResponse = {
  success: boolean;
  alias?: RefereeAliasRow;
  referee?: ArbitroRow;
  aliasesAdded?: number;
  message?: string;
  error?: string;
};

export type ArbitroRepairVariantsResponse = {
  success: boolean;
  referee?: ArbitroRow;
  aliasesAdded?: number;
  message?: string;
  error?: string;
};

export type ArbitroRemoveAliasResponse = {
  success: boolean;
  refereeId?: string;
  referee?: ArbitroRow;
  error?: string;
};

export type ArbitroDisciplineHistoryResponse = RefereeHistoryResponse & {
  referee?: ArbitroRow;
  refereeId?: string | null;
  aliases?: string[];
};

export type SuscripcionStatus = 'activa' | 'cancelada' | 'expirada' | 'pendiente';

export type SuscripcionRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  app: string | null;
  productId: string | null;
  environment: string | null;
  orig_tx_id: string | null;
  startDate: string | null;
  endDate: string | null;
  startDateDisplay: string | null;
  endDateDisplay: string | null;
  isCancelled: boolean;
  fake: boolean;
  isActive: boolean;
  status: SuscripcionStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SuscripcionesMeta = {
  total: number;
  activas: number;
  limit: number;
  offset: number;
  email: string | null;
  search: string | null;
  app: string;
  estado: string;
};

export type SuscripcionesResponse = {
  success: boolean;
  data: SuscripcionRow[];
  meta: SuscripcionesMeta;
  error?: string;
};

export type SuscripcionProductosResponse = {
  success: boolean;
  data: { android: string[]; ios: string[] };
};

export type SuscripcionSavePayload = {
  email?: string;
  app: 'ios' | 'android';
  productId: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  environment?: string;
  isCancelled?: boolean;
  fake?: boolean;
  orig_tx_id?: string;
};

export type SuscripcionMutationResponse = {
  success: boolean;
  data?: SuscripcionRow;
  error?: string;
};

export type RenewalSyncAction =
  | 'unchanged'
  | 'would_update'
  | 'would_create'
  | 'would_cancel'
  | 'skip'
  | 'error'
  | 'applied_update'
  | 'applied_cancel';

export type RenewalSyncItem = {
  subscriptionId: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  productId: string | null;
  action: RenewalSyncAction;
  reason: string;
  renewalOrderId?: string | null;
  applyNote?: string;
  error?: string;
  google?: {
    orderId: string | null;
    orderIdBase: string | null;
    isRenewal: boolean;
    expiryDisplay: string | null;
    startDisplay: string | null;
    autoRenewing: boolean;
    paymentState: number | null;
    purchaseToken: string | null;
  };
  database?: {
    subscriptionId: string;
    orderId: string | null;
    endDate: string | null;
    startDate: string | null;
    isCancelled: boolean;
    productId: string | null;
  };
};

export type RenewalSyncResponse = {
  success: boolean;
  dryRun: boolean;
  scope: 'active' | 'all';
  limit: number;
  scanned: number;
  summary: {
    unchanged: number;
    would_update: number;
    would_create: number;
    would_cancel: number;
    skip: number;
    error: number;
    applied: number;
  };
  items: RenewalSyncItem[];
  nota: string;
  error?: string;
};

export type RenewalSyncPayload = {
  dryRun?: boolean;
  scope?: 'active' | 'all';
  limit?: number;
  allowCreate?: boolean;
};

export type DashboardPlatformCounts = {
  ios: number;
  android: number;
  otro?: number;
};

export type DashboardTopProducto = {
  productId: string;
  app: string;
  total: number;
  activas: number;
};

export type DashboardTendenciaMes = {
  mes: string;
  app: string;
  total: number;
};

export type DashboardActividadHoy = {
  fecha: string;
  fechaDesde?: string;
  fechaHasta?: string;
  esUnDia?: boolean;
  compras: { total: number; ios: number; android: number };
  renovaciones: { total: number; ios: number; android: number };
  total: { ios: number; android: number; all: number };
  nota: string;
};

export type DashboardActividadResponse = {
  success: boolean;
  generatedAt: string;
  actividad: DashboardActividadHoy;
  error?: string;
};

export type DashboardSummary = {
  success: boolean;
  generatedAt: string;
  usuarios: {
    registrados: number;
    eliminados: number;
    temporales: number;
    conSuscripcionHistorica: number;
    alcanceApp: DashboardPlatformCounts;
    suscriptoresUnicos: DashboardPlatformCounts;
    notaAlcance: string;
  };
  suscripciones: {
    total: number;
    activas: number;
    inactivas: number;
    expiradas: number;
    canceladas: number;
    manualTemporales: number;
    fake: number;
    nuevasHoy: number;
    nuevasHoyPorApp: DashboardPlatformCounts;
    fechaReferencia: string;
    actividadHoy?: DashboardActividadHoy;
    nuevas7d: number;
    nuevas30d: number;
    porApp: DashboardPlatformCounts;
    activasPorApp: DashboardPlatformCounts;
    topProductos: DashboardTopProducto[];
    tendenciaMensual: DashboardTendenciaMes[];
  };
  trials: { activos: number; total: number };
  soporte: {
    erroresPagoTotal: number;
    erroresPagoPendientes: number;
    erroresPorApp: DashboardPlatformCounts;
    sugerencias30d: number;
    waitlistIos: number;
  };
  ops: {
    socketsActivos: number;
    uptimeSec: number;
    heapMb: number;
    dbPoolPending: number;
  } | null;
  error?: string;
};

export type OpsJobEntry = {
  lastRunAt?: string | null;
  lastMs?: number | null;
  ok?: boolean;
  skipped?: boolean;
  reason?: string | null;
  meta?: Record<string, unknown>;
};

export type OpsAlert = {
  at: string;
  level?: string;
  message: string;
};

export type OpsIncidentRow = {
  id: string;
  type: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  context?: Record<string, unknown> | null;
  module?: string | null;
  source?: string | null;
  why?: string | null;
  instanceId?: string | null;
  groupKey?: string | null;
  startedAt: string;
  endedAt?: string | null;
  open?: boolean;
  durationSec?: number | null;
};

export type OpsIncidentsResponse = {
  success: boolean;
  data?: OpsIncidentRow[];
  meta?: { total: number; limit: number; offset: number; hours: number; since: string; storage?: string; logPath?: string };
  error?: string;
};

export type OpsIncidentsReportResponse = {
  success: boolean;
  report?: string;
  summary?: { total: number; open: number; byType: Record<string, number> };
  incidents?: OpsIncidentRow[];
  error?: string;
};

export type OpsSnapshot = {
  success?: boolean;
  generatedAt: string;
  uptimeSec: number;
  logLevel?: string;
  nodeEnv?: string;
  eventLoop: { meanMs: number; maxMs: number; p99Ms: number };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    heapPercent: number;
    systemUsedMb?: number;
    systemTotalMb?: number;
  };
  sockets: { active: number; max: number };
  dbPool: {
    inUse: number;
    max: number;
    available: number;
    pending: number;
    usagePercent: number;
  } | null;
  poolHealth?: { status: string; pending: number; usagePercent: number };
  poolPeak?: { pending: number; inUse: number; at: string | null };
  poolHistory?: { at: string; pending: number; inUse: number; available?: number }[];
  cronSchedules?: Record<string, string>;
  configRevision?: number;
  runtimeSettings?: Record<string, unknown>;
  poolBackpressure?: { deferPending?: number; criticalPending?: number; open?: boolean };
  prediction3Diagnostics?: {
    limiter?: { queued?: number; active?: number; max?: number };
    config?: { maxConcurrent?: number };
    error?: string;
  };
  liveHotPoll?: {
    running: boolean;
    lastRunAt?: string | null;
    lastMs?: number | null;
    lastSkipped?: boolean;
    lastSkipReason?: string | null;
  };
  liveServices?: Record<string, boolean | number | string | null>;
  redisQueues?: { dbPending?: number | null; statsPending?: number | null; cacheBackend?: string };
  jobs?: Record<string, OpsJobEntry>;
  jobsRunning?: Record<string, { since: string | null; runningMs: number | null }>;
  prediction3?: {
    slowCount: number;
    queueTimeoutCount: number;
    lastSlow?: unknown;
    lastQueueTimeout?: unknown;
  };
  alerts?: OpsAlert[];
  loadDiagnostics?: {
    suspects?: {
      source: string;
      hint: string;
      lastMs?: number;
      pending?: number;
      queued?: number;
      at?: string;
    }[];
  };
  slowJobsRanked?: { name: string; lastMs: number; lastRunAt?: string | null; skipped?: boolean; ok?: boolean }[];
  recommendations?: string[];
  clientImpact?: {
    summary?: string;
    note?: string;
    symptoms?: string[];
    likelyCause?: string;
    causes?: string[];
  };
  error?: string;
};

export type RuntimeSettingField = {
  key: string;
  label: string;
  description: string;
  group: string;
  type: 'bool' | 'int';
  value: boolean | number;
  min?: number;
  max?: number;
};

export type RuntimeSettingsSnapshot = {
  fields: RuntimeSettingField[];
  effective: Record<string, boolean | number>;
  flags: {
    emergencyEnvOff: boolean;
    killSwitch: boolean;
    autoPaused: boolean;
    autoPausedReason: string | null;
  };
  meta: {
    updatedAt: string | null;
    updatedBy: string | null;
    source: string | null;
  };
  redisAvailable: boolean;
};
