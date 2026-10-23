import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MONITOR_RECONNECT_WINDOW_MS,
  liveMonitorPanelMode,
} from './live-pipeline-monitor-state'

const now = 1_000_000

test('un radar ya cargado sigue visible aunque falle el refresco', () => {
  assert.equal(
    liveMonitorPanelMode({
      status: 'error',
      fetchStatus: 'idle',
      hasSuccessData: true,
      errorSince: now - 10_000,
      now,
    }),
    'reconnecting',
  )
})

test('el primer corte del despliegue no es una falla del pipeline', () => {
  assert.equal(
    liveMonitorPanelMode({
      status: 'error',
      fetchStatus: 'idle',
      hasSuccessData: false,
      errorSince: now - 20_000,
      now,
    }),
    'reconnecting',
  )
})

test('si el API no vuelve después de la ventana, sí se muestra el error', () => {
  assert.equal(
    liveMonitorPanelMode({
      status: 'error',
      fetchStatus: 'idle',
      hasSuccessData: false,
      errorSince: now - MONITOR_RECONNECT_WINDOW_MS - 1,
      now,
    }),
    'outage',
  )
})

test('mientras carga por primera vez no hay aviso rojo', () => {
  assert.equal(
    liveMonitorPanelMode({
      status: 'pending',
      fetchStatus: 'fetching',
      hasSuccessData: false,
      errorSince: null,
      now,
    }),
    'loading',
  )
})

test('una lectura buena deja el radar listo', () => {
  assert.equal(
    liveMonitorPanelMode({
      status: 'success',
      fetchStatus: 'idle',
      hasSuccessData: true,
      errorSince: null,
      now,
    }),
    'ready',
  )
})
