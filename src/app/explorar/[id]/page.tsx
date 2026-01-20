import React from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';


type Place = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: string;
  lat?: number;
  lng?: number;
  isBusiness?: boolean;
  contact_info?: string;
  website_url?: string;
  gallery_urls?: string[];
  video_urls?: string[];
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Try to fetch attraction or business and normalize to `place`
  let place: Place | null = null;
  try {
    const { data: attr } = await supabase.from('attractions').select('*').eq('id', id).single();
    if (attr) {
      place = {
        id: String(attr.id),
        name: String(attr.name || ''),
        description: attr.description || '',
        image_url: attr.image_url || undefined,
        category: attr.category || undefined,
        lat: attr.lat,
        lng: attr.lng,
        isBusiness: false,
        contact_info: attr.contact_info || undefined,
        website_url: attr.website_url || undefined,
        gallery_urls: attr.gallery_urls || undefined,
        video_urls: attr.video_urls || undefined
      };
    }
  } catch {
    // ignore
  }

  if (!place) {
    try {
      const { data: biz } = await supabase.from('businesses').select('*').eq('id', id).single();
      if (biz) {
        place = {
          id: String(biz.id),
          name: String(biz.name || ''),
          description: biz.description || '',
          image_url: biz.image_url || undefined,
          category: biz.category || undefined,
          lat: biz.lat,
          lng: biz.lng,
          isBusiness: true,
          contact_info: biz.contact_info || undefined,
          website_url: biz.website_url || undefined,
          gallery_urls: biz.gallery_urls || undefined,
          video_urls: biz.video_urls || undefined
        };
      }
    } catch {
      // ignore
    }
  }

  if (!place) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Detalle no encontrado</h2>
        <p>No encontramos el lugar que buscabas. Quizás fue eliminado o el identificador es inválido.</p>
        <Link href="/explorar">Volver a explorar</Link>
      </div>
    );
  }

  // Load promotions for place (silent fallback if table missing)
  let promotions: any[] = [];
  try {
    const { data: prom } = await (await import('@/lib/supabase')).supabase.from('promotions').select('*').eq('place_id', id);
    promotions = prom || [];
  } catch {
    promotions = [];
  }

  // Dynamic import client component for the heavy-place detail (split bundle)
  const PlaceDetailClientModule = await import('@/components/PlaceDetailClient');
  const PlaceDetailClient = (PlaceDetailClientModule as any).default || PlaceDetailClientModule;
  // Dynamic load chat client component safely (cast to any to avoid type conflicts)
  const ChatModule = await import('@/components/ChatInterface');
  const ChatComp = (ChatModule as any).default || ChatModule;
  return (
    <>
      <header style={{ background: 'white', padding: '24px 20px', borderBottom: '1px solid #eee', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60000 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/explorar" style={{ textDecoration: 'none', background: '#F1C40F', color: '#1A3A6C', padding: '10px 14px', borderRadius: 999, fontWeight: 800 }}>← Volver</Link>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#1A3A6C' }}>{place.name}</h1>
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{place.category || (place.isBusiness ? 'Negocio' : 'Atractivo')}</div>
          </div>
        </div>
      </header>

      <main style={{ padding: '28px 20px', paddingTop: '100px' }}>
        <PlaceDetailClient place={place} promotions={promotions} />
      </main>

      {/* Persistent chat / Santi iframe */}
      <ChatComp />
    </>
  );
}
