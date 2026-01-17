"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { takePhoto } from '@/lib/photoService';

export default function ProfilePage() {
    const COLOR_GOLD = '#F1C40F';
    const COLOR_BLUE = '#1A3A6C';
    const COLOR_DARK = '#0e1f1d';
    
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    const [newName, setNewName] = useState('');
    const [newBio, setNewBio] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        // For now, we use a mock user ID or handle auth session
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Mock profile if not logged in for demo purposes
            setProfile({
                name: 'Turista Santiagueño',
                bio: 'Amante de la chacarera y el calor del Pago.',
                avatar_url: 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png'
            });
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) {
            setProfile(data);
            setNewName(data.name || '');
            setNewBio(data.bio || '');
        }
        setLoading(false);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let avatarUrl = profile.avatar_url;

        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, avatarFile);

            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
                avatarUrl = publicUrl;
            }
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    name: newName,
                    bio: newBio,
                    avatar_url: avatarUrl,
                    updated_at: new Date()
                });

            if (error) alert(error.message);
            else {
                setEditing(false);
                fetchProfile();
            }
        } else {
            alert("Inicia sesión para guardar cambios reales, chango.");
            setProfile({ ...profile, name: newName, bio: newBio, avatar_url: avatarUrl });
            setEditing(false);
        }
        setLoading(false);
    };

    if (loading) return <div style={{ 
        color: COLOR_BLUE, 
        textAlign: 'center', 
        padding: '100px',
        background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
        minHeight: '100vh',
        fontWeight: 'bold',
        fontSize: '18px'
    }}>Cargando tu identidad...</div>;

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)', 
            padding: '40px 20px', 
            fontFamily: 'system-ui, -apple-system, sans-serif' 
        }}>
            <button 
                onClick={() => router.push('/')} 
                style={{
                    background: COLOR_GOLD,
                    border: 'none',
                    color: COLOR_DARK,
                    padding: '14px 28px',
                    borderRadius: '50px',
                    cursor: 'pointer',
                    marginBottom: '30px',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    boxShadow: `0 8px 20px ${COLOR_GOLD}44`,
                    transition: 'all 0.2s ease'
                }}
            >← Volver al Mapa</button>

            <div style={{
                maxWidth: '700px',
                margin: '0 auto',
                background: 'white',
                borderRadius: '32px',
                padding: '50px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                border: `2px solid ${COLOR_GOLD}33`
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '40px',
                    textAlign: 'center'
                }}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={profile.avatar_url || 'https://via.placeholder.com/150'}
                            alt="Avatar"
                            style={{
                                width: '140px',
                                height: '140px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `4px solid ${COLOR_GOLD}`,
                                boxShadow: `0 12px 30px ${COLOR_GOLD}44`
                            }}
                        />
                        {editing && (
                            <div
                                onClick={async () => {
                                    const photo = await takePhoto();
                                    if (photo) {
                                        const file = new File([photo.blob], `avatar-${Date.now()}.${photo.format}`, { type: `image/${photo.format}` });
                                        setAvatarFile(file);
                                        setProfile((prev: any) => ({ ...prev, avatar_url: URL.createObjectURL(file) }));
                                    }
                                }}
                                style={{
                                    position: 'absolute',
                                    bottom: '5px',
                                    right: '5px',
                                    background: COLOR_GOLD,
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: `0 4px 15px ${COLOR_GOLD}66`,
                                    fontSize: '20px'
                                }}
                            >
                                📷
                            </div>
                        )}
                    </div>
                    <h1 style={{ 
                        margin: '20px 0 8px 0', 
                        fontSize: '32px',
                        color: COLOR_BLUE,
                        fontWeight: '950',
                        letterSpacing: '-0.5px'
                    }}>{newName || profile.name}</h1>
                    <p style={{ 
                        color: '#64748b', 
                        fontStyle: 'italic',
                        fontSize: '16px',
                        fontWeight: '500'
                    }}>{newBio || profile.bio}</p>
                </div>

                {editing ? (
                    <form onSubmit={handleUpdate} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <label style={{ 
                            color: COLOR_BLUE, 
                            fontSize: '15px', 
                            fontWeight: 'bold'
                        }}>Tu Nombre</label>
                        <input 
                            style={{
                                padding: '16px 22px',
                                border: `2px solid #e2e8f0`,
                                borderRadius: '50px',
                                outline: 'none',
                                fontSize: '16px',
                                transition: 'all 0.2s ease',
                                fontWeight: '500'
                            }} 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)} 
                            placeholder="¿Cómo te decimos?" 
                        />

                        <label style={{ 
                            color: COLOR_BLUE, 
                            fontSize: '15px', 
                            fontWeight: 'bold'
                        }}>Sobre tí</label>
                        <textarea 
                            style={{
                                padding: '16px 22px',
                                border: `2px solid #e2e8f0`,
                                borderRadius: '24px',
                                outline: 'none',
                                fontFamily: 'inherit',
                                fontSize: '16px',
                                transition: 'all 0.2s ease',
                                fontWeight: '500'
                            }} 
                            value={newBio} 
                            onChange={e => setNewBio(e.target.value)} 
                            placeholder="Contanos algo de vos..." 
                            rows={4} 
                        />

                        <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                            <button 
                                type="submit" 
                                style={{
                                    flex: 1,
                                    background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`,
                                    color: COLOR_DARK,
                                    border: 'none',
                                    padding: '16px',
                                    borderRadius: '50px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    boxShadow: `0 10px 30px ${COLOR_GOLD}44`,
                                    transition: 'all 0.2s ease'
                                }}
                            >Guardar Cambios</button>
                            <button 
                                type="button" 
                                onClick={() => setEditing(false)} 
                                style={{
                                    background: 'white',
                                    color: COLOR_BLUE,
                                    border: `2px solid ${COLOR_BLUE}22`,
                                    padding: '16px 28px',
                                    borderRadius: '50px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    transition: 'all 0.2s ease'
                                }}
                            >Cancelar</button>
                        </div>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', marginTop: '25px' }}>
                        <button 
                            onClick={() => setEditing(true)} 
                            style={{
                                background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`,
                                color: COLOR_DARK,
                                border: 'none',
                                padding: '14px 36px',
                                borderRadius: '50px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '16px',
                                boxShadow: `0 10px 30px ${COLOR_GOLD}44`,
                                transition: 'all 0.2s ease'
                            }}
                        >Editar Perfil</button>

                        <hr style={{ 
                            margin: '45px 0', 
                            border: 'none', 
                            borderTop: `2px solid ${COLOR_GOLD}22` 
                        }} />

                        <div style={{ textAlign: 'left' }}>
                            <h3 style={{ 
                                color: COLOR_BLUE, 
                                fontSize: '24px',
                                fontWeight: 'bold',
                                marginBottom: '12px'
                            }}>Mis Relatos 🎙️</h3>
                            <p style={{ 
                                color: '#64748b', 
                                fontSize: '15px',
                                fontWeight: '500',
                                marginBottom: '25px'
                            }}>Aquí aparecerán las historias que grabes en los atractivos turísticos.</p>
                            <div style={{
                                background: '#f8fafc',
                                borderRadius: '24px',
                                padding: '50px',
                                textAlign: 'center',
                                marginTop: '20px',
                                border: `3px dashed ${COLOR_GOLD}44`
                            }}>
                                <span style={{ fontSize: '48px' }}>🌵</span>
                                <p style={{ 
                                    color: '#64748b', 
                                    marginTop: '15px',
                                    fontSize: '16px',
                                    fontWeight: '500'
                                }}>Todavía no has contado ninguna historia. ¡Anímate a grabar una en el mapa!</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
