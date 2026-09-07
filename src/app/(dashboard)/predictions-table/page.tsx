import { Suspense } from 'react';
import { PredictionsTableView } from '@/components/predictions-table-view';

export default function PredictionsTablePage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-400">Cargando…</p>}>
      <PredictionsTableView />
    </Suspense>
  );
}
