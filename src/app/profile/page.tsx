"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { takePhoto } from '@/lib/photoService';

interface UserProfile {
    id: string;
    name: string;
    avatar_url: string;
    bio?: string;
    role: string;
    created_at: string;
    preferences?: {
        favorite_categories: string[];
        language: string;
        notifications: boolean;
    };
    stats?: {
        places_visited: number;
        stories_recorded: number;
        reviews_left: number;
        badges_earned: string[];
    };
}

interface UserNarration {
    id: string;
    text_content: string;
    audio_url: string;
    created_at: string;
    attraction: {
        name: string;
        category: string;
    };
}

export default function ProfilePage() {
    const COLOR_GOLD = '#F1C40F';
    const COLOR_BLUE = '#1A3A6C';
    const COLOR_DARK = '#0e1f1d';
    const COLOR_GREEN = '#10B981';
    
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [narrations, setNarrations] = useState<UserNarration[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'stories' | 'stats'>('profile');

    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        favorite_categories: [] as string[],
        language: 'es',
        notifications: true
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    useEffect(() => {
        fetchProfile();
        fetchNarrations();
    }, []);

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Mock profile for demo purposes
            const mockProfile: UserProfile = {
                id: 'mock-user',
                name: 'Turista Santiagueño',
                bio: 'Amante de la chacarera y el calor del Pago. Explorando los rincones más hermosos de Santiago del Estero.',
                avatar_url: 'https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png',
                role: 'user',
                created_at: new Date().toISOString(),
                preferences: {
                    favorite_categories: ['historico', 'naturaleza'],
                    language: 'es',
                    notifications: true
                },
                stats: {
                    places_visited: 12,
                    stories_recorded: 5,
                    reviews_left: 8,
                    badges_earned: ['Explorador Novato', 'Contador de Historias']
                }
            };
            setProfile(mockProfile);
            setFormData({
                name: mockProfile.name,
                bio: mockProfile.bio || '',
                favorite_categories: mockProfile.preferences?.favorite_categories || [],
                language: mockProfile.preferences?.language || 'es',
                notifications: mockProfile.preferences?.notifications || true
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
            const profileWithStats: UserProfile = {
                ...data,
                stats: {
                    places_visited: 0,
                    stories_recorded: 0,
                    reviews_left: 0,
                    badges_earned: []
                }
            };
            setProfile(profileWithStats);
            setFormData({
                name: data.name || '',
                bio: data.bio || '',
                favorite_categories: data.preferences?.favorite_categories || [],
                language: data.preferences?.language || 'es',
                notifications: data.preferences?.notifications || true
            });
        }
        setLoading(false);
    };

    const fetchNarrations = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            const { data } = await supabase
                .from('narrations')
                .select(`
                    id,
                    text_content,
                    audio_url,
                    created_at,
                    attractions (
                        name,
                        category
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data) {
                setNarrations(data.map(item => ({
                    id: item.id,
                    text_content: item.text_content,
                    audio_url: item.audio_url,
                    created_at: item.created_at,
                    attraction: {
                        name: item.attractions?.name || 'Lugar desconocido',
                        category: item.attractions?.category || 'general'
                    }
                })));
            }
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let avatarUrl = profile?.avatar_url;

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
                    name: formData.name,
                    bio: formData.bio,
                    avatar_url: avatarUrl,
                    preferences: {
                        favorite_categories: formData.favorite_categories,
                        language: formData.language,
                        notifications: formData.notifications
                    },
                    updated_at: new Date()
                });

            if (error) {
                alert(error.message);
            } else {
                setEditing(false);
                fetchProfile();
            }
        } else {
            // Demo mode
            alert("Inicia sesión para guardar cambios reales.");
            if (profile) {
                setProfile({ 
                    ...profile, 
                    name: formData.name, 
                    bio: formData.bio, 
                    avatar_url: avatarUrl || profile.avatar_url,
                    preferences: {
                        favorite_categories: formData.favorite_categories,
                        language: formData.language,
                        notifications: formData.notifications
                    }
                });
            }
            setEditing(false);
        }
        setLoading(false);
    };

    const getCategoryIcon = (category: string) => {
        const icons: Record<string, string> = {
            'historico': '🏛️',
            'naturaleza': '🌿',
            'compras': '🛍️',
            'gastronomia': '🍽️',
            'artesania': '🎨',
            'deportes': '⚽',
            'cultura': '🎭'
        };
        return icons[category] || '📍';
    };

    const getBadgeIcon = (badge: string) => {
        const icons: Record<string, string> = {
            'Explorador Novato': '🚀',
            'Contador de Historias': '🎙️',
            'Fotógrafo Aventurero': '📸',
            'Guía Local': '🗺️',
            'Crítico Gastronómico': '👨‍🍳'
        };
        return icons[badge] || '🏆';
    };

    if (loading) return (
        <div style={{ 
            color: COLOR_BLUE, 
            textAlign: 'center', 
            padding: '100px',
            background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
            minHeight: '100vh',
            fontWeight: 'bold',
            fontSize: '18px'
        }}>
            <div style={{
                width: '50px',
                height: '50px',
                border: `4px solid ${COLOR_GOLD}33`,
                borderTop: `4px solid ${COLOR_GOLD}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
            }} />
            Cargando tu perfil...
        </div>
    );

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)', 
            padding: '20px', 
            fontFamily: 'system-ui, -apple-system, sans-serif' 
        }}>
            {/* Header Navigation */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '30px' }}>
                <button 
                    onClick={() => router.push('/')} 
                    style={{
                        background: COLOR_GOLD,
                        border: 'none',
                        color: COLOR_DARK,
                        padding: '12px 24px',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        boxShadow: `0 4px 15px ${COLOR_GOLD}44`,
                        transition: 'all 0.2s ease'
                    }}
                >
                    ← Volver al Mapa
                </button>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Profile Header Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '40px',
                    marginBottom: '30px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                    border: `2px solid ${COLOR_GOLD}22`
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '30px',
                        flexWrap: 'wrap'
                    }}>
                        {/* Avatar Section */}
                        <div style={{ position: 'relative' }}>
                            <img
                                src={profile?.avatar_url || 'https://via.placeholder.com/150'}
                                alt="Avatar"
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: `4px solid ${COLOR_GOLD}`,
                                    boxShadow: `0 8px 25px ${COLOR_GOLD}44`
                                }}
                            />
                            {editing && (
                                <div
                                    onClick={async () => {
                                        const photo = await takePhoto();
                                        if (photo) {
                                            const file = new File([photo.blob], `avatar-${Date.now()}.${photo.format}`, { type: `image/${photo.format}` });
                                            setAvatarFile(file);
                                            if (profile) {
                                                setProfile({ ...profile, avatar_url: URL.createObjectURL(file) });
                                            }
                                        }
                                    }}
                                    style={{
                                        position: 'absolute',
                                        bottom: '5px',
                                        right: '5px',
                                        background: COLOR_GOLD,
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: `0 4px 15px ${COLOR_GOLD}66`,
                                        fontSize: '16px'
                                    }}
                                >
                                    📷
                                </div>
                            )}
                        </div>

                        {/* Profile Info */}
                        <div style={{ flex: 1 }}>
                            <h1 style={{ 
                                margin: '0 0 8px 0', 
                                fontSize: '32px',
                                color: COLOR_BLUE,
                                fontWeight: '800'
                            }}>
                                {profile?.name}
                            </h1>
                            <p style={{ 
                                color: '#64748b', 
                                fontSize: '16px',
                                margin: '0 0 15px 0',
                                lineHeight: '1.5'
                            }}>
                                {profile?.bio || 'Explorador apasionado de Santiago del Estero'}
                            </p>
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                        {profile?.stats?.places_visited || 0}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                                        Lugares Visitados
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                        {profile?.stats?.stories_recorded || 0}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                                        Historias Grabadas
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                        {profile?.stats?.reviews_left || 0}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                                        Reseñas Escritas
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div>
                            {!editing ? (
                                <button 
                                    onClick={() => setEditing(true)} 
                                    style={{
                                        background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`,
                                        color: COLOR_DARK,
                                        border: 'none',
                                        padding: '12px 24px',
                                        borderRadius: '50px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        boxShadow: `0 6px 20px ${COLOR_GOLD}44`,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    ✏️ Editar Perfil
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button 
                                        onClick={handleUpdate} 
                                        style={{
                                            background: COLOR_GREEN,
                                            color: 'white',
                                            border: 'none',
                                            padding: '12px 20px',
                                            borderRadius: '50px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        ✓ Guardar
                                    </button>
                                    <button 
                                        onClick={() => setEditing(false)} 
                                        style={{
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            padding: '12px 20px',
                                            borderRadius: '50px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        ✕ Cancelar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{
                    display: 'flex',
                    background: 'white',
                    borderRadius: '16px',
                    padding: '8px',
                    marginBottom: '30px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                    gap: '8px'
                }}>
                    {[
                        { key: 'profile' as const, label: 'Mi Perfil', icon: '👤' },
                        { key: 'stories' as const, label: 'Mis Historias', icon: '🎙️' },
                        { key: 'stats' as const, label: 'Estadísticas', icon: '📊' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                flex: 1,
                                padding: '12px 20px',
                                background: activeTab === tab.key ? COLOR_GOLD : 'transparent',
                                color: activeTab === tab.key ? COLOR_DARK : '#64748b',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: activeTab === tab.key ? 'bold' : '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                fontSize: '14px'
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'profile' && (
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        padding: '40px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}>
                        {editing ? (
                            <form onSubmit={handleUpdate}>
                                <div style={{ display: 'grid', gap: '25px' }}>
                                    <div>
                                        <label style={{ 
                                            display: 'block',
                                            color: COLOR_BLUE, 
                                            fontSize: '14px', 
                                            fontWeight: 'bold',
                                            marginBottom: '8px'
                                        }}>Nombre Completo</label>
                                        <input 
                                            style={{
                                                width: '100%',
                                                padding: '14px 18px',
                                                border: `2px solid #e2e8f0`,
                                                borderRadius: '12px',
                                                outline: 'none',
                                                fontSize: '16px',
                                                transition: 'all 0.2s ease',
                                                fontWeight: '500'
                                            }} 
                                            value={formData.name} 
                                            onChange={e => setFormData({...formData, name: e.target.value})} 
                                            placeholder="Tu nombre completo" 
                                        />
                                    </div>

                                    <div>
                                        <label style={{ 
                                            display: 'block',
                                            color: COLOR_BLUE, 
                                            fontSize: '14px', 
                                            fontWeight: 'bold',
                                            marginBottom: '8px'
                                        }}>Biografía</label>
                                        <textarea 
                                            style={{
                                                width: '100%',
                                                padding: '14px 18px',
                                                border: `2px solid #e2e8f0`,
                                                borderRadius: '12px',
                                                outline: 'none',
                                                fontFamily: 'inherit',
                                                fontSize: '16px',
                                                transition: 'all 0.2s ease',
                                                fontWeight: '500',
                                                minHeight: '100px',
                                                resize: 'vertical'
                                            }} 
                                            value={formData.bio} 
                                            onChange={e => setFormData({...formData, bio: e.target.value})} 
                                            placeholder="Contános algo sobre vos..." 
                                        />
                                    </div>

                                    <div>
                                        <label style={{ 
                                            display: 'block',
                                            color: COLOR_BLUE, 
                                            fontSize: '14px', 
                                            fontWeight: 'bold',
                                            marginBottom: '12px'
                                        }}>Categorías Favoritas</label>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            {['historico', 'naturaleza', 'gastronomia', 'artesania', 'compras', 'cultura'].map(category => (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    onClick={() => {
                                                        const newCategories = formData.favorite_categories.includes(category)
                                                            ? formData.favorite_categories.filter(c => c !== category)
                                                            : [...formData.favorite_categories, category];
                                                        setFormData({...formData, favorite_categories: newCategories});
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        border: `2px solid ${formData.favorite_categories.includes(category) ? COLOR_GOLD : '#e2e8f0'}`,
                                                        background: formData.favorite_categories.includes(category) ? COLOR_GOLD : 'white',
                                                        color: formData.favorite_categories.includes(category) ? COLOR_DARK : '#64748b',
                                                        cursor: 'pointer',
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <label style={{ 
                                            color: COLOR_BLUE, 
                                            fontSize: '14px', 
                                            fontWeight: 'bold'
                                        }}>Notificaciones</label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({...formData, notifications: !formData.notifications})}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                background: formData.notifications ? COLOR_GREEN : '#e2e8f0',
                                                color: formData.notifications ? 'white' : '#64748b',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: '500'
                                            }}
                                        >
                                            {formData.notifications ? '🔔 Activadas' : '🔕 Desactivadas'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <div style={{ display: 'grid', gap: '30px' }}>
                                <div>
                                    <h3 style={{ color: COLOR_BLUE, marginBottom: '15px', fontSize: '18px' }}>
                                        🏆 Insignias Obtenidas
                                    </h3>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {profile?.stats?.badges_earned?.map((badge, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    background: `linear-gradient(135deg, ${COLOR_GOLD}22 0%, ${COLOR_GOLD}11 100%)`,
                                                    border: `2px solid ${COLOR_GOLD}44`,
                                                    borderRadius: '16px',
                                                    padding: '12px 16px',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                                                    {getBadgeIcon(badge)}
                                                </div>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                                    {badge}
                                                </div>
                                            </div>
                                        )) || <p style={{ color: '#64748b', fontStyle: 'italic' }}>Aún no has obtenido insignias. ¡Explora más para ganarlas!</p>}
                                    </div>
                                </div>

                                <div>
                                    <h3 style={{ color: COLOR_BLUE, marginBottom: '15px', fontSize: '18px' }}>
                                        ❤️ Categorías Favoritas
                                    </h3>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {profile?.preferences?.favorite_categories?.map((category, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    background: `${COLOR_GOLD}22`,
                                                    padding: '8px 14px',
                                                    borderRadius: '20px',
                                                    fontSize: '13px',
                                                    fontWeight: '500',
                                                    color: COLOR_BLUE
                                                }}
                                            >
                                                {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                                            </div>
                                        )) || <p style={{ color: '#64748b', fontStyle: 'italic' }}>No has seleccionado categorías favoritas aún.</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'stories' && (
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        padding: '40px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}>
                        <h2 style={{ 
                            color: COLOR_BLUE, 
                            fontSize: '24px',
                            fontWeight: 'bold',
                            marginBottom: '20px'
                        }}>🎙️ Mis Relatos</h2>
                        
                        {narrations.length > 0 ? (
                            <div style={{ display: 'grid', gap: '20px' }}>
                                {narrations.map((narration) => (
                                    <div
                                        key={narration.id}
                                        style={{
                                            background: '#f8fafc',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            border: `2px solid ${COLOR_GOLD}22`
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <div>
                                                <h4 style={{ color: COLOR_BLUE, fontSize: '16px', margin: '0 0 4px 0' }}>
                                                    {getCategoryIcon(narration.attraction.category)} {narration.attraction.name}
                                                </h4>
                                                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                                                    {new Date(narration.created_at).toLocaleDateString('es-AR')}
                                                </p>
                                            </div>
                                            {narration.audio_url && (
                                                <button style={{
                                                    background: COLOR_GOLD,
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    width: '36px',
                                                    height: '36px',
                                                    cursor: 'pointer',
                                                    fontSize: '16px'
                                                }}>
                                                    ▶️
                                                </button>
                                            )}
                                        </div>
                                        <p style={{ color: COLOR_DARK, fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                                            {narration.text_content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                background: '#f8fafc',
                                borderRadius: '24px',
                                padding: '60px',
                                textAlign: 'center',
                                border: `3px dashed ${COLOR_GOLD}44`
                            }}>
                                <span style={{ fontSize: '64px' }}>🌵</span>
                                <p style={{ 
                                    color: '#64748b', 
                                    marginTop: '20px',
                                    fontSize: '16px',
                                    fontWeight: '500'
                                }}>
                                    Todavía no has grabado ninguna historia.<br />
                                    ¡Anímate a contar tu primera aventura en el mapa!
                                </p>
                                <button
                                    onClick={() => router.push('/')}
                                    style={{
                                        marginTop: '20px',
                                        background: COLOR_GOLD,
                                        color: COLOR_DARK,
                                        border: 'none',
                                        padding: '12px 24px',
                                        borderRadius: '50px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Ir al Mapa
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        padding: '40px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}>
                        <h2 style={{ 
                            color: COLOR_BLUE, 
                            fontSize: '24px',
                            fontWeight: 'bold',
                            marginBottom: '30px'
                        }}>📊 Estadísticas de Exploración</h2>
                        
                        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                            <div style={{
                                background: `linear-gradient(135deg, ${COLOR_GOLD}22 0%, ${COLOR_GOLD}11 100%)`,
                                borderRadius: '16px',
                                padding: '24px',
                                textAlign: 'center',
                                border: `2px solid ${COLOR_GOLD}44`
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📍</div>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: COLOR_BLUE, marginBottom: '4px' }}>
                                    {profile?.stats?.places_visited || 0}
                                </div>
                                <div style={{ fontSize: '14px', color: '#64748b' }}>Lugares Visitados</div>
                            </div>

                            <div style={{
                                background: `linear-gradient(135deg, #10B98122 0%, #10B98111 100%)`,
                                borderRadius: '16px',
                                padding: '24px',
                                textAlign: 'center',
                                border: `2px solid #10B98144`
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎙️</div>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: COLOR_BLUE, marginBottom: '4px' }}>
                                    {profile?.stats?.stories_recorded || 0}
                                </div>
                                <div style={{ fontSize: '14px', color: '#64748b' }}>Historias Grabadas</div>
                            </div>

                            <div style={{
                                background: `linear-gradient(135deg, #3B82F622 0%, #3B82F611 100%)`,
                                borderRadius: '16px',
                                padding: '24px',
                                textAlign: 'center',
                                border: `2px solid #3B82F644`
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⭐</div>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: COLOR_BLUE, marginBottom: '4px' }}>
                                    {profile?.stats?.reviews_left || 0}
                                </div>
                                <div style={{ fontSize: '14px', color: '#64748b' }}>Reseñas Escritas</div>
                            </div>

                            <div style={{
                                background: `linear-gradient(135deg, #F59E0B22 0%, #F59E0B11 100%)`,
                                borderRadius: '16px',
                                padding: '24px',
                                textAlign: 'center',
                                border: `2px solid #F59E0B44`
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: COLOR_BLUE, marginBottom: '4px' }}>
                                    {profile?.stats?.badges_earned?.length || 0}
                                </div>
                                <div style={{ fontSize: '14px', color: '#64748b' }}>Insignias Obtenidas</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '40px' }}>
                            <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>
                                🎯 Progreso del Mes
                            </h3>
                            <div style={{
                                background: '#f8fafc',
                                borderRadius: '12px',
                                padding: '20px'
                            }}>
                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '500', color: COLOR_BLUE }}>Objetivo: Visitar 5 lugares nuevos</span>
                                        <span style={{ fontSize: '14px', color: '#64748b' }}>3/5</span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: '#e2e8f0',
                                        borderRadius: '4px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: '60%',
                                            height: '100%',
                                            background: COLOR_GOLD,
                                            borderRadius: '4px'
                                        }} />
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '500', color: COLOR_BLUE }}>Objetivo: Grabar 3 historias</span>
                                        <span style={{ fontSize: '14px', color: '#64748b' }}>1/3</span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: '#e2e8f0',
                                        borderRadius: '4px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: '33%',
                                            height: '100%',
                                            background: COLOR_GREEN,
                                            borderRadius: '4px'
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
