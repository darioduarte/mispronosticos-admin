import { OpsMonitorPanel } from '@/components/dashboard/ops-monitor-panel';
import { OpsIncidentsPanel } from '@/components/dashboard/ops-incidents-panel';
import { OpsDayTimelinePanel } from '@/components/dashboard/ops-day-timeline-panel';

export default function MonitoreoPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <OpsDayTimelinePanel />
      <OpsMonitorPanel />
      <OpsIncidentsPanel />
    </div>
  );
}
