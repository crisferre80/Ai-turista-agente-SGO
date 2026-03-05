"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { generateUniqueFileName } from '@/lib/sanitize-filename';
import { getErrorMessage } from '@/lib/error-handler';
import { takePhoto } from '@/lib/photoService';
import { resizeImage } from '@/lib/image-utils';
import Header from '@/components/Header';
import { mergeWithDefaultCategories, normalizeCategoryName } from '@/lib/categories';

interface UserProfile {
    id: string;
    name: string;
    avatar_url: string;
    bio?: string;
    role: string;
    created_at: string;
    // Nuevos campos demográficos
    age?: number;
    gender?: string;
    country?: string;
    city?: string;
    email?: string;
    phone?: string;
    // Campos de experiencia turística
    visit_purpose?: string; // turismo, negocios, educación, otro
    travel_group?: string; // solo, pareja, familia, amigos, grupo
    accommodation_type?: string; // hotel, hostel, airbnb, casa_familiar, camping
    transport_mode?: string; // auto, bus, avión, tren, bicicleta, caminando
    trip_duration?: number; // días de estadía
    budget_range?: string; // económico, moderado, premium, lujo
    // Intereses y preferencias
    interests?: string[]; // naturaleza, cultura, gastronomía, aventura, relax, etc.
    accessibility_needs?: string[];
    dietary_restrictions?: string[];
    // Experiencia en la provincia
    visit_frequency?: string; // primera_vez, ocasional, frecuente, residente
    favorite_experiences?: string;
    recommended_places?: string;
    would_return?: boolean;
    overall_satisfaction?: number; // 1-5
    improvement_suggestions?: string;
    // Datos existentes
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
    const [categories, setCategories] = useState<Array<{name: string, icon: string}>>([]);

    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        age: undefined as number | undefined,
        gender: '',
        country: '',
        city: '',
        email: '',
        phone: '',
        visit_purpose: '',
        travel_group: '',
        accommodation_type: '',
        transport_mode: '',
        trip_duration: undefined as number | undefined,
        budget_range: '',
        interests: [] as string[],
        accessibility_needs: [] as string[],
        dietary_restrictions: [] as string[],
        visit_frequency: '',
        favorite_experiences: '',
        recommended_places: '',
        would_return: undefined as boolean | undefined,
        overall_satisfaction: undefined as number | undefined,
        improvement_suggestions: '',
        favorite_categories: [] as string[],
        language: 'es',
        notifications: true
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    // when user chooses/photographs an avatar we resize immediately for preview/upload
    const handleAvatarFile = async (file: File) => {
        try {
            const small = await resizeImage(file, 500, 500, 0.8);
            file = small; // use resized version
        } catch (e) {
            console.warn('resize avatar fallo, usando original', e);
        }
        setAvatarFile(file);
        if (profile) {
            setProfile({ ...profile, avatar_url: URL.createObjectURL(file) });
        }
    };

    useEffect(() => {
        fetchProfile();
        fetchNarrations();
        fetchCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCategories = async () => {
        console.log('🔍 Fetching categories from database...');
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
            
            if (!supabaseUrl || !supabaseKey) {
                console.error('❌ Supabase not configured');
                const fallback = mergeWithDefaultCategories().filter(cat => cat.type === 'attraction');
                setCategories(fallback.map(cat => ({ name: cat.name, icon: cat.icon })));
                return;
            }
            
            const url = `${supabaseUrl}/rest/v1/categories?select=name,icon,type&type=eq.attraction`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Categories fetched:', data);
            const merged = mergeWithDefaultCategories((data || []).map((cat: { name: string; icon: string; type: string }) => ({ ...cat, type: 'attraction' as const })))
                .filter(cat => cat.type === 'attraction');
            setCategories(merged.map(cat => ({ name: cat.name, icon: cat.icon })));
        } catch (err) {
            console.error('❌ Exception fetching categories:', err);
            const fallback = mergeWithDefaultCategories().filter(cat => cat.type === 'attraction');
            setCategories(fallback.map(cat => ({ name: cat.name, icon: cat.icon })));
        }
    };

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Redirect to login if not authenticated
            router.push('/login');
            return;
        }

        // Obtener perfil
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Si no existe el perfil, crearlo
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    name: user.email?.split('@')[0] || 'Usuario',
                    role: 'tourist',
                    avatar_url: null
                });

            if (!insertError) {
                // Volver a obtener el perfil recién creado
                const { data: newData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                if (newData) {
                    await loadProfileWithStats(newData, user.id);
                }
            }
        } else if (data) {
            await loadProfileWithStats(data, user.id);
        }
        
        setLoading(false);
    };

    const loadProfileWithStats = async (profileData: Record<string, unknown>, userId: string) => {
        // Obtener estadísticas de reseñas
        const { count: reviewsCount } = await supabase
            .from('user_reviews')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Obtener estadísticas de narraciones
        const { count: narrationsCount } = await supabase
            .from('narrations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // @ts-expect-error - profileData comes from external API
        const profileWithStats: UserProfile = {
            ...profileData,
            stats: {
                places_visited: reviewsCount || 0,
                stories_recorded: narrationsCount || 0,
                reviews_left: reviewsCount || 0,
                badges_earned: []
            }
        };
        
        setProfile(profileWithStats);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = profileData as any;
        setFormData({
            name: data.name || '',
            bio: data.bio || '',
            age: data.age,
            gender: data.gender || '',
            country: data.country || '',
            city: data.city || '',
            email: data.email || '',
            phone: data.phone || '',
            visit_purpose: data.visit_purpose || '',
            travel_group: data.travel_group || '',
            accommodation_type: data.accommodation_type || '',
            transport_mode: data.transport_mode || '',
            trip_duration: data.trip_duration,
            budget_range: data.budget_range || '',
            interests: data.interests || [],
            accessibility_needs: data.accessibility_needs || [],
            dietary_restrictions: data.dietary_restrictions || [],
            visit_frequency: data.visit_frequency || '',
            favorite_experiences: data.favorite_experiences || '',
            recommended_places: data.recommended_places || '',
            would_return: data.would_return,
            overall_satisfaction: data.overall_satisfaction,
            improvement_suggestions: data.improvement_suggestions || '',
            favorite_categories: data.preferences?.favorite_categories || [],
            language: data.preferences?.language || 'es',
            notifications: data.preferences?.notifications || true
        });
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
                        name: item.attractions?.[0]?.name || 'Lugar desconocido',
                        category: item.attractions?.[0]?.category || 'general'
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
            // reduce tamaño/comprimir antes de enviar
            let fileToSend = avatarFile;
            try {
                fileToSend = await resizeImage(avatarFile, 500, 500, 0.8);
            } catch (e) {
                console.warn('No se pudo redimensionar avatar, se sube original', e);
            }

            const fileExt = fileToSend.name.split('.').pop();
            const fileName = generateUniqueFileName(`avatar-${Date.now()}.${fileExt}`);
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, fileToSend);

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
                    age: formData.age,
                    gender: formData.gender,
                    country: formData.country,
                    city: formData.city,
                    email: formData.email,
                    phone: formData.phone,
                    visit_purpose: formData.visit_purpose,
                    travel_group: formData.travel_group,
                    accommodation_type: formData.accommodation_type,
                    transport_mode: formData.transport_mode,
                    trip_duration: formData.trip_duration,
                    budget_range: formData.budget_range,
                    interests: formData.interests,
                    accessibility_needs: formData.accessibility_needs,
                    dietary_restrictions: formData.dietary_restrictions,
                    visit_frequency: formData.visit_frequency,
                    favorite_experiences: formData.favorite_experiences,
                    recommended_places: formData.recommended_places,
                    would_return: formData.would_return,
                    overall_satisfaction: formData.overall_satisfaction,
                    improvement_suggestions: formData.improvement_suggestions,
                    updated_at: new Date()
                });

            if (error) {
                alert(getErrorMessage(error));
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
                    avatar_url: avatarUrl || profile.avatar_url
                });
            }
            setEditing(false);
        }
        setLoading(false);
    };

    const getCategoryIcon = (categoryName: string) => {
        const normalizedCategory = normalizeCategoryName(categoryName, 'attraction');
        const category = categories.find(cat => normalizeCategoryName(cat.name, 'attraction') === normalizedCategory);
        return category?.icon || '📍';
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
            <Header />
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
            paddingTop: '80px',
            fontFamily: 'system-ui, -apple-system, sans-serif' 
        }}>
            <Header />
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
                        <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                            <Image
                                src={profile?.avatar_url || 'https://via.placeholder.com/150'}
                                alt="Avatar"
                                width={120}
                                height={120}
                                priority={false}
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
                                            await handleAvatarFile(file);
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

                                    {/* SECCIÓN: Información Personal */}
                                    <div style={{
                                        marginTop: '20px',
                                        paddingTop: '20px',
                                        borderTop: `2px solid #e2e8f0`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>
                                            👤 Información Personal
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Edad</label>
                                                <input 
                                                    type="number"
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.age || ''} 
                                                    onChange={e => setFormData({...formData, age: e.target.value ? parseInt(e.target.value) : undefined})} 
                                                    placeholder="Tu edad" 
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Género</label>
                                                <select 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.gender} 
                                                    onChange={e => setFormData({...formData, gender: e.target.value})}
                                                >
                                                    <option value="">Seleccionar</option>
                                                    <option value="masculino">Masculino</option>
                                                    <option value="femenino">Femenino</option>
                                                    <option value="otro">Otro</option>
                                                    <option value="prefiero_no_decir">Prefiero no decir</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>País</label>
                                                <input 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.country} 
                                                    onChange={e => setFormData({...formData, country: e.target.value})} 
                                                    placeholder="Ej: Argentina" 
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Ciudad</label>
                                                <input 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.city} 
                                                    onChange={e => setFormData({...formData, city: e.target.value})} 
                                                    placeholder="Ej: Buenos Aires" 
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Teléfono</label>
                                                <input 
                                                    type="tel"
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.phone} 
                                                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                                                    placeholder="+54 9 11 xxxx-xxxx" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECCIÓN: Información del Viaje */}
                                    <div style={{
                                        marginTop: '20px',
                                        paddingTop: '20px',
                                        borderTop: `2px solid #e2e8f0`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>
                                            ✈️ Información del Viaje
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Propósito de la visita</label>
                                                <select 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.visit_purpose} 
                                                    onChange={e => setFormData({...formData, visit_purpose: e.target.value})}
                                                >
                                                    <option value="">Seleccionar</option>
                                                    <option value="turismo">Turismo</option>
                                                    <option value="negocios">Negocios</option>
                                                    <option value="educacion">Educación</option>
                                                    <option value="visita_familiar">Visita familiar</option>
                                                    <option value="trabajo">Trabajo</option>
                                                    <option value="otro">Otro</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>¿Con quién viajas?</label>
                                                <select 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.travel_group} 
                                                    onChange={e => setFormData({...formData, travel_group: e.target.value})}
                                                >
                                                    <option value="">Seleccionar</option>
                                                    <option value="solo">Solo/a</option>
                                                    <option value="pareja">En pareja</option>
                                                    <option value="familia">En familia</option>
                                                    <option value="amigos">Con amigos</option>
                                                    <option value="grupo_turistico">Grupo turístico</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Tipo de alojamiento</label>
                                                <select 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.accommodation_type} 
                                                    onChange={e => setFormData({...formData, accommodation_type: e.target.value})}
                                                >
                                                    <option value="">Seleccionar</option>
                                                    <option value="hotel">Hotel</option>
                                                    <option value="hostel">Hostel</option>
                                                    <option value="airbnb">Airbnb/Apart</option>
                                                    <option value="casa_familiar">Casa de familiar</option>
                                                    <option value="camping">Camping</option>
                                                    <option value="otro">Otro</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Medio de transporte</label>
                                                <select 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.transport_mode} 
                                                    onChange={e => setFormData({...formData, transport_mode: e.target.value})}
                                                >
                                                    <option value="">Seleccionar</option>
                                                    <option value="auto">Auto propio</option>
                                                    <option value="auto_alquilado">Auto alquilado</option>
                                                    <option value="bus">Bus/Colectivo</option>
                                                    <option value="avion">Avión</option>
                                                    <option value="tren">Tren</option>
                                                    <option value="bicicleta">Bicicleta</option>
                                                    <option value="caminando">Caminando</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Duración del viaje (días)</label>
                                                <input 
                                                    type="number"
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.trip_duration || ''} 
                                                    onChange={e => setFormData({...formData, trip_duration: e.target.value ? parseInt(e.target.value) : undefined})} 
                                                    placeholder="Ej: 7" 
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Presupuesto</label>
                                                <select 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.budget_range} 
                                                    onChange={e => setFormData({...formData, budget_range: e.target.value})}
                                                >
                                                    <option value="">Seleccionar</option>
                                                    <option value="economico">Económico</option>
                                                    <option value="moderado">Moderado</option>
                                                    <option value="premium">Premium</option>
                                                    <option value="lujo">Lujo</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECCIÓN: Intereses y Preferencias */}
                                    <div style={{
                                        marginTop: '20px',
                                        paddingTop: '20px',
                                        borderTop: `2px solid #e2e8f0`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>
                                            💡 Intereses y Preferencias
                                        </h3>
                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Intereses principales (seleccionar varios)</label>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {['naturaleza', 'cultura', 'gastronomía', 'aventura', 'relax', 'historia', 'fotografía', 'compras', 'vida_nocturna', 'deportes'].map(interest => (
                                                    <button
                                                        key={interest}
                                                        type="button"
                                                        onClick={() => {
                                                            const newInterests = formData.interests.includes(interest)
                                                                ? formData.interests.filter(i => i !== interest)
                                                                : [...formData.interests, interest];
                                                            setFormData({...formData, interests: newInterests});
                                                        }}
                                                        style={{
                                                            padding: '8px 16px',
                                                            borderRadius: '20px',
                                                            border: `2px solid ${formData.interests.includes(interest) ? COLOR_GOLD : '#e2e8f0'}`,
                                                            background: formData.interests.includes(interest) ? COLOR_GOLD : 'white',
                                                            color: formData.interests.includes(interest) ? COLOR_DARK : '#64748b',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            fontWeight: '500'
                                                        }}
                                                    >
                                                        {interest.charAt(0).toUpperCase() + interest.slice(1).replace('_', ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Necesidades de accesibilidad</label>
                                                <input 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.accessibility_needs.join(', ')} 
                                                    onChange={e => setFormData({...formData, accessibility_needs: e.target.value.split(',').map(s => s.trim())})} 
                                                    placeholder="Ej: silla de ruedas, subtítulos" 
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Restricciones alimentarias</label>
                                                <input 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.dietary_restrictions.join(', ')} 
                                                    onChange={e => setFormData({...formData, dietary_restrictions: e.target.value.split(',').map(s => s.trim())})} 
                                                    placeholder="Ej: vegetariano, celíaco" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECCIÓN: Experiencia en la Provincia */}
                                    <div style={{
                                        marginTop: '20px',
                                        paddingTop: '20px',
                                        borderTop: `2px solid #e2e8f0`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>
                                            ⭐ Tu Experiencia en Santiago del Estero
                                        </h3>
                                        <div style={{ display: 'grid', gap: '20px' }}>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Frecuencia de visita</label>
                                                <select 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px' }}
                                                    value={formData.visit_frequency} 
                                                    onChange={e => setFormData({...formData, visit_frequency: e.target.value})}
                                                >
                                                    <option value="">Seleccionar</option>
                                                    <option value="primera_vez">Primera vez</option>
                                                    <option value="ocasional">Ocasional (2-3 veces)</option>
                                                    <option value="frecuente">Frecuente (más de 3 veces)</option>
                                                    <option value="residente">Residente</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>¿Cuáles fueron tus experiencias favoritas?</label>
                                                <textarea 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px', minHeight: '100px', resize: 'vertical' }}
                                                    value={formData.favorite_experiences} 
                                                    onChange={e => setFormData({...formData, favorite_experiences: e.target.value})} 
                                                    placeholder="Contanos qué fue lo que más disfrutaste de tu visita..." 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => router.push('/storyrecorder')}
                                                    style={{
                                                        marginTop: '10px',
                                                        padding: '10px 20px',
                                                        background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`,
                                                        color: COLOR_DARK,
                                                        border: 'none',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    🎙️ Grabar tu historia completa
                                                </button>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>¿Qué lugares recomendarías?</label>
                                                <textarea 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px', minHeight: '100px', resize: 'vertical' }}
                                                    value={formData.recommended_places} 
                                                    onChange={e => setFormData({...formData, recommended_places: e.target.value})} 
                                                    placeholder="Lugares que otros turistas no deberían perderse..." 
                                                />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                                                <div>
                                                    <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>¿Volverías a Santiago del Estero?</label>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({...formData, would_return: true})}
                                                            style={{
                                                                padding: '10px 20px',
                                                                borderRadius: '20px',
                                                                border: `2px solid ${formData.would_return === true ? COLOR_GREEN : '#e2e8f0'}`,
                                                                background: formData.would_return === true ? COLOR_GREEN : 'white',
                                                                color: formData.would_return === true ? 'white' : '#64748b',
                                                                cursor: 'pointer',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            👍 Sí
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({...formData, would_return: false})}
                                                            style={{
                                                                padding: '10px 20px',
                                                                borderRadius: '20px',
                                                                border: `2px solid ${formData.would_return === false ? '#ef4444' : '#e2e8f0'}`,
                                                                background: formData.would_return === false ? '#ef4444' : 'white',
                                                                color: formData.would_return === false ? 'white' : '#64748b',
                                                                cursor: 'pointer',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            👎 No
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Satisfacción general (1-5)</label>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {[1, 2, 3, 4, 5].map(rating => (
                                                            <button
                                                                key={rating}
                                                                type="button"
                                                                onClick={() => setFormData({...formData, overall_satisfaction: rating})}
                                                                style={{
                                                                    padding: '10px',
                                                                    borderRadius: '12px',
                                                                    border: `2px solid ${formData.overall_satisfaction === rating ? COLOR_GOLD : '#e2e8f0'}`,
                                                                    background: formData.overall_satisfaction === rating ? COLOR_GOLD : 'white',
                                                                    cursor: 'pointer',
                                                                    fontSize: '18px'
                                                                }}
                                                            >
                                                                ⭐
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>¿Qué podríamos mejorar?</label>
                                                <textarea 
                                                    style={{ width: '100%', padding: '14px 18px', border: `2px solid #e2e8f0`, borderRadius: '12px', outline: 'none', fontSize: '16px', minHeight: '100px', resize: 'vertical' }}
                                                    value={formData.improvement_suggestions} 
                                                    onChange={e => setFormData({...formData, improvement_suggestions: e.target.value})} 
                                                    placeholder="Tus sugerencias nos ayudan a mejorar la experiencia turística..." 
                                                />
                                            </div>
                                        </div>
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
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.name}
                                                    type="button"
                                                    onClick={() => {
                                                        const newCategories = formData.favorite_categories.includes(cat.name)
                                                            ? formData.favorite_categories.filter(c => c !== cat.name)
                                                            : [...formData.favorite_categories, cat.name];
                                                        setFormData({...formData, favorite_categories: newCategories});
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        border: `2px solid ${formData.favorite_categories.includes(cat.name) ? COLOR_GOLD : '#e2e8f0'}`,
                                                        background: formData.favorite_categories.includes(cat.name) ? COLOR_GOLD : 'white',
                                                        color: formData.favorite_categories.includes(cat.name) ? COLOR_DARK : '#64748b',
                                                        cursor: 'pointer',
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {cat.icon} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
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
                                {/* Sección: Información Personal */}
                                {(profile?.age || profile?.gender || profile?.country || profile?.city || profile?.phone) && (
                                    <div style={{
                                        background: '#f8fafc',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        border: `2px solid ${COLOR_GOLD}22`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                                            👤 Información Personal
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            {profile?.age && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Edad</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>{profile.age} años</div>
                                                </div>
                                            )}
                                            {profile?.gender && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Género</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>
                                                        {profile.gender === 'masculino' && '👨 Masculino'}
                                                        {profile.gender === 'femenino' && '👩 Femenino'}
                                                        {profile.gender === 'otro' && '🧑 Otro'}
                                                        {profile.gender === 'prefiero_no_decir' && '🚫 Prefiero no decir'}
                                                    </div>
                                                </div>
                                            )}
                                            {profile?.country && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>País</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>🌍 {profile.country}</div>
                                                </div>
                                            )}
                                            {profile?.city && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Ciudad</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>🏙️ {profile.city}</div>
                                                </div>
                                            )}
                                            {profile?.phone && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Teléfono</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>📱 {profile.phone}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Sección: Información del Viaje */}
                                {(profile?.visit_purpose || profile?.travel_group || profile?.accommodation_type || profile?.transport_mode || profile?.trip_duration || profile?.budget_range) && (
                                    <div style={{
                                        background: '#f0f9ff',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        border: `2px solid #3b82f622`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                                            ✈️ Información del Viaje
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            {profile?.visit_purpose && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Propósito de la visita</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>
                                                        {profile.visit_purpose === 'turismo' && '🏖️ Turismo'}
                                                        {profile.visit_purpose === 'negocios' && '💼 Negocios'}
                                                        {profile.visit_purpose === 'educacion' && '📚 Educación'}
                                                        {profile.visit_purpose === 'visita_familiar' && '👪 Visita Familiar'}
                                                        {profile.visit_purpose === 'trabajo' && '💻 Trabajo'}
                                                        {profile.visit_purpose === 'otro' && '🔹 Otro'}
                                                    </div>
                                                </div>
                                            )}
                                            {profile?.travel_group && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Viajo con</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>
                                                        {profile.travel_group === 'solo' && '🚶 Solo/a'}
                                                        {profile.travel_group === 'pareja' && '💑 Pareja'}
                                                        {profile.travel_group === 'familia' && '👨‍👩‍👧‍👦 Familia'}
                                                        {profile.travel_group === 'amigos' && '👥 Amigos'}
                                                        {profile.travel_group === 'grupo_turistico' && '🚌 Grupo Turístico'}
                                                    </div>
                                                </div>
                                            )}
                                            {profile?.accommodation_type && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Alojamiento</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>
                                                        {profile.accommodation_type === 'hotel' && '🏨 Hotel'}
                                                        {profile.accommodation_type === 'hostel' && '🏠 Hostel'}
                                                        {profile.accommodation_type === 'airbnb' && '🏡 Airbnb'}
                                                        {profile.accommodation_type === 'casa_familiar' && '👨‍👩‍👧 Casa Familiar'}
                                                        {profile.accommodation_type === 'camping' && '⛺ Camping'}
                                                        {profile.accommodation_type === 'otro' && '🏘️ Otro'}
                                                    </div>
                                                </div>
                                            )}
                                            {profile?.transport_mode && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Transporte</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>
                                                        {profile.transport_mode === 'auto_propio' && '🚗 Auto Propio'}
                                                        {profile.transport_mode === 'auto_alquilado' && '🚙 Auto Alquilado'}
                                                        {profile.transport_mode === 'bus' && '🚌 Bus'}
                                                        {profile.transport_mode === 'avion' && '✈️ Avión'}
                                                        {profile.transport_mode === 'tren' && '🚂 Tren'}
                                                        {profile.transport_mode === 'bicicleta' && '🚴 Bicicleta'}
                                                        {profile.transport_mode === 'caminando' && '🚶 Caminando'}
                                                    </div>
                                                </div>
                                            )}
                                            {profile?.trip_duration && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Duración</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>⏱️ {profile.trip_duration} días</div>
                                                </div>
                                            )}
                                            {profile?.budget_range && (
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Presupuesto</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>
                                                        {profile.budget_range === 'economico' && '💰 Económico'}
                                                        {profile.budget_range === 'moderado' && '💵 Moderado'}
                                                        {profile.budget_range === 'premium' && '💎 Premium'}
                                                        {profile.budget_range === 'lujo' && '👑 Lujo'}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Sección: Intereses y Preferencias */}
                                {((profile?.interests?.length ?? 0) > 0 || (profile?.accessibility_needs?.length ?? 0) > 0 || (profile?.dietary_restrictions?.length ?? 0) > 0) && (
                                    <div style={{
                                        background: '#fefce8',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        border: `2px solid ${COLOR_GOLD}33`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                                            💡 Intereses y Preferencias
                                        </h3>
                                        
                                        {profile?.interests && profile.interests.length > 0 && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Intereses</div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {profile.interests.map((interest, index) => (
                                                        <div
                                                            key={index}
                                                            style={{
                                                                background: COLOR_GOLD,
                                                                color: COLOR_DARK,
                                                                padding: '6px 12px',
                                                                borderRadius: '16px',
                                                                fontSize: '13px',
                                                                fontWeight: '600'
                                                            }}
                                                        >
                                                            {interest === 'naturaleza' && '🌿 Naturaleza'}
                                                            {interest === 'cultura' && '🎭 Cultura'}
                                                            {interest === 'gastronomia' && '🍽️ Gastronomía'}
                                                            {interest === 'aventura' && '🏔️ Aventura'}
                                                            {interest === 'relax' && '🧘 Relax'}
                                                            {interest === 'historia' && '🏛️ Historia'}
                                                            {interest === 'fotografia' && '📷 Fotografía'}
                                                            {interest === 'compras' && '🛍️ Compras'}
                                                            {interest === 'vida_nocturna' && '🎉 Vida Nocturna'}
                                                            {interest === 'deportes' && '⚽ Deportes'}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {profile?.accessibility_needs && profile.accessibility_needs.length > 0 && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Necesidades de accesibilidad</div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {profile.accessibility_needs.map((need, index) => (
                                                        <div
                                                            key={index}
                                                            style={{
                                                                background: '#10B98133',
                                                                color: '#065f46',
                                                                padding: '6px 12px',
                                                                borderRadius: '16px',
                                                                fontSize: '13px',
                                                                fontWeight: '600',
                                                                border: '2px solid #10B98144'
                                                            }}
                                                        >
                                                            ♿ {need}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {profile?.dietary_restrictions && profile.dietary_restrictions.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Restricciones alimentarias</div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {profile.dietary_restrictions.map((restriction, index) => (
                                                        <div
                                                            key={index}
                                                            style={{
                                                                background: '#f1f5f933',
                                                                color: '#0f172a',
                                                                padding: '6px 12px',
                                                                borderRadius: '16px',
                                                                fontSize: '13px',
                                                                fontWeight: '600',
                                                                border: '2px solid #cbd5e144'
                                                            }}
                                                        >
                                                            🥗 {restriction}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Sección: Experiencia en Santiago del Estero */}
                                {(profile?.visit_frequency || profile?.favorite_experiences || profile?.recommended_places || profile?.would_return !== undefined || profile?.overall_satisfaction || profile?.improvement_suggestions) && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        border: `3px solid ${COLOR_GOLD}`
                                    }}>
                                        <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                                            ⭐ Experiencia en Santiago del Estero
                                        </h3>
                                        
                                        <div style={{ display: 'grid', gap: '20px' }}>
                                            {profile?.visit_frequency && (
                                                <div>
                                                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Frecuencia de visita</div>
                                                    <div style={{ fontSize: '16px', color: COLOR_DARK, fontWeight: '500' }}>
                                                        {profile.visit_frequency === 'primera_vez' && '🌟 Primera vez'}
                                                        {profile.visit_frequency === 'ocasional' && '🔄 Ocasional'}
                                                        {profile.visit_frequency === 'frecuente' && '✨ Frecuente'}
                                                        {profile.visit_frequency === 'residente' && '🏠 Residente'}
                                                    </div>
                                                </div>
                                            )}

                                            {profile?.favorite_experiences && (
                                                <div>
                                                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Experiencias favoritas</div>
                                                    <div style={{ 
                                                        fontSize: '15px', 
                                                        color: COLOR_DARK, 
                                                        lineHeight: '1.6',
                                                        background: 'white',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        &quot;{profile.favorite_experiences}&quot;
                                                    </div>
                                                </div>
                                            )}

                                            {profile?.recommended_places && (
                                                <div>
                                                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Lugares recomendados</div>
                                                    <div style={{ 
                                                        fontSize: '15px', 
                                                        color: COLOR_DARK, 
                                                        lineHeight: '1.6',
                                                        background: 'white',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        &quot;{profile.recommended_places}&quot;
                                                    </div>
                                                </div>
                                            )}

                                            {profile?.would_return !== undefined && profile?.would_return !== null && (
                                                <div>
                                                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>¿Volvería a visitar?</div>
                                                    <div style={{ 
                                                        display: 'inline-block',
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        background: profile.would_return ? COLOR_GREEN : '#ef4444',
                                                        color: 'white',
                                                        fontWeight: 'bold',
                                                        fontSize: '14px'
                                                    }}>
                                                        {profile.would_return ? '✅ ¡Sí, definitivamente!' : '❌ No'}
                                                    </div>
                                                </div>
                                            )}

                                            {profile?.overall_satisfaction && (
                                                <div>
                                                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Satisfacción general</div>
                                                    <div style={{ fontSize: '28px', letterSpacing: '4px' }}>
                                                        {Array.from({ length: 5 }, (_, i) => (
                                                            <span key={i} style={{ color: i < (profile.overall_satisfaction ?? 0) ? COLOR_GOLD : '#cbd5e1' }}>
                                                                ⭐
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {profile?.improvement_suggestions && (
                                                <div>
                                                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Sugerencias de mejora</div>
                                                    <div style={{ 
                                                        fontSize: '15px', 
                                                        color: COLOR_DARK, 
                                                        lineHeight: '1.6',
                                                        background: 'white',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        💡 &quot;{profile.improvement_suggestions}&quot;
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Insignias y Categorías Favoritas */}
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
