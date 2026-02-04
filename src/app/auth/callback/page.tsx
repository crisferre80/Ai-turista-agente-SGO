"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // Obtener la sesión del hash/query params del magic link
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Error en auth callback:', error);
                    router.push('/login?error=auth-failed');
                    return;
                }

                if (session) {
                    const userId = session.user.id;
                    const userEmail = session.user.email;

                    console.log('✅ Sesión de turista autenticada:', { userId, userEmail });

                    // Verificar si ya existe perfil
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('id, role')
                        .eq('id', userId)
                        .maybeSingle();

                    // Si no existe perfil, crearlo
                    if (!existingProfile) {
                        console.log('📝 Creando perfil de turista...');
                        
                        const { error: insertError } = await supabase
                            .from('profiles')
                            .insert({
                                id: userId,
                                name: userEmail?.split('@')[0] || 'Turista',
                                role: 'tourist',
                                avatar_url: null
                            });

                        if (insertError) {
                            console.error('❌ Error al crear perfil:', insertError);
                        } else {
                            console.log('✅ Perfil de turista creado exitosamente');
                        }
                    } else {
                        console.log('✅ Perfil ya existente:', existingProfile);
                    }

                    // Redirigir a la página de explorar (como turista)
                    router.push('/explorar');
                } else {
                    // No hay sesión, redirigir al login
                    router.push('/login');
                }
            } catch (error) {
                console.error('❌ Error general en auth callback:', error);
                router.push('/login?error=unexpected');
            }
        };

        handleAuthCallback();
    }, [router]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1A3A6C 0%, #9E1B1B 100%)',
            color: 'white',
            padding: '20px',
            textAlign: 'center'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: '40px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxWidth: '400px'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #1A3A6C',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 20px'
                }} />
                <h2 style={{ color: '#1A3A6C', margin: '0 0 10px 0' }}>
                    Verificando acceso...
                </h2>
                <p style={{ color: '#64748b', margin: 0 }}>
                    Estamos preparando tu experiencia
                </p>
            </div>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
