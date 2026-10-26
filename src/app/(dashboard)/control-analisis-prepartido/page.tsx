import { PrematchPipelineMonitorPanel } from '@/components/dashboard/prematch-pipeline-monitor-panel';

export default function ControlAnalisisPrepartidoPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Control de análisis prepartido</h1>
        <p className="mt-1 text-sm text-slate-500">
          Preparación del día siguiente: H2H, promedios, árbitro, tabla, caché del prompt
          y el análisis que sube a las 19:15.
        </p>
      </div>
      <PrematchPipelineMonitorPanel />
    </div>
  );
}
