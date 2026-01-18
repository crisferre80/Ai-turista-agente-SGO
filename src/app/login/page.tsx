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
                } else {
                    // Login Business
                    const { data, error: authError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });
                    if (authError) throw authError;

                    localStorage.setItem('adminToken', 'granted');
                    router.push('/admin');
                }
            }
        } catch (err: any) {
            setError('Error: ' + err.message);
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
