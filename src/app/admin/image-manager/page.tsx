import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ImageManagerClient = dynamic(() => import('./ImageManagerClient'));

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Cargando gestor de imágenes...</div>}>
      <ImageManagerClient />
    </Suspense>
  );
}
