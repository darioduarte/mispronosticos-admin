import { Suspense } from 'react';
import { ErroresCuotaIaView } from '@/components/errores-cuota-ia-view';

export default function ErroresCuotaIaPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-400">Cargando…</p>}>
      <ErroresCuotaIaView />
    </Suspense>
  );
}
