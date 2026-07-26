import { Suspense } from 'react';
import { PronosticosIaVivoView } from '@/components/pronosticos-ia-vivo-view';

export default function PronosticosIaVivoPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-400">Cargando...</p>}>
      <PronosticosIaVivoView />
    </Suspense>
  );
}
