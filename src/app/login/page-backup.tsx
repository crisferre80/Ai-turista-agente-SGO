"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserSafe } from '@/lib/supabaseAuth';
import type { AuthError } from '@supabase/supabase-js';
import { useI18n } from '@/i18n/LanguageProvider';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isAdminMode, setIsAdminMode] = useState(false);
    const { t } = useI18n();
    const [isTourist, setIsTourist] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (isAdminMode) {
                // Admin: Autenticación real con Supabase
                if (!email || !password) {
                    setError(t('error.admin_fill'));
                    setLoading(false);
                    return;
                }

                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (authError) {
                    console.error('Admin login error:', authError);
                    setError(t('error.admin_invalid'));
                    setLoading(false);
                    return;
                }

                // Verificar que el usuario tiene role 'admin'
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user?.id)
                    .single();

                if (profileError || profileData?.role !== 'admin') {
                    await supabase.auth.signOut();
                    setError(t('error.admin_no_permission'));
                    setLoading(false);
                    return;
                }

                // Login exitoso - mantener compatibilidad con localStorage
                localStorage.setItem('adminToken', 'granted');
                router.push('/admin');
            } else if (isTourist) {
                // Tourist: usar email/password tradicional
                if (!email || !password) {
                    setError(t('error.fill_email_password'));
                    setLoading(false);
                    return;
                }

                if (isRegistering) {
                    // Registro nuevo de turista
                    const { data, error: authError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                role: 'tourist'
                            }
                        }
                    });

                    if (authError) throw authError;

                    // El trigger 'on_auth_user_created' ya crea el perfil automáticamente
                    // Solo verificamos que se haya creado correctamente
                    if (data.user) {
                        // Esperar un momento para que el trigger complete
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Verificar que el perfil se creó
                        const { data: profile, error: profileError } = await supabase
                            .from('profiles')
                            .select('id, name, role')
                            .eq('id', data.user.id)
                            .maybeSingle();

                        if (profileError) {
                            console.error('Error verificando perfil de turista:', profileError);
                        } else if (!profile) {
                            // Si el trigger falló, crear manualmente como fallback
                            console.log('Trigger no creó el perfil, creando manualmente...');
                            const { error: insertError } = await supabase
                                .from('profiles')
                                .insert({
                                    id: data.user.id,
                                    name: email.split('@')[0],
                                    role: 'tourist',
                                    avatar_url: null
                                });
                            
                            if (insertError && insertError.code !== '23505') { // 23505 = duplicate key
                                console.error('Error creando perfil manualmente:', insertError);
                            }
                        } else {
                            console.log('✅ Perfil creado correctamente:', profile);
                        }
                    }

                    setSuccess(t('success.account_created'));
                    setTimeout(() => {
                        setIsRegistering(false);
                        setEmail('');
                        setPassword('');
                    }, 2000);
                } else {
                    // Login turista existente
                    const { data, error: authError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (authError) {
                        console.error('Tourist login error:', authError);
                        setError(t('error.invalid_credentials'));
                        setLoading(false);
                        return;
                    }

                    // Verificar que el perfil existe y es turista
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', data.user?.id)
                        .maybeSingle();

                    if (profileError || !profileData) {
                        // Si no existe el perfil, crearlo
                        await supabase.from('profiles').insert({
                            id: data.user.id,
                            name: email.split('@')[0],
                            role: 'tourist',
                            avatar_url: null
                        });
                    }

                    setSuccess(t('success.logged_in'));
                    setTimeout(() => router.push('/explorar'), 1000);
                }
            } else {
                if (isRegistering) {
                    // Sign Up Business
                    const { error: authError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                role: 'business'
                            }
                        }
                    });
                    if (authError) throw authError;
                    setSuccess(t('success.signup_business'));

                    // Trigger welcome email (server-side) with basic personalization
                    try {
                      await fetch('/api/email/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name: '' }) });
                    } catch (e) { console.warn('Failed to call welcome email endpoint', e); }
                } else {
                    // Login Business
                    if (!email || !password) {
                        setError('Por favor completa email y contraseña');
                        setLoading(false);
                        return;
                    }

                    const resp = await supabase.auth.signInWithPassword({ email, password });
                    const authError = resp.error;
                    if (authError) {
                        console.warn('signInWithPassword error', authError);
                        const status = (authError as AuthError).status;
                        const msg = (authError as AuthError).message || String(authError);
                        if (status === 429) {
                            setError(t('error.too_many_attempts'));
                        } else if (/confirm|verify|pending/i.test(msg)) {
                            setError(t('error.account_not_confirmed'));
                        } else if (/invalid|credentials|user not found/i.test(msg)) {
                            setError(t('error.invalid_credentials2'));
                        } else {
                            setError(t('error.login_failed', { msg }));
                        }
                        setLoading(false);
                        return;
                    }

                    // Determine role: check `businesses` table (businesses have their own table), then `profiles`, then metadata.
                    const userId = (await getUserSafe()).data.user?.id;

                    if (!userId) {
                        setError(t('error.no_user_id'));
                        setLoading(false);
                        return;
                    }

                    // Check businesses table first
                    const { data: businessRow, error: businessError } = await supabase
                        .from('business_profiles')
                        .select('id')
                        .eq('auth_id', userId)
                        .maybeSingle();

                    if (businessError) {
                        console.warn('Error al buscar business:', businessError);
                        // Show a user-friendly hint but fall back to profile metadata
                        setError(t('error.business_lookup'));
                    }

                    console.debug('Login check:', { userId, businessRow, businessError });

                    if (businessRow) {
                        router.push('/dashboard/business');
                        return;
                    }

                    // Fallback to profiles table and auth metadata
                    const { data: profileRow, error: profileError } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', userId)
                        .maybeSingle();

                    if (profileError) console.warn('Error al buscar profile:', profileError);

                    const roleFromProfile = profileRow?.role;
                    const authUser = (await getUserSafe()).data.user;
                    const roleFromMetadata = authUser?.user_metadata?.role;
                    const role = roleFromProfile || roleFromMetadata || 'user';

                    console.debug('Role resolved:', { role, roleFromProfile, roleFromMetadata });

                    if (role === 'admin') {
                        localStorage.setItem('adminToken', 'granted');
                        router.push('/admin');
                    } else if (role === 'business') {
                        router.push('/business/profile');
                    } else {
                        router.push('/dashboard/tourist');
                    }
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const status = (err as { status?: number }).status;
            if (status === 429) {
                setError(t('error.generic_many_attempts'));
            } else if (/confirm|verify|pending/i.test(msg)) {
                setError(t('error.account_not_confirmed'));
            } else {
                setError(t('error.error_msg', { msg }));
            }
        } finally {
            setLoading(false);
        }
    };

    const COLOR_GOLD = '#F1C40F';
    const COLOR_BLUE = '#1A3A6C';
    const COLOR_DARK = '#0e1f1d';

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                padding: '50px',
                borderRadius: '32px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                width: '100%',
                maxWidth: '460px',
                textAlign: 'center',
                border: `2px solid ${COLOR_GOLD}33`
            }}>
                <Image
                    src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                    alt="Santi"
                    width={20}
                    height={20}
                    style={{ 
                        marginBottom: '20px',
                        filter: 'drop-shadow(0 8px 20px rgba(241,196,15,0.4))'
                    }}
                />
                <h1 style={{ 
                    color: COLOR_BLUE, 
                    fontSize: '28px', 
                    marginBottom: '8px',
                    fontWeight: '950',
                    letterSpacing: '-0.5px'
                }}>{t('login.panelTitle')}</h1>
                <p style={{ 
                    color: '#64748b', 
                    marginBottom: '35px', 
                    fontSize: '15px',
                    fontWeight: '500'
                }}>{t('login.panelSubtitle')}</p>

                <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    marginBottom: '30px', 
                    background: '#f8fafc', 
                    padding: '6px', 
                    borderRadius: '50px',
                    border: `2px solid ${COLOR_GOLD}22`
                }}>
                    <button
                        onClick={() => { setIsAdminMode(false); setIsRegistering(false); setIsTourist(false); }}
                        style={{
                            flex: 1, 
                            padding: '14px 20px', 
                            borderRadius: '50px', 
                            border: 'none',
                            background: (!isAdminMode && !isTourist) ? COLOR_BLUE : 'transparent',
                            color: (!isAdminMode && !isTourist) ? 'white' : '#64748b',
                            fontWeight: (!isAdminMode && !isTourist) ? 'bold' : '600',
                            cursor: 'pointer',
                            fontSize: '15px',
                            transition: 'all 0.2s ease',
                            boxShadow: (!isAdminMode && !isTourist) ? `0 8px 20px ${COLOR_BLUE}44` : 'none'
                        }}
                    >
                        {t('login.tabBusiness')}
                    </button>
                    <button
                        onClick={() => { setIsAdminMode(false); setIsRegistering(false); setIsTourist(true); }}
                        style={{
                            flex: 1, 
                            padding: '14px 20px', 
                            borderRadius: '50px', 
                            border: 'none',
                            background: isTourist ? '#20B2AA' : 'transparent',
                            color: isTourist ? 'white' : '#64748b',
                            fontWeight: isTourist ? 'bold' : '600',
                            cursor: 'pointer',
                            fontSize: '15px',
                            transition: 'all 0.2s ease',
                            boxShadow: isTourist ? `0 8px 20px #20B2AA44` : 'none'
                        }}
                    >
                        {t('login.tabTourist')}
                    </button>
                </div>

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {isAdminMode && (
                        <input
                            type="email"
                            placeholder={t('login.emailAdminPlaceholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={inputStyle}
                            required
                        />
                    )}

                    {!isAdminMode && !isTourist && (
                        <input
                            type="email"
                            placeholder={t('login.emailBusinessPlaceholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={inputStyle}
                            required
                        />
                    )}

                {isTourist && (
                  <>
                    <input
                      type="email"
                      placeholder={t('login.emailTouristPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle}
                      required
                    />
                    <input
                      type="password"
                      placeholder={t('login.password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={inputStyle}
                      required
                    />
                    <div style={{
                      background: '#e0f2fe',
                      border: '1px solid #38bdf8',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      fontSize: '0.875rem',
                      color: '#0c4a6e',
                      lineHeight: '1.5'
                    }}>
                      <strong>ℹ️ Tu sesión se mantendrá activa</strong>
                      <br />
                      • <strong>{isRegistering ? 'Crear cuenta nueva' : 'Iniciar sesión'}</strong>
                      <br />
                      <span style={{ fontSize: '0.8rem', color: '#0369a1', fontStyle: 'italic' }}>
                        No tendrás que ingresar tu email cada vez 🔐
                      </span>
                    </div>
                  </>
                )}

                {!isTourist && (
                  <input
                    type="password"
                    placeholder={isAdminMode ? t('login.adminPassword') : t('login.password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                    required
                  />
                )}

                    {error && <p style={{ color: '#ff4444', fontSize: '12px', margin: 0 }}>{error}</p>}
                    {success && <p style={{ color: '#20B2AA', fontSize: '12px', margin: 0 }}>{success}</p>}

                    {/* Resend confirmation link for businesses (if they didn't receive confirmation) */}
                    {!isAdminMode && !isTourist && email && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={async () => {
                            setResendLoading(true);
                            setError('');
                            try {
                              const { error } = await supabase.auth.signInWithOtp({ email });
                              if (error) throw error;
                              setSuccess('Se envió un correo de acceso/confirmación a ' + email);
                            } catch (err: unknown) {
                              const msg = err instanceof Error ? err.message : String(err);
                              setError('Error al reenviar correo: ' + msg);
                            } finally { setResendLoading(false); }
                          }}
                          disabled={resendLoading}
                          style={{ background: 'transparent', border: '1px solid #e2e8f0', color: COLOR_BLUE, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
                        >{resendLoading ? 'Enviando...' : 'Reenviar correo de confirmación'}</button>
                      </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`,
                            color: COLOR_DARK,
                            border: 'none',
                            padding: '16px',
                            borderRadius: '50px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '17px',
                            opacity: loading ? 0.7 : 1,
                            boxShadow: `0 10px 30px ${COLOR_GOLD}44`,
                            transition: 'all 0.2s ease',
                            letterSpacing: '0.3px'
                        }}
                    >
                        {loading ? 'Procesando...' : (isRegistering ? (isTourist ? '🎉 Crear Cuenta' : 'Registrarse') : 'Ingresar')}
                    </button>
                </form>

                {isTourist && (
                    <div style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                                onClick={() => setIsRegistering(!isRegistering)}
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: '#20B2AA', 
                                    cursor: 'pointer', 
                                    fontSize: '14px', 
                                    textDecoration: 'underline',
                                    fontWeight: '600'
                                }}
                            >
                                {isRegistering ? '¿Ya tenés cuenta? Ingresá' : '¿Primera vez? Creá tu cuenta'}
                            </button>
                        </div>
                    </div>
                )}

                {!isAdminMode && !isTourist && (
                    <div style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                                onClick={() => setIsRegistering(!isRegistering)}
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: COLOR_BLUE, 
                                    cursor: 'pointer', 
                                    fontSize: '14px', 
                                    textDecoration: 'underline',
                                    fontWeight: '600'
                                }}
                            >
                                {isRegistering ? '¿Ya tenés cuenta? Ingresá' : '¿Sos un negocio nuevo? Registrate'}
                            </button>

                            <button
                                onClick={() => router.push('/business/register')}
                                style={{
                                    background: COLOR_GOLD,
                                    border: 'none',
                                    color: COLOR_DARK,
                                    padding: '8px 12px',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '14px'
                                }}
                            >
                                Registrate como Negocio →
                            </button>
                        </div>
                        {isRegistering && (
                            <div style={{ marginTop: '10px' }}>
                                <Link 
                                    href="/business/register" 
                                    style={{ 
                                        color: COLOR_GOLD, 
                                        textDecoration: 'underline',
                                        fontWeight: '600',
                                        fontSize: '14px'
                                    }}
                                >
                                    → O registrate con plan completo aquí
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #f1f5f9' }}>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            background: 'white',
                            border: `2px solid ${COLOR_BLUE}22`,
                            color: COLOR_BLUE,
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            fontWeight: '700',
                            padding: '14px',
                            borderRadius: '50px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        ← Volver al Inicio
                    </button>

                    {isTourist && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                        <Link href="/explorar" style={{ color: COLOR_BLUE, textDecoration: 'underline', fontWeight: 700, fontSize: '14px' }}>
                          Ingresar como Invitado
                        </Link>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                          💡 Tu sesión se mantiene activa, no necesitas ingresar cada vez
                        </span>
                      </div>
                    )}
                    
                    {/* Enlace discreto para admin */}
                    {!isAdminMode && (
                      <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid #f1f5f9' }}>
                        <button
                          onClick={() => { setIsAdminMode(true); setIsRegistering(false); setIsTourist(false); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '12px',
                            textDecoration: 'underline',
                            fontWeight: '500',
                            opacity: 0.6,
                            transition: 'opacity 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        >
                          Acceso administrativo
                        </button>
                      </div>
                    )}
                    
                    {/* Botón para volver al modo normal desde admin */}
                    {isAdminMode && (
                      <div style={{ marginTop: 15 }}>
                        <button
                          onClick={() => { setIsAdminMode(false); setIsRegistering(false); setIsTourist(false); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: COLOR_BLUE,
                            cursor: 'pointer',
                            fontSize: '13px',
                            textDecoration: 'underline',
                            fontWeight: '600'
                          }}
                        >
                          ← Volver a opciones principales
                        </button>
                      </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const inputStyle = {
    padding: '16px 22px',
    borderRadius: '50px',
    border: `2px solid #e2e8f0`,
    outline: 'none',
    fontSize: '16px',
    transition: 'all 0.2s ease',
    fontWeight: '500'
};
