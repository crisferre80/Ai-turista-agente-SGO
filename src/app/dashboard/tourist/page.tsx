"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  role?: string;
  bio?: string;
  created_at?: string;
} 

export default function TouristDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data as Profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Error: ' + msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) return <div style={{ padding: 40 }}>Cargando dashboard...</div>;
  if (!profile) return <div style={{ padding: 40 }}>No hay perfil - <button onClick={() => router.push('/login')}>Iniciar sesión</button></div>;

  return (
    <div style={{ padding: '80px 24px 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Bienvenido, {profile.name || 'Turista'}</h1>
        <div>
          <button onClick={() => router.push('/profile')} style={{ marginRight: 8 }}>Editar Perfil</button>
          <button onClick={() => router.push('/')}>Volver al Inicio</button>
        </div>
      </div>

      {error && <div style={{ color: '#b91c1c', marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 20 }}>
        <h3>Tu Cuenta</h3>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>Rol:</strong> {profile.role}</p>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Acciones</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => router.push('/explorar')}>Explorar</button>
          <button onClick={() => router.push('/profile')}>Editar Perfil</button>
        </div>
      </div>
    </div>
  );
}