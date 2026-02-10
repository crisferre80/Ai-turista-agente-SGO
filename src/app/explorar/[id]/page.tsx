import React from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { ARData } from '@/types/ar';

type Promotion = {
  id: string;
  title?: string;
  description?: string;
  place_id?: string;
  [key: string]: unknown;
};

type PlaceDetailClientProps = {
  place: Place;
  promotions: Promotion[];
};

type ChatInterfaceProps = Record<string, never>;

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
  has_ar_content?: boolean;
  ar_model_url?: string;
  ar_hotspots?: ARData;
  qr_code?: string;
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Try to fetch attraction or business and normalize to `place`
  let place: Place | null = null;
  try {
    const { data: attr, error: attrErr } = await supabase
      .from('attractions')
      .select('id,name,description,image_url,category,lat,lng,info_extra,gallery_urls,video_urls,has_ar_content,ar_model_url,ar_hotspots,qr_code')
      .eq('id', id)
      .maybeSingle();
    if (attrErr) console.warn('Attraction fetch error', attrErr);
    if (attr) {
      const a = attr as {
        id: string | number;
        name?: string | null;
        description?: string | null;
        image_url?: string | null;
        category?: string | null;
        lat?: number | null;
        lng?: number | null;
        contact_info?: string | null;
        website_url?: string | null;
        gallery_urls?: string[] | null;
        gallery_images?: string[] | null;
        video_urls?: string[] | null;
        has_ar_content?: boolean | null;
        ar_model_url?: string | null;
        ar_hotspots?: ARData | null;
        qr_code?: string | null;
      };
      place = {
        id: String(a.id),
        name: String(a.name || ''),
        description: a.description || '',
        image_url: a.image_url || undefined,
        category: a.category || undefined,
        lat: a.lat,
        lng: a.lng,
        isBusiness: false,
        contact_info: a.contact_info || undefined,
        website_url: a.website_url || undefined,
        gallery_urls: a.gallery_urls || a.gallery_images || undefined,
        video_urls: a.video_urls || undefined,
        has_ar_content: a.has_ar_content ?? false,
        ar_model_url: a.ar_model_url || undefined,
        ar_hotspots: a.ar_hotspots || undefined,
        qr_code: a.qr_code || undefined,
      };
    }
  } catch (e) {
    console.warn('Error fetching attraction', e);
  }

  if (!place) {
    try {
      const { data: biz, error: bizErr } = await supabase
        .from('business_profiles')
        .select('id,name,description,category,lat,lng,contact_info,website_url,gallery_images,is_active,payment_status,phone,address')
        .eq('id', id)
        .maybeSingle();
      if (bizErr) console.warn('Business fetch error', bizErr);
      if (biz) {
        const b = biz as {
          id: string | number;
          name?: string | null;
          description?: string | null;
          category?: string | null;
          lat?: number | null;
          lng?: number | null;
          contact_info?: string | null;
          website_url?: string | null;
          gallery_images?: string[] | null;
          video_urls?: string[] | null;
        };
        place = {
          id: String(b.id),
          name: String(b.name || ''),
          description: b.description || '',
          image_url: b.gallery_images && b.gallery_images.length > 0 ? b.gallery_images[0] : undefined,
          category: b.category || undefined,
          lat: b.lat,
          lng: b.lng,
          isBusiness: true,
          contact_info: b.contact_info || undefined,
          website_url: b.website_url || undefined,
          gallery_urls: b.gallery_images || undefined,
          video_urls: b.video_urls || undefined
        };
      }
    } catch (e) {
      console.warn('Error fetching business', e);
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
  let promotions: Promotion[] = [];
  try {
    const { data: prom } = await (await import('@/lib/supabase')).supabase.from('promotions').select('*').eq('place_id', id);
    promotions = prom || [];
  } catch {
    promotions = [];
  }

  // Dynamic import client component for the heavy-place detail (split bundle)
  const PlaceDetailClientModule = await import('@/components/PlaceDetailClient');
  const PlaceDetailClient = PlaceDetailClientModule.default as React.ComponentType<PlaceDetailClientProps>;
  // Dynamic load chat client component safely
  const ChatModule = await import('@/components/ChatInterface');
  const ChatComp = ChatModule.default as React.ComponentType<ChatInterfaceProps>;
  // Import Header
  const HeaderModule = await import('@/components/Header');
  const Header = HeaderModule.default as React.ComponentType;
  
  return (
    <>
      <Header />

      <main style={{ padding: '28px 20px', paddingTop: '90px' }}>
        <PlaceDetailClient place={place} promotions={promotions} />
      </main>

      {/* Persistent chat / Santi iframe */}
      <ChatComp />
    </>
  );
}
