"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple mock login for now. In production, use real auth (Supabase/Firebase)
        if (password === 'santi2024') {
            localStorage.setItem('adminToken', 'granted');
            router.push('/admin');
        } else {
            setError('Contraseña incorrecta, chango. Probá de nuevo.');
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #20B2AA 0%, #D2691E 100%)',
            fontFamily: 'system-ui, sans-serif'
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
                    style={{ width: '100px', marginBottom: '20px' }}
                />
                <h1 style={{ color: '#333', fontSize: '24px', marginBottom: '10px' }}>Acceso Admin - Santi</h1>
                <p style={{ color: '#666', marginBottom: '30px' }}>Para que Santi aprenda cosas nuevas.</p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input
                        type="password"
                        placeholder="Introduce la clave secreta"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: '2px solid #eee',
                            outline: 'none',
                            fontSize: '16px'
                        }}
                    />
                    {error && <p style={{ color: '#ff4444', fontSize: '14px', margin: 0 }}>{error}</p>}
                    <button
                        type="submit"
                        style={{
                            background: '#20B2AA',
                            color: 'white',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '16px',
                            transition: 'transform 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        Entrar al Panel
                    </button>
                </form>

                <p style={{ marginTop: '20px', fontSize: '12px', color: '#888' }}>
                    &copy; 2024 Santiago del Estero Virtual
                </p>
            </div>
        </div>
    );
}
