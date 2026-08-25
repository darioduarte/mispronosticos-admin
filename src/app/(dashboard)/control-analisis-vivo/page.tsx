import { LivePipelineMonitorPanel } from '@/components/dashboard/live-pipeline-monitor-panel';

export default function ControlAnalisisVivoPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Control de análisis en vivo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitoreo y observabilidad del pipeline Luna (fases min30 / HT / min60): partidos en
          vivo, colas, fases perdidas y re-disparo manual.
        </p>
      </div>
      <LivePipelineMonitorPanel />
    </div>
  );
}
