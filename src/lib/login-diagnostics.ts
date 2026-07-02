export type LoginDiagnostic = {
  message: string;
  status?: number;
  hint?: string;
  code?: string;
  stage?: string;
  detail?: string;
  apiBase: string;
  endpoint: string;
  method: string;
  responseBody?: string;
  networkError?: string;
  at: string;
};

export function formatLoginDiagnostic(d: LoginDiagnostic): string {
  const lines = [
    '=== Diagnóstico login admin ===',
    `Fecha: ${d.at}`,
    `API: ${d.apiBase}`,
    `${d.method} ${d.endpoint}`,
    d.status != null ? `HTTP: ${d.status}` : 'HTTP: (sin respuesta)',
    `Error: ${d.message}`,
  ];
  if (d.code) lines.push(`Código: ${d.code}`);
  if (d.stage) lines.push(`Etapa: ${d.stage}`);
  if (d.detail) lines.push(`Detalle: ${d.detail}`);
  if (d.hint) lines.push(`Hint: ${d.hint}`);
  if (d.networkError) lines.push(`Red: ${d.networkError}`);
  if (d.responseBody) lines.push(`Respuesta: ${d.responseBody}`);
  return lines.join('\n');
}

export type ConnectionProbe = {
  apiBase: string;
  healthOk: boolean;
  healthStatus?: number;
  healthError?: string;
  authMethods?: { password?: boolean; google?: boolean };
  checkedAt: string;
};
