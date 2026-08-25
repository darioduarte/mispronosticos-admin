import { CronHeartbeatsPanel } from '@/components/dashboard/cron-heartbeats-panel';

export default function ControlCronsPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Control de crons</h1>
        <p className="mt-1 text-sm text-slate-500">
          Heartbeats, estado del día y relanzamiento de jobs del worker (incl. IA prepartido
          19:15). Base para seguimiento, monitoreo y observabilidad de crons.
        </p>
      </div>
      <CronHeartbeatsPanel />
    </div>
  );
}
