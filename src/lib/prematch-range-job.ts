export type PrematchRangePhase =
  | 'planning'
  | 'warming'
  | 'generating'
  | 'paused_batch'
  | 'done'
  | 'cancelled'
  | 'error';

/** El rango sigue en el servidor y la ventana tiene que seguir el avance. */
export function isPreMatchJobWatching(phase: PrematchRangePhase | undefined) {
  return (
    phase === 'planning' ||
    phase === 'warming' ||
    phase === 'generating' ||
    phase === 'paused_batch'
  );
}

export function preMatchJobBanner(phase: PrematchRangePhase | undefined) {
  if (isPreMatchJobWatching(phase)) return 'Análisis IA prepartido en segundo plano';
  if (phase === 'done') return 'Análisis IA prepartido finalizado';
  if (phase === 'error') return 'Análisis IA prepartido con error';
  return 'Análisis IA prepartido cancelado';
}

/** Mientras el rango sigue, la ventana vuelve a abrirse aunque se haya minimizado. */
export function shouldAutoOpenPreMatchModal(phase: PrematchRangePhase | undefined) {
  return isPreMatchJobWatching(phase);
}

export function showPreMatchProgressChip(
  phase: PrematchRangePhase | undefined,
  modalOpen: boolean,
  dismissedId: string | null,
  jobId: string | undefined,
) {
  if (!jobId || modalOpen) return false;
  if (isPreMatchJobWatching(phase)) return true;
  return dismissedId !== jobId;
}
