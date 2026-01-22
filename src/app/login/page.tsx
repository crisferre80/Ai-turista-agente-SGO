"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isAdminMode, setIsAdminMode] = useState(true);
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
                // Admin simple key legacy support
                if (password === 'santi2024') {
                    localStorage.setItem('adminToken', 'granted');
                    router.push('/admin');
                } else {
                    setError('Clave incorrecta, chango.');
                }
            } else if (isTourist) {
                // Tourist: send magic link via Supabase
                const { data, error: authError } = await supabase.auth.signInWithOtp({ email });
                if (authError) throw authError;
                setSuccess('Te enviamos un enlace de acceso a tu email. Revisalo y hacé click para ingresar.');
            } else {
                if (isRegistering) {
                    // Sign Up Business
                    const { data, error: authError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                role: 'business'
                            }
                        }
                    });
                    if (authError) throw authError;
                    setSuccess('¡Registro exitoso! Revisa tu email para confirmar la cuenta.');

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
                        const status = (authError as any)?.status;
                        const msg = (authError as any)?.message || String(authError);
                        if (status === 429) {
                            setError('Demasiados intentos. Espera un momento e intenta nuevamente.');
                        } else if (/confirm|verify|pending/i.test(msg)) {
                            setError('Tu cuenta no está confirmada. Revisa tu email para confirmar la cuenta.');
                        } else if (/invalid|credentials|user not found/i.test(msg)) {
                            setError('Credenciales inválidas. Verifica email y contraseña.');
                        } else {
                            setError('Error al iniciar sesión: ' + msg);
                        }
                        setLoading(false);
                        return;
                    }

                    // Determine role: check `businesses` table (businesses have their own table), then `profiles`, then metadata.
                    const userId = (await supabase.auth.getUser()).data.user?.id;

                    if (!userId) {
                        setError('No se pudo obtener el id de usuario. Intenta recargar la página.');
                        setLoading(false);
                        return;
                    }

                    // Check businesses table first
                    const { data: businessRow, error: businessError } = await supabase
                        .from('businesses')
                        .select('id')
                        .eq('owner_id', userId)
                        .maybeSingle();

                    if (businessError) {
                        console.warn('Error al buscar business:', businessError);
                        // Show a user-friendly hint but fall back to profile metadata
                        setError('Hubo un problema verificando tu cuenta de negocio. Intenta de nuevo o contacta soporte.');
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
                    const authUser = (await supabase.auth.getUser()).data.user;
                    const roleFromMetadata = authUser?.user_metadata?.role;
                    const role = roleFromProfile || roleFromMetadata || 'user';

                    console.debug('Role resolved:', { role, roleFromProfile, roleFromMetadata });

                    if (role === 'admin') {
                        localStorage.setItem('adminToken', 'granted');
                        router.push('/admin');
                    } else {
                        router.push('/dashboard/tourist');
                    }
                }
            }
        } catch (err: any) {
            const msg = err?.message || String(err);
            const status = err?.status;
            if (status === 429) {
                setError('Hay muchos intentos. Espera un momento e intenta nuevamente.');
            } else if (/confirm|verify|pending/i.test(msg)) {
                setError('Tu cuenta no está confirmada. Revisa tu email para confirmar la cuenta.');
            } else {
                setError('Error: ' + msg);
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
                <img
                    src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                    alt="Santi"
                    style={{ 
                        width: '100px', 
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
                }}>Panel de Control</h1>
                <p style={{ 
                    color: '#64748b', 
                    marginBottom: '35px', 
                    fontSize: '15px',
                    fontWeight: '500'
                }}>Gestión de Atractivos y Negocios</p>

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
                        onClick={() => { setIsAdminMode(true); setIsRegistering(false); setIsTourist(false); }}
                        style={{
                            flex: 1, 
                            padding: '14px 20px', 
                            borderRadius: '50px', 
                            border: 'none',
                            background: isAdminMode ? COLOR_DARK : 'transparent',
                            color: isAdminMode ? COLOR_GOLD : '#64748b',
                            fontWeight: isAdminMode ? 'bold' : '600',
                            cursor: 'pointer',
                            fontSize: '15px',
                            transition: 'all 0.2s ease',
                            boxShadow: isAdminMode ? `0 8px 20px ${COLOR_DARK}44` : 'none'
                        }}
                    >
                        Admin
                    </button>
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
                        Negocio
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
                        Turista
                    </button>
                </div>

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
{!isAdminMode && !isTourist && (
                    <input
                        type="email"
                        placeholder="Email del negocio"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={inputStyle}
                        required
                    />
                )}

                {isTourist && (
                  <input
                    type="email"
                    placeholder="Tu email (te enviaremos enlace de acceso)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    required
                  />
                )}

                {!isTourist && (
                  <input
                    type="password"
                    placeholder={isAdminMode ? "Clave maestra" : "Contraseña"}
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
                        {loading ? 'Procesando...' : (isRegistering ? 'Registrarse' : (isTourist ? 'Enviar enlace' : 'Ingresar'))}
                    </button>
                </form>

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
                      <div style={{ marginTop: 12 }}>
                        <Link href="/explorar" style={{ color: COLOR_BLUE, textDecoration: 'underline', fontWeight: 700 }}>Ingresar como Invitado</Link>
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
