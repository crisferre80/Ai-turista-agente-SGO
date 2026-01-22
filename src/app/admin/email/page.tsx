"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EmailManager from '@/email/EmailManager';
import { supabase } from '@/lib/supabase';

export default function AdminEmailPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Debug info for dev endpoint
  type DebugInfo = { ok?: boolean; counts?: Record<string, number>; error?: string } | null;
  const [debugInfo, setDebugInfo] = useState<DebugInfo>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  // Session check state (declare hooks unconditionally to satisfy Hooks rules)
  type User = { id?: string; email?: string } | null;
  type Profile = { id?: string; role?: string; name?: string } | null;
  type SessionInfo = { user?: User; authError?: string | null; profile?: Profile; profileError?: string | null; error?: string | null } | null;
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // runDebug: server-side counts (uses service role key)
  const runDebug = async () => {
    setDebugLoading(true);
    try {
      const res = await fetch('/api/admin/email-debug');
      const json = await res.json();
      setDebugInfo(json);
    } catch (err) {
      setDebugInfo({ error: String(err) });
    } finally {
      setDebugLoading(false);
    }
  };

  // Small helper to extract message from unknown error-like objects
  const getErrorMessage = (err: unknown): string | null => {
    if (!err) return null;
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const maybe = (err as { message?: unknown }).message;
      if (typeof maybe === 'string') return maybe;
    }
    try { return JSON.stringify(err); } catch { return String(err); }
  };

  // runSessionCheck: inspects client session and attempts to read the profile
  const runSessionCheck = async () => {
    setSessionLoading(true);
    try {
      const res = await supabase.auth.getUser();
      const user = (res.data?.user ?? null) as User | null;
      const authErrMsg = getErrorMessage(res.error);
      const info: SessionInfo = { user: user || null, authError: authErrMsg };
      if (user && user.id) {
        // Try to fetch profile (may be blocked by RLS)
        const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        info.profile = (profile as Profile) || null;
        info.profileError = getErrorMessage(pErr);
      }
      setSessionInfo(info);
    } catch (err: unknown) {
      setSessionInfo({ error: getErrorMessage(err) });
    } finally {
      setSessionLoading(false);
    }
  };

  const checkAuth = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const legacyAuth = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

    if (!user && legacyAuth !== 'granted') {
      router.push('/login');
    } else {
      setIsAuthorized(true);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // Defer the auth check to avoid synchronous setState inside the effect
    const t = setTimeout(() => { checkAuth(); }, 0);
    return () => clearTimeout(t);
  }, [checkAuth]);

  if (loading) {
    return <div style={{ padding: 40 }}>Cargando...</div>;
  }

  if (!isAuthorized) return null;



  return (
    <div style={{ padding: 24 }}>
      <div className="responsive-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>📧 Gestión de Emails</h1>
          <p style={{ color: '#6b7280', marginBottom: 18 }}>Administra contactos, campañas, plantillas y envíos masivos</p>
        </div>
        <div className="responsive-row" style={{ gap: 8, alignItems: 'center' }}>
          <button onClick={runDebug} disabled={debugLoading} style={{ padding: '8px 12px', borderRadius: 8, background: '#0e1f1d', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {debugLoading ? 'Comprobando...' : 'Comprobar BD (dev)'}
          </button>
          <button onClick={runSessionCheck} disabled={sessionLoading} style={{ padding: '8px 12px', borderRadius: 8, background: '#1A3A6C', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {sessionLoading ? 'Comprobando sesión...' : 'Comprobar sesión'}
          </button>
        </div>
      </div>

      {debugInfo && (
        <pre style={{ background: '#0b1220', color: '#cfe6ff', padding: 12, borderRadius: 8, marginBottom: 12 }}>{JSON.stringify(debugInfo, null, 2)}</pre>
      )}

      {sessionInfo && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '8px 0' }}>Información de sesión</h4>
          <pre style={{ background: '#071023', color: '#cfe6ff', padding: 12, borderRadius: 8 }}>{JSON.stringify(sessionInfo, null, 2)}</pre>
          {sessionInfo?.user && (
            <div style={{ marginTop: 8 }}>
              {(!sessionInfo.profile || sessionInfo.profile.role !== 'admin') ? (
                <div style={{ background: '#fff8e6', padding: 12, borderRadius: 8 }}>
                  <strong>Tu usuario no está configurado como admin.</strong>
                  <p style={{ margin: '8px 0 0 0' }}>Ejecuta este SQL en Supabase SQL Editor para crear/actualizar tu perfil (reemplaza <code>&lt;USER_UUID&gt;</code> por <strong>{sessionInfo.user.id}</strong>):</p>
                  <pre style={{ marginTop: 8, background: '#f6f6f6', padding: 8, borderRadius: 6 }}>
                    {`INSERT INTO profiles (id, name, role) VALUES ('${(sessionInfo.user as { id?: string }).id}', 'Tu Nombre', 'admin') ON CONFLICT (id) DO UPDATE SET role = 'admin';`}
                  </pre>
                </div>
              ) : (
                <div style={{ background: '#e7ffef', padding: 12, borderRadius: 8 }}>
                  <strong>Perfecto:</strong> tu perfil existe y es admin.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <EmailManager />
    </div>
  );
}
