import { LivePipelineMonitorPanel } from '@/components/dashboard/live-pipeline-monitor-panel';
import { CronHeartbeatsPanel } from '@/components/dashboard/cron-heartbeats-panel';

export default function ControlCronsPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Control de crons</h1>
        <p className="mt-1 text-sm text-slate-500">
          Radar del pipeline Luna (análisis en vivo) y heartbeats de los crons del worker.
        </p>
      </div>
      <LivePipelineMonitorPanel />
      <CronHeartbeatsPanel />
    </div>
  );
}
