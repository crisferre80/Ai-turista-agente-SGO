import React from 'react';
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import type { ARData } from '@/types/ar';
import { normalizeARData } from '@/lib/ar-utils';
import WebXRInitializer from '@/components/WebXRInitializer';

type ARPageProps = {
  params: Promise<{ id: string }>;
};

type Attraction = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: string;
  lat?: number;
  lng?: number;
  has_ar_content?: boolean;
  ar_model_url?: string;
  ar_hotspots?: ARData;
  qr_code?: string;
};

export default async function ARPage({ params }: ARPageProps) {
  const { id } = await params;

  // Cargar datos del atractivo
  const { data: attraction, error } = await supabase
    .from('attractions')
    .select('id,name,description,image_url,category,lat,lng,has_ar_content,ar_model_url,ar_hotspots,qr_code')
    .eq('id', id)
    .maybeSingle();

  if (error || !attraction) {
    notFound();
  }


  const attractionData: Attraction = {
    id: String(attraction.id),
    name: String(attraction.name || ''),
    description: attraction.description || undefined,
    image_url: attraction.image_url || undefined,
    category: attraction.category || undefined,
    lat: attraction.lat ?? undefined,
    lng: attraction.lng ?? undefined,
    has_ar_content: attraction.has_ar_content ?? false,
    ar_model_url: attraction.ar_model_url || undefined,
    ar_hotspots: normalizeARData(attraction.ar_hotspots),
    qr_code: attraction.qr_code || undefined,
  };

  // Si no tiene contenido AR, redirigir al detalle normal
  if (!attractionData.has_ar_content) {
    notFound();
  }

  // Importar el componente cliente AR dinámicamente
  const ARPageClientModule = await import('@/components/ARPageClient');
  const ARPageClient = ARPageClientModule.default;

  return (
    <>
      <WebXRInitializer />
      <ARPageClient attraction={attractionData} />
    </>
  );
}
