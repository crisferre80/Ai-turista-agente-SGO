"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isAdminMode, setIsAdminMode] = useState(true);
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

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #20B2AA 0%, #D2691E 100%)',
            fontFamily: 'system-ui, sans-serif',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <img
                    src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                    alt="Santi"
                    style={{ width: '80px', marginBottom: '15px' }}
                />
                <h1 style={{ color: '#333', fontSize: '22px', marginBottom: '5px' }}>Panel de Control</h1>
                <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>Gestión de Atractivos y Negocios</p>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', background: '#f5f5f5', padding: '5px', borderRadius: '12px' }}>
                    <button
                        onClick={() => { setIsAdminMode(true); setIsRegistering(false); }}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                            background: isAdminMode ? 'white' : 'transparent',
                            fontWeight: isAdminMode ? 'bold' : 'normal',
                            cursor: 'pointer',
                            boxShadow: isAdminMode ? '0 2px 5px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        Admin
                    </button>
                    <button
                        onClick={() => setIsAdminMode(false)}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                            background: !isAdminMode ? 'white' : 'transparent',
                            fontWeight: !isAdminMode ? 'bold' : 'normal',
                            cursor: 'pointer',
                            boxShadow: !isAdminMode ? '0 2px 5px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        Negocio
                    </button>
                </div>

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {!isAdminMode && (
                        <input
                            type="email"
                            placeholder="Email del negocio"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={inputStyle}
                            required
                        />
                    )}
                    <input
                        type="password"
                        placeholder={isAdminMode ? "Clave maestra" : "Contraseña"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={inputStyle}
                        required
                    />

                    {error && <p style={{ color: '#ff4444', fontSize: '12px', margin: 0 }}>{error}</p>}
                    {success && <p style={{ color: '#20B2AA', fontSize: '12px', margin: 0 }}>{success}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            background: isAdminMode ? '#D2691E' : '#20B2AA',
                            color: 'white',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '16px',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Ingresar')}
                    </button>
                </form>

                {!isAdminMode && (
                    <div style={{ marginTop: '20px' }}>
                        <button
                            onClick={() => setIsRegistering(!isRegistering)}
                            style={{ background: 'none', border: 'none', color: '#20B2AA', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
                        >
                            {isRegistering ? '¿Ya tenés cuenta? Ingresá' : '¿Sos un negocio nuevo? Registrate'}
                        </button>
                    </div>
                )}

                <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            width: '100%',
                            fontWeight: '500'
                        }}
                    >
                        ← Volver al Inicio
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputStyle = {
    padding: '12px 18px',
    borderRadius: '12px',
    border: '1px solid #ddd',
    outline: 'none',
    fontSize: '15px'
};
