import { Suspense } from 'react';
import { PronosticosIaView } from '@/components/pronosticos-ia-view';

export default function PronosticosIaPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-400">Cargando…</p>}>
      <PronosticosIaView />
    </Suspense>
  );
}
