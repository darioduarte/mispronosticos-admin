/** Tras un despliegue el API corta unos segundos. No pintar el radar como roto en esa ventana. */
export const MONITOR_RECONNECT_WINDOW_MS = 180_000

export type LiveMonitorPanelMode = 'loading' | 'reconnecting' | 'outage' | 'ready'

export function liveMonitorPanelMode(input: {
  status: 'pending' | 'error' | 'success'
  fetchStatus: 'fetching' | 'paused' | 'idle'
  hasSuccessData: boolean
  errorSince: number | null
  now: number
}): LiveMonitorPanelMode {
  if (input.hasSuccessData && input.status !== 'error') return 'ready'
  if (input.hasSuccessData && input.status === 'error') return 'reconnecting'

  if (input.status === 'pending') return 'loading'

  if (input.status === 'error') {
    const since = input.errorSince ?? input.now
    const withinDeployWindow = input.now - since < MONITOR_RECONNECT_WINDOW_MS
    if (withinDeployWindow || input.fetchStatus === 'fetching') return 'reconnecting'
    return 'outage'
  }

  return 'outage'
}
