"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

interface Business {
  id: string;
  auth_id?: string;
  name: string;
  email: string;
  description?: string;
  website_url?: string;
  phone?: string;
  address?: string;
  category?: string;
  plan?: string;
  gallery_images?: string[];
  is_active?: boolean;
  payment_status?: string;
  subscription_end?: string;
}

export default function BusinessDashboard() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const fetchBusiness = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (error) throw error;
      setBusiness(data as Business);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Error: ' + msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  const openPayment = async () => {
    if (!business) return;
    setProcessing(true);
    try {
      const amount = business.plan === 'basic' ? 2500 : business.plan === 'pro' ? 5000 : 10000;
      const period = 'monthly';

      const res = await fetch('/api/payments/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          planName: business.plan,
          amount,
          period,
          businessName: business.name,
          businessEmail: business.email
        })
      });

      if (!res.ok) throw new Error('No se pudo crear preferencia de pago');

      const body = await res.json();
      const initPoint = body.initPoint;
      if (initPoint) window.open(initPoint, '_blank');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Error: ' + msg);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Cargando dashboard...</div>;

  if (!business) return (
    <div style={{ padding: '80px 24px 24px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <h1>No se encontró un negocio registrado</h1>
        <p>Parece que tu cuenta de negocio no tiene un negocio asociado. Registra tu negocio para continuar.</p>
        <button onClick={() => router.push('/business/register')} style={{ padding: '12px 24px', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Registrar Negocio</button>
        <div style={{ marginTop: 20 }}>
          <button onClick={() => router.push('/')} style={{ marginRight: 10 }}>Volver al Inicio</button>
          <button onClick={() => router.push('/profile')}>Editar Perfil Personal</button>
        </div>
      </div>
    </div>
  );

  // Check if business is active and paid
  const isActive = business.is_active && (business.payment_status === 'paid' || business.plan === 'basic');
  if (!isActive) {
    return (
      <div style={{ padding: '80px 24px 24px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ marginBottom: 20 }}>Negocio Registrado - Pago Pendiente</h1>
          <div style={{ background: 'white', padding: 30, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2>{business.name}</h2>
            <p style={{ margin: '20px 0' }}>
              Tu negocio ha sido registrado exitosamente, pero necesitas completar el pago para activarlo.
            </p>
            <div style={{ margin: '20px 0' }}>
              <p><strong>Plan:</strong> {business.plan}</p>
              <p><strong>Estado:</strong> {business.payment_status}</p>
            </div>
            <button 
              onClick={openPayment} 
              disabled={processing}
              style={{
                background: '#00a650',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                fontSize: 16,
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.6 : 1
              }}
            >
              {processing ? 'Procesando...' : 'Completar Pago con MercadoPago 💳'}
            </button>
          </div>
          <div style={{ marginTop: 20 }}>
            <button onClick={() => router.push('/')} style={{ marginRight: 10 }}>Volver al Inicio</button>
            <button onClick={() => router.push('/business/profile')}>Editar Información</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '80px 24px 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{business.name}</h1>
        <div>
          <button onClick={() => router.push('/business/profile')} style={{ marginRight: 8 }}>Editar Perfil</button>
          <button onClick={() => router.push('/')} style={{ marginLeft: 8 }}>Volver al Inicio</button>
        </div>
      </div>

      {error && <div style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          <div style={{ background: 'white', padding: 20, borderRadius: 8, marginBottom: 20 }}>
            <h3>Información</h3>
            <p><strong>Plan:</strong> {business.plan}</p>
            <p><strong>Estado de pago:</strong> {business.payment_status}</p>
            <p><strong>Vencimiento:</strong> {business.subscription_end || '—'}</p>
            <p><strong>Categoría:</strong> {business.category}</p>
            <p><strong>Teléfono:</strong> {business.phone}</p>
            <p><strong>Dirección:</strong> {business.address}</p>
            <p><strong>Sitio:</strong> {business.website_url}</p>
          </div>

          <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
            <h3>Galería</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
              {(business.gallery_images || []).map((img: string, i: number) => (
                <Image key={i} src={img} alt={`img-${i}`} width={300} height={200} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
              ))}
            </div>
          </div>
        </div>

        <aside>
          <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
            <h3>Acciones</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => router.push('/business/profile')}>Editar Información</button>
              {business.plan !== 'basic' && business.payment_status !== 'paid' && (
                <button onClick={openPayment} disabled={processing}>{processing ? 'Procesando...' : 'Completar Pago'}</button>
              )}
              <button onClick={() => router.push('/dashboard/business')}>Actualizar Dashboard</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}