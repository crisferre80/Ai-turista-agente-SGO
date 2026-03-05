"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/error-handler';
import type { AuthError } from '@supabase/supabase-js';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showTour, setShowTour] = useState(false);
    const [tourStep, setTourStep] = useState(0);
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (isAdminMode) {
                // === ADMIN LOGIN ===
                if (!email || !password) {
                    setError('Por favor completa email y contraseña');
                    setLoading(false);
                    return;
                }

                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (authError) {
                    console.error('Admin login error:', authError);
                    setError('Credenciales inválidas o no tienes permisos de administrador');
                    setLoading(false);
                    return;
                }

                // Verificar role admin
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user?.id)
                    .single();

                if (profileError || profileData?.role !== 'admin') {
                    await supabase.auth.signOut();
                    setError('No tienes permisos de administrador');
                    setLoading(false);
                    return;
                }

                localStorage.setItem('adminToken', 'granted');
                router.push('/admin');
            } else {
                // === TOURIST LOGIN/REGISTER ===
                if (!email || !password) {
                    setError('Por favor completa email y contraseña');
                    setLoading(false);
                    return;
                }

                if (isRegistering) {
                    // Registro nuevo turista
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

                    // Verificar que el perfil se creó
                    if (data.user) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        const { data: profile, error: profileError } = await supabase
                            .from('profiles')
                            .select('id, name, role')
                            .eq('id', data.user.id)
                            .maybeSingle();

                        if (profileError) {
                            logError('verificando perfil', profileError);
                        } else if (!profile) {
                            // Fallback: crear perfil manualmente
                            const { error: insertError } = await supabase
                                .from('profiles')
                                .insert({
                                    id: data.user.id,
                                    name: email.split('@')[0],
                                    role: 'tourist',
                                    avatar_url: null
                                });
                            
                            if (insertError) {
                                // algunos objetos de error llegan vacíos ({}), no los mostramos
                                if (Object.keys(insertError).length === 0) {
                                    // nada que hacer
                                } else if (insertError.code && insertError.code !== '23505') {
                                    logError('creando perfil', insertError);
                                } else if (!insertError.code) {
                                    // si no tiene código, también logueamos para diagnóstico
                                    logError('creando perfil (sin código)', insertError);
                                }
                            }
                        }
                    }

                    setSuccess('¡Cuenta creada! Ya puedes iniciar sesión.');
                    setTimeout(() => {
                        setIsRegistering(false);
                        setEmail('');
                        setPassword('');
                        setSuccess('');
                    }, 2000);
                } else {
                    // Login turista existente
                    const { data, error: authError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (authError) {
                        console.error('Login error:', authError);
                        const status = (authError as AuthError).status;
                        const msg = (authError as AuthError).message || String(authError);
                        
                        if (status === 429) {
                            setError('Demasiados intentos. Espera un momento e intenta de nuevo.');
                        } else if (/invalid|credentials|user not found/i.test(msg)) {
                            setError('Email o contraseña incorrectos');
                        } else {
                            setError('Error al iniciar sesión: ' + msg);
                        }
                        setLoading(false);
                        return;
                    }

                    // Verificar el perfil existe
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', data.user?.id)
                        .maybeSingle();

                    if (profileError || !profileData) {
                        // Crear perfil si no existe
                        await supabase.from('profiles').insert({
                            id: data.user.id,
                            name: email.split('@')[0],
                            role: 'tourist',
                            avatar_url: null
                        });
                    }

                    setSuccess('¡Bienvenido de vuelta!');
                    setTimeout(() => router.push('/explorar'), 1000);
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const status = (err as { status?: number }).status;
            
            if (status === 429) {
                setError('Demasiados intentos. Espera un momento.');
            } else if (/confirm|verify|pending/i.test(msg)) {
                setError('Tu cuenta aún no ha sido confirmada. Revisa tu email.');
            } else {
                setError('Error: ' + msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const COLOR_GOLD = '#F1C40F';
    const COLOR_BLUE = '#1A3A6C';

    // Tour slides con mensaje promocional e imágenes
    const tourSlides = [
        {
            title: "🏛️ Santiago del Estero",
            text: "Santiago del Estero es historia viva. Es cultura, tradición, naturaleza y hospitalidad. Es la Madre de Ciudades… Y hoy, también puede ser la capital del turismo inteligente del norte argentino.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "🎯 El Turista Actual",
            text: "El turista actual no solo busca información. Busca experiencias personalizadas. Quiere respuestas inmediatas. Quiere descubrir lo que no aparece en los folletos tradicionales.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "🤖 Nace Santi IA",
            text: "Por eso nace Santi IA, el primer guía turístico virtual inteligente desarrollado para Santiago del Estero. Una aplicación que combina inteligencia artificial, geolocalización y datos turísticos provinciales.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "💬 Asistente Inteligente",
            text: "El asistente responde en tiempo real, recomienda rutas, sugiere gastronomía local, cuenta la historia de nuestros monumentos y promueve nuestros comercios.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "🗺️ Funcionalidades",
            text: "Santi IA permite explorar la provincia con mapas interactivos. Recibir recomendaciones personalizadas según intereses. Escuchar información histórica con voz digital en español argentino.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "🏪 Impulsa tu Negocio",
            text: "Promover comercios locales con estadísticas reales. Y generar datos estratégicos para planificación turística.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "📊 Herramienta Estratégica",
            text: "Santi IA no es solo una app. Es una herramienta estratégica para el desarrollo provincial. Permite medir comportamiento turístico en tiempo real. Impulsa la economía local. Fortalece la identidad cultural.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "🚀 El Futuro",
            text: "El futuro incluye integración con reservas, pagos digitales, múltiples idiomas y realidad aumentada en sitios históricos. Un ecosistema turístico inteligente, escalable a cada municipio de la provincia.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        },
        {
            title: "🌟 Pionera en Innovación",
            text: "Santiago del Estero fue la primera ciudad del país. Hoy puede ser también pionera en turismo inteligente. Santi IA. Tecnología desarrollada en la provincia. Pensada para potenciar la provincia.",
            image: "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
        }
    ];

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
                maxWidth: '420px',
                textAlign: 'center',
                border: `2px solid ${COLOR_GOLD}33`
            }}>
                {/* Logo */}
                <div style={{ width: '60px', height: '90px', margin: '0 auto' }}>
                    <Image
                        src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                        alt="Santi"
                        width={40}
                        height={40}
                        style={{ 
                            width: '100%',
                            height: '100%',
                            marginBottom: '15px',
                            filter: 'drop-shadow(0 8px 20px rgba(241,196,15,0.4))',
                            borderRadius: '50%'
                        }}
                    />
                </div>

                {/* Botón Tour - Solo para turistas */}
                {!isAdminMode && (
                    <button
                        onClick={() => setShowTour(true)}
                        style={{
                            background: `linear-gradient(135deg, ${COLOR_GOLD}, #FFD93D)`,
                            color: COLOR_BLUE,
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '25px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            marginBottom: '20px',
                            boxShadow: `0 4px 15px ${COLOR_GOLD}66`,
                            transition: 'all 0.3s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = `0 6px 20px ${COLOR_GOLD}99`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = `0 4px 15px ${COLOR_GOLD}66`;
                        }}
                    >
                        ✨ Conoce a Santi
                    </button>
                )}

                {/* Title */}
                <h1 style={{ 
                    color: COLOR_BLUE, 
                    fontSize: isAdminMode ? '24px' : '32px', 
                    marginBottom: '10px',
                    fontWeight: '950',
                    letterSpacing: '-0.5px'
                }}>
                    {isAdminMode ? '🔐 Acceso Administrativo' : '🌎 Bienvenido a Santi Guia'}
                </h1>
                <p style={{ 
                    color: '#64748b', 
                    marginBottom: '35px', 
                    fontSize: '15px',
                    fontWeight: '500'
                }}>
                    {isAdminMode 
                        ? 'Panel de administración del sistema'
                        : isRegistering 
                            ? 'Crea tu cuenta y empieza a explorar' 
                            : 'Tu guía turístico virtual en Santiago'
                    }
                </p>

                {/* Error/Success Messages */}
                {error && (
                    <div style={{
                        background: '#fee',
                        color: '#c33',
                        padding: '15px 20px',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        fontWeight: '600'
                    }}>
                        ❌ {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        background: '#efe',
                        color: '#383',
                        padding: '15px 20px',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        fontWeight: '600'
                    }}>
                        ✅ {success}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input
                        type="email"
                        placeholder={isAdminMode ? 'Email de administrador' : 'Tu email'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                            padding: '16px 22px',
                            borderRadius: '50px',
                            border: '2px solid #e2e8f0',
                            outline: 'none',
                            fontSize: '16px',
                            transition: 'all 0.2s ease',
                            fontWeight: '500'
                        }}
                        required
                        autoComplete="email"
                    />

                    <input
                        type="password"
                        placeholder="Tu contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                            padding: '16px 22px',
                            borderRadius: '50px',
                            border: '2px solid #e2e8f0',
                            outline: 'none',
                            fontSize: '16px',
                            transition: 'all 0.2s ease',
                            fontWeight: '500'
                        }}
                        required
                        autoComplete={isRegistering ? 'new-password' : 'current-password'}
                        minLength={isRegistering ? 6 : undefined}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '16px 22px',
                            borderRadius: '50px',
                            border: 'none',
                            background: isAdminMode ? '#EF4444' : COLOR_BLUE,
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: `0 8px 20px ${isAdminMode ? '#EF444444' : COLOR_BLUE + '44'}`,
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading 
                            ? '⏳ Cargando...' 
                            : isAdminMode 
                                ? '🔐 Ingresar como Admin'
                                : isRegistering 
                                    ? '✨ Crear Cuenta' 
                                    : '🚀 Ingresar'
                        }
                    </button>
                </form>

                {/* Toggle Login/Register (solo para turistas) */}
                {!isAdminMode && (
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
                            {isRegistering 
                                ? '← ¿Ya tienes cuenta? Inicia sesión' 
                                : '✨ ¿No tienes cuenta? Regístrate gratis'
                            }
                        </button>
                    </div>
                )}

                {/* Divider */}
                <div style={{ marginTop: '30px', paddingTop: '25px', borderTop: '2px solid #f1f5f9' }}>
                    
                    {/* Secondary Options */}
                    {!isAdminMode && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {/* Business Register Link */}
                            <Link
                                href="/business/register"
                                style={{
                                    background: `${COLOR_GOLD}11`,
                                    border: `2px solid ${COLOR_GOLD}`,
                                    color: COLOR_BLUE,
                                    padding: '14px 20px',
                                    borderRadius: '50px',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                🏢 ¿Tienes un negocio? Regístralo aquí
                            </Link>

                            {/* Home Button */}
                            <button
                                onClick={() => router.push('/')}
                                style={{
                                    background: 'white',
                                    border: `2px solid ${COLOR_BLUE}22`,
                                    color: COLOR_BLUE,
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    padding: '12px',
                                    borderRadius: '50px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                ← Volver al Inicio
                            </button>

                            {/* Admin Link (discreto) */}
                            <button
                                onClick={() => setIsAdminMode(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    textDecoration: 'underline',
                                    fontWeight: '500',
                                    opacity: 0.5,
                                    marginTop: '10px'
                                }}
                            >
                                Admin
                            </button>
                        </div>
                    )}

                    {/* Back from Admin Mode */}
                    {isAdminMode && (
                        <button
                            onClick={() => { setIsAdminMode(false); setEmail(''); setPassword(''); setError(''); }}
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
                            ← Volver a inicio de sesión normal
                        </button>
                    )}
                </div>

                {/* Footer hint */}
                {!isAdminMode && !isRegistering && (
                    <p style={{ 
                        fontSize: '12px', 
                        color: '#94a3b8', 
                        marginTop: '20px',
                        fontStyle: 'italic'
                    }}>
                        💡 También puedes <Link href="/explorar" style={{ color: COLOR_BLUE, fontWeight: '600' }}>explorar sin cuenta</Link>
                    </p>
                )}
            </div>

            {/* Modal Tour Interactivo */}
            {showTour && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px',
                    backdropFilter: 'blur(8px)',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        maxWidth: '700px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        border: `3px solid ${COLOR_GOLD}`,
                        boxShadow: `0 20px 60px rgba(241,196,15,0.4)`,
                        position: 'relative',
                        animation: 'slideUp 0.4s ease'
                    }}>
                        {/* Botón Cerrar */}
                        <button
                            onClick={() => { setShowTour(false); setTourStep(0); }}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: '#EF4444',
                                color: 'white',
                                border: 'none',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                fontSize: '20px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                zIndex: 10,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            ×
                        </button>

                        {/* Contenido del Slide */}
                        <div style={{ padding: '60px 40px 40px 40px', textAlign: 'center' }}>
                            {/* Imagen/Captura */}
                            <div style={{
                                marginBottom: '30px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                            }}>
                                <Image
                                    src={tourSlides[tourStep].image}
                                    alt={tourSlides[tourStep].title}
                                    width={600}
                                    height={400}
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        objectFit: 'cover'
                                    }}
                                />
                            </div>

                            {/* Título */}
                            <h2 style={{
                                color: COLOR_BLUE,
                                fontSize: '28px',
                                fontWeight: '900',
                                marginBottom: '20px',
                                lineHeight: '1.3'
                            }}>
                                {tourSlides[tourStep].title}
                            </h2>

                            {/* Texto */}
                            <p style={{
                                color: '#475569',
                                fontSize: '16px',
                                lineHeight: '1.8',
                                marginBottom: '40px',
                                maxWidth: '600px',
                                margin: '0 auto 40px auto'
                            }}>
                                {tourSlides[tourStep].text}
                            </p>

                            {/* Indicadores de progreso */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '10px',
                                marginBottom: '30px'
                            }}>
                                {tourSlides.map((_, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            width: index === tourStep ? '30px' : '10px',
                                            height: '10px',
                                            borderRadius: '5px',
                                            background: index === tourStep ? COLOR_GOLD : '#E2E8F0',
                                            transition: 'all 0.3s ease',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setTourStep(index)}
                                    />
                                ))}
                            </div>

                            {/* Navegación y Acciones */}
                            {tourStep < tourSlides.length - 1 ? (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '15px'
                                }}>
                                    <button
                                        onClick={() => setTourStep(Math.max(0, tourStep - 1))}
                                        disabled={tourStep === 0}
                                        style={{
                                            flex: 1,
                                            padding: '14px 20px',
                                            background: tourStep === 0 ? '#E2E8F0' : 'white',
                                            border: `2px solid ${COLOR_BLUE}`,
                                            color: COLOR_BLUE,
                                            borderRadius: '12px',
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            cursor: tourStep === 0 ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                            opacity: tourStep === 0 ? 0.5 : 1
                                        }}
                                    >
                                        ← Anterior
                                    </button>

                                    <button
                                        onClick={() => setTourStep(Math.min(tourSlides.length - 1, tourStep + 1))}
                                        style={{
                                            flex: 1,
                                            padding: '14px 20px',
                                            background: COLOR_GOLD,
                                            border: 'none',
                                            color: COLOR_BLUE,
                                            borderRadius: '12px',
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            boxShadow: `0 4px 15px ${COLOR_GOLD}66`,
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        Siguiente →
                                    </button>
                                </div>
                            ) : (
                                // Último slide - Llamado a la acción
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '15px'
                                }}>
                                    <button
                                        onClick={() => {
                                            setShowTour(false);
                                            setTourStep(0);
                                            router.push('/explorar');
                                        }}
                                        style={{
                                            padding: '16px 24px',
                                            background: COLOR_GOLD,
                                            border: 'none',
                                            color: COLOR_BLUE,
                                            borderRadius: '12px',
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            boxShadow: `0 6px 20px ${COLOR_GOLD}88`,
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                            e.currentTarget.style.boxShadow = `0 8px 25px ${COLOR_GOLD}AA`;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.boxShadow = `0 6px 20px ${COLOR_GOLD}88`;
                                        }}
                                    >
                                        🎯 Empezar Ahora
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowTour(false);
                                            setTourStep(0);
                                            setIsRegistering(true);
                                        }}
                                        style={{
                                            padding: '16px 24px',
                                            background: 'white',
                                            border: `2px solid ${COLOR_BLUE}`,
                                            color: COLOR_BLUE,
                                            borderRadius: '12px',
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        ✨ Crear mi Cuenta
                                    </button>

                                    <button
                                        onClick={() => setTourStep(0)}
                                        style={{
                                            padding: '12px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#64748b',
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        ← Volver al inicio del tour
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
