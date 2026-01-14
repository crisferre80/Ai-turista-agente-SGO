"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
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

    if (loading) return <div style={{ color: 'white', textAlign: 'center', padding: '100px' }}>Cargando tu identidad...</div>;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #20B2AA 0%, #D2691E 100%)', padding: '40px 20px', fontFamily: 'system-ui' }}>
            <button onClick={() => router.push('/')} style={backBtn}>← Volver al Mapa</button>

            <div style={containerStyle}>
                <div style={headerStyle}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={profile.avatar_url || 'https://via.placeholder.com/150'}
                            alt="Avatar"
                            style={avatarStyle}
                        />
                        {editing && (
                            <label style={uploadOverlay}>
                                📷
                                <input type="file" hidden onChange={e => setAvatarFile(e.target.files?.[0] || null)} />
                            </label>
                        )}
                    </div>
                    <h1 style={{ margin: '15px 0 5px 0', fontSize: '28px' }}>{newName || profile.name}</h1>
                    <p style={{ color: '#666', fontStyle: 'italic' }}>{newBio || profile.bio}</p>
                </div>

                {editing ? (
                    <form onSubmit={handleUpdate} style={formStyle}>
                        <label style={labelStyle}>Tu Nombre</label>
                        <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="¿Cómo te decimos?" />

                        <label style={labelStyle}>Sobre tí</label>
                        <textarea style={textareaStyle} value={newBio} onChange={e => setNewBio(e.target.value)} placeholder="Contanos algo de vos..." rows={3} />

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button type="submit" style={saveBtn}>Guardar Cambios</button>
                            <button type="button" onClick={() => setEditing(false)} style={cancelBtn}>Cancelar</button>
                        </div>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button onClick={() => setEditing(true)} style={editBtn}>Editar Perfil</button>

                        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #eee' }} />

                        <div style={{ textAlign: 'left' }}>
                            <h3>Mis Relatos 🎙️</h3>
                            <p style={{ color: '#888', fontSize: '14px' }}>Aquí aparecerán las historias que grabes en los atractivos turísticos.</p>
                            <div style={emptyStories}>
                                <span style={{ fontSize: '30px' }}>🌵</span>
                                <p>Todavía no has contado ninguna historia. ¡Anímate a grabar una en el mapa!</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Styles
const backBtn = { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' as const, padding: '10px 20px', borderRadius: '50px', cursor: 'pointer', marginBottom: '20px', fontWeight: 'bold' };
const containerStyle = { maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' };
const headerStyle = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginBottom: '30px', textAlign: 'center' as const };
const avatarStyle = { width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover' as const, border: '4px solid #f0f0f0' };
const uploadOverlay = { position: 'absolute' as const, bottom: '5px', right: '5px', background: 'white', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', fontSize: '18px' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '15px' };

const labelStyle = { color: '#555', fontSize: '14px', fontWeight: 'bold' };
const inputStyle = { padding: '12px', border: '1px solid #ddd', borderRadius: '12px', outline: 'none' };
const textareaStyle = { padding: '12px', border: '1px solid #ddd', borderRadius: '12px', outline: 'none', fontFamily: 'inherit' };
const saveBtn = { flex: 1, background: '#D2691E', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' };
const cancelBtn = { background: '#f0f0f0', color: '#555', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' };
const editBtn = { background: '#20B2AA', color: 'white', border: 'none', padding: '10px 30px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' };
const emptyStories = { background: '#fafafa', borderRadius: '16px', padding: '40px', textAlign: 'center' as const, marginTop: '20px', border: '2px dashed #eee' };
