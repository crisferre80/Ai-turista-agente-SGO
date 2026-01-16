"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminMap from '@/components/AdminMap';
import { takePhoto } from '@/lib/photoService';

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('lugares');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Data State
    const [places, setPlaces] = useState<any[]>([]);
    const [phrases, setPhrases] = useState<any[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [businesses, setBusinesses] = useState<any[]>([]);

    // Form States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newPlace, setNewPlace] = useState({
        name: '', lat: -27.7834, lng: -64.2599, desc: '', img: '', info: '', category: 'historico', gallery: [] as string[]
    });
    const [newPhrase, setNewPhrase] = useState({ text: '', category: 'general' });
    const [newVideo, setNewVideo] = useState({ title: '', url: '' });
    const [newBusiness, setNewBusiness] = useState({ id: '', name: '', category: 'restaurante', contact: '', website: '', image_url: '', lat: -27.7834, lng: -64.2599 });

    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
    const [businessFile, setBusinessFile] = useState<File | null>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const legacyAuth = localStorage.getItem('adminToken');

        if (!user && legacyAuth !== 'granted') {
            router.push('/login');
        } else {
            setIsAuthorized(true);
            fetchData();
        }
    };

    const fetchData = async () => {
        setLoading(true);
        const { data: attData } = await supabase.from('attractions').select('*').order('created_at', { ascending: false });
        const { data: phrData } = await supabase.from('santis_phrases').select('*');
        const { data: bizData } = await supabase.from('businesses').select('*').order('created_at', { ascending: false });
        const { data: vidData } = await supabase.from('app_videos').select('*').order('created_at', { ascending: false });

        if (attData) setPlaces(attData);
        if (phrData) setPhrases(phrData);
        if (bizData) setBusinesses(bizData);
        if (vidData) setVideos(vidData);
        setLoading(false);
    };

    // Helper: Client-side Image Compression
    const compressImage = async (file: File): Promise<File> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg', lastModified: Date.now() }));
                        } else resolve(file);
                    }, 'image/jpeg', 0.82); // 82% quality is a good sweet spot
                };
            };
        });
    };

    const handleFileUpload = async (file: File, bucket: string) => {
        try {
            const compressed = await compressImage(file);
            const fileExt = "jpg";
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, compressed);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
            return publicUrl;
        } catch (e: any) {
            alert('Error subiendo: ' + e.message);
            return null;
        }
    };

    const captureImage = async (target: 'place' | 'business' | 'gallery') => {
        const photo = await takePhoto();
        if (photo) {
            // Convert Blob to File to keep compatibility with existing upload logic
            const file = new File([photo.blob], `camera-${Date.now()}.${photo.format}`, { type: `image/${photo.format}` });
            if (target === 'place') {
                setUploadFile(file);
                // Preview for user
                setNewPlace(prev => ({ ...prev, img: URL.createObjectURL(file) }));
            }
            else if (target === 'business') {
                setBusinessFile(file);
                setNewBusiness(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
            }
            else if (target === 'gallery') {
                setGalleryFiles(prev => [...prev, file]);
            }
        }
    };

    const handleAddPlace = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let finalImgUrl = newPlace.img;
            if (uploadFile) {
                const uploadedUrl = await handleFileUpload(uploadFile, 'images');
                if (uploadedUrl) finalImgUrl = uploadedUrl;
            }

            let finalGallery = [...(newPlace.gallery || [])];
            if (galleryFiles.length > 0) {
                for (const file of galleryFiles) {
                    const url = await handleFileUpload(file, 'images');
                    if (url) finalGallery.push(url);
                }
            }

            const placeData = {
                name: newPlace.name,
                description: newPlace.desc,
                lat: newPlace.lat,
                lng: newPlace.lng,
                image_url: finalImgUrl,
                info_extra: newPlace.info,
                category: newPlace.category,
                gallery_urls: finalGallery
            };

            let error;
            if (editingId) {
                const { error: updErr } = await supabase.from('attractions').update(placeData).eq('id', editingId);
                error = updErr;
            } else {
                const { error: insErr } = await supabase.from('attractions').insert([placeData]);
                error = insErr;
            }

            if (error) throw error;

            alert(editingId ? '¡Actualizado!' : '¡Publicado!');
            resetPlaceForm();
            fetchData();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
        setLoading(false);
    };

    const resetPlaceForm = () => {
        setNewPlace({ name: '', lat: -27.7834, lng: -64.2599, desc: '', img: '', info: '', category: 'historico', gallery: [] });
        setEditingId(null);
        setUploadFile(null);
        setGalleryFiles([]);
    };

    const startEditing = (p: any) => {
        setEditingId(p.id);
        setNewPlace({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            desc: p.description,
            img: p.image_url,
            info: p.info_extra,
            category: p.category,
            gallery: p.gallery_urls || []
        });
        setActiveTab('lugares');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAddBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalImgUrl = newBusiness.image_url;
            if (businessFile) {
                const url = await handleFileUpload(businessFile, 'images');
                if (url) finalImgUrl = url;
            }

            const bizData = {
                name: newBusiness.name,
                category: newBusiness.category,
                contact_info: newBusiness.contact,
                website_url: newBusiness.website,
                image_url: finalImgUrl,
                lat: newBusiness.lat,
                lng: newBusiness.lng
            };

            let error;
            if (newBusiness.id) {
                const { error: updErr } = await supabase.from('businesses').update(bizData).eq('id', newBusiness.id);
                error = updErr;
            } else {
                const { error: insErr } = await supabase.from('businesses').insert([bizData]);
                error = insErr;
            }

            if (error) throw error;
            alert('¡Negocio guardado!');
            setNewBusiness({ id: '', name: '', category: 'restaurante', contact: '', website: '', image_url: '', lat: -27.7834, lng: -64.2599 });
            setBusinessFile(null);
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
        setLoading(false);
    };

    const handleAddPhrase = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('santis_phrases').insert([{ phrase: newPhrase.text, category: newPhrase.category }]);
        if (error) alert(error.message);
        else {
            setNewPhrase({ text: '', category: 'general' });
            fetchData();
        }
    };

    const handleAddVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        let videoUrl = newVideo.url;
        if (videoUrl.includes('youtube.com/watch?v=')) {
            const id = videoUrl.split('v=')[1]?.split('&')[0];
            videoUrl = `https://www.youtube.com/embed/${id}`;
        } else if (videoUrl.includes('youtu.be/')) {
            const id = videoUrl.split('youtu.be/')[1];
            videoUrl = `https://www.youtube.com/embed/${id}`;
        }

        const { error } = await supabase.from('app_videos').insert([{ title: newVideo.title, video_url: videoUrl }]);
        if (error) alert(error.message);
        else {
            setNewVideo({ title: '', url: '' });
            fetchData();
        }
    };

    const deletePlace = async (id: string) => {
        if (!confirm('¿Borrar este lugar?')) return;
        const { error } = await supabase.from('attractions').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    if (!isAuthorized) return null;

    return (
        <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7f6', fontFamily: 'system-ui' }}>

            {/* Mobile Header */}
            <div style={{ display: 'none', position: 'fixed', top: 0, width: '100%', height: '60px', background: '#20B2AA', color: 'white', alignItems: 'center', padding: '0 20px', zIndex: 1001, justifyContent: 'space-between', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} className="mobile-only-header">
                <span style={{ fontWeight: 'bold' }}>Santi Admin</span>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px' }}>{isMobileMenuOpen ? '✕' : '☰'}</button>
            </div>

            {/* Sidebar */}
            <div style={{ width: '260px', background: '#20B2AA', color: 'white', padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }} className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }} className="sidebar-logo">
                    <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png" style={{ width: '40px' }} alt="Santi" />
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Santi Admin</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={() => router.push('/')} style={{ ...tabStyle(false), background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', marginBottom: '10px' }}>🏠 Volver al Sitio</button>
                    <button onClick={() => { setActiveTab('lugares'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'lugares')}>📍 Atractivos</button>
                    <button onClick={() => { setActiveTab('videos'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'videos')}>🎥 Videos</button>
                    <button onClick={() => { setActiveTab('negocios'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'negocios')}>🏢 Negocios</button>
                    <button onClick={() => { setActiveTab('frases'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'frases')}>💬 Frases</button>
                    <button onClick={() => { setActiveTab('relatos'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'relatos')}>🎙️ Relatos</button>
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <button onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem('adminToken'); router.push('/login'); }} style={logoutBtn}>Cerrar Sesión</button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }} className="main-content">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', margin: 0 }}>
                        {activeTab === 'lugares' ? (editingId ? 'Editando Lugar' : 'Atractivos') :
                            activeTab === 'negocios' ? 'Directorio de Negocios' :
                                activeTab === 'videos' ? 'Multimedia' : 'Santi'}
                    </h1>
                    {loading && <span className="loading-spinner"></span>}
                </header>

                {/* Tab: LUGARES */}
                {activeTab === 'lugares' && (
                    <div style={cardStyle}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
                            <form onSubmit={handleAddPlace} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <Input label="Nombre" value={newPlace.name} onChange={v => setNewPlace({ ...newPlace, name: v })} />
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Categoría</label>
                                        <select style={inputStyle} value={newPlace.category} onChange={e => setNewPlace({ ...newPlace, category: e.target.value })}>
                                            <option value="historico">Histórico</option>
                                            <option value="naturaleza">Naturaleza</option>
                                            <option value="compras">Mercado</option>
                                            <option value="gastronomia">Gastronomía</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '12px', border: '1px solid #eee' }}>
                                    <label style={labelStyle}>Imagen Principal (Auto-reducida)</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                        <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ flex: 1 }} />
                                        <button type="button" onClick={() => captureImage('place')} style={{ padding: '8px 12px', background: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>📸 Cámara</button>
                                    </div>
                                    {newPlace.img && <img src={newPlace.img} style={{ height: '80px', borderRadius: '4px', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '10px' }} alt="Thumb" />}
                                    <Input label="O URL" value={newPlace.img} onChange={v => setNewPlace({ ...newPlace, img: v })} />

                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                        <input type="file" multiple accept="image/*" onChange={e => setGalleryFiles(Array.from(e.target.files || []))} style={{ flex: 1 }} />
                                        <button type="button" onClick={() => captureImage('gallery')} style={{ padding: '8px 12px', background: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>📸 Galería</button>
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#888' }}>{newPlace.gallery.length} fotos existentes en galería.</p>
                                </div>

                                <textarea style={textareaStyle} placeholder="Descripción para Santi..." value={newPlace.desc} onChange={e => setNewPlace({ ...newPlace, desc: e.target.value })} rows={3} />
                                <Input label="Info Extra (Horarios, tips)" value={newPlace.info} onChange={v => setNewPlace({ ...newPlace, info: v })} />

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="submit" disabled={loading} style={btnPrimary}>{editingId ? 'Guardar Cambios' : 'Publicar Atractivo'}</button>
                                    {editingId && <button type="button" onClick={resetPlaceForm} style={{ ...btnPrimary, background: '#888' }}>Cancelar</button>}
                                </div>
                            </form>

                            <div>
                                <label style={labelStyle}>Ubicación (Arrastrá el pin)</label>
                                <AdminMap
                                    initialCoords={[newPlace.lng, newPlace.lat]}
                                    onLocationSelect={(lng, lat) => setNewPlace({ ...newPlace, lat, lng })}
                                />
                                <div style={{ background: '#eee', padding: '10px', borderRadius: '8px', fontSize: '11px', marginTop: '10px' }}>
                                    Coords: {newPlace.lat.toFixed(6)}, {newPlace.lng.toFixed(6)}
                                </div>
                            </div>
                        </div>

                        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #eee' }} />
                        <h3>Explorar y Editar Atractivos</h3>
                        <div className="content-grid" style={gridList}>
                            {places.map(p => (
                                <div key={p.id} style={placeCard} onClick={() => startEditing(p)}>
                                    <div style={{ position: 'relative' }}>
                                        <img src={p.image_url || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300"} style={{ width: '100%', height: '120px', objectFit: 'cover' }} alt={p.name} />
                                        <span style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '10px' }}>{p.category}</span>
                                    </div>
                                    <div style={{ padding: '12px' }}>
                                        <h4 style={{ margin: '0', fontSize: '14px' }}>{p.name}</h4>
                                        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                            <button onClick={(e) => { e.stopPropagation(); startEditing(p); }} style={{ ...btnAction, color: '#20B2AA' }}>Editar</button>
                                            <button onClick={(e) => { e.stopPropagation(); deletePlace(p.id); }} style={{ ...btnAction, color: '#ff4444' }}>Borrar</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab: NEGOCIOS */}
                {activeTab === 'negocios' && (
                    <div style={cardStyle}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px', marginBottom: '40px' }}>
                            <form onSubmit={handleAddBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <Input label="Nombre del Negocio" value={newBusiness.name} onChange={v => setNewBusiness({ ...newBusiness, name: v })} />
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Categoría</label>
                                        <select style={inputStyle} value={newBusiness.category} onChange={e => setNewBusiness({ ...newBusiness, category: e.target.value })}>
                                            <option value="restaurante">Restaurante / Comida</option>
                                            <option value="hotel">Hotelería / Alojamiento</option>
                                            <option value="artesania">Artesanías / Regalos</option>
                                            <option value="transporte">Transporte / Guía</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '10px' }}>
                                    <label style={labelStyle}>Foto del Negocio</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                        <input type="file" accept="image/*" onChange={e => setBusinessFile(e.target.files?.[0] || null)} style={{ flex: 1 }} />
                                        <button type="button" onClick={() => captureImage('business')} style={{ padding: '8px 12px', background: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>📸 Cámara</button>
                                    </div>
                                    {newBusiness.image_url && <img src={newBusiness.image_url} style={{ height: '60px', borderRadius: '8px', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} />}
                                </div>
                                <Input label="WhatsApp / Cel" value={newBusiness.contact} onChange={v => setNewBusiness({ ...newBusiness, contact: v })} />
                                <Input label="Web o Instagram" value={newBusiness.website} onChange={v => setNewBusiness({ ...newBusiness, website: v })} />
                                <button type="submit" style={btnPrimary}>{newBusiness.id ? 'Guardar Cambios' : 'Registrar Negocio'}</button>
                            </form>

                            <div>
                                <label style={labelStyle}>Ubicación del Negocio</label>
                                <AdminMap
                                    initialCoords={[newBusiness.lng, newBusiness.lat]}
                                    onLocationSelect={(lng, lat) => setNewBusiness({ ...newBusiness, lat, lng })}
                                />
                                <div style={{ background: '#eee', padding: '10px', borderRadius: '8px', fontSize: '11px', marginTop: '10px' }}>
                                    Coords: {newBusiness.lat.toFixed(6)}, {newBusiness.lng.toFixed(6)}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            {businesses.map(b => (
                                <div key={b.id} style={listItem}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <img src={b.image_url || "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                                        <div>
                                            <strong style={{ fontSize: '1rem' }}>{b.name}</strong>
                                            <p style={{ margin: '0', fontSize: '0.8rem', color: '#777' }}>{b.category} • {b.contact_info}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => setNewBusiness({ id: b.id, name: b.name, category: b.category, contact: b.contact_info, website: b.website_url, image_url: b.image_url, lat: b.lat || -27.7834, lng: b.lng || -64.2599 })} style={btnAction}>✏️</button>
                                        <button onClick={async () => { if (confirm('Borrar?')) { await supabase.from('businesses').delete().eq('id', b.id); fetchData(); } }} style={btnAction}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Other tabs remain similar but with cardStyle */}
                {activeTab === 'videos' && (
                    <div style={cardStyle}>
                        <form onSubmit={handleAddVideo} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
                            <Input label="Título" value={newVideo.title} onChange={v => setNewVideo({ ...newVideo, title: v })} />
                            <Input label="Link de YouTube" value={newVideo.url} onChange={v => setNewVideo({ ...newVideo, url: v })} />
                            <button type="submit" style={btnPrimary}>Cargar Video</button>
                        </form>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {videos.map(v => (
                                <div key={v.id} style={{ ...placeCard, padding: '15px' }}>
                                    <h4>{v.title}</h4>
                                    <iframe width="100%" height="150" src={v.video_url} frameBorder="0" allowFullScreen style={{ borderRadius: '8px' }}></iframe>
                                    <button onClick={async () => { await supabase.from('app_videos').delete().eq('id', v.id); fetchData(); }} style={btnDelete}>Eliminar</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .loading-spinner { border: 3px solid #f3f3f3; border-top: 3px solid #20B2AA; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    .admin-layout { flex-direction: column; }
                    .mobile-only-header { display: flex !important; }
                    .sidebar { position: fixed; left: -260px; top: 60px; height: calc(100vh - 60px); z-index: 1000; width: 260px !important; transition: 0.3s; }
                    .sidebar.open { left: 0; }
                    .main-content { padding: 80px 20px 20px 20px !important; }
                    .form-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}

// Styles
const tabStyle = (active: boolean) => ({ background: active ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', padding: '12px 15px', borderRadius: '10px', color: 'white', textAlign: 'left' as const, cursor: 'pointer', fontSize: '15px' });
const cardStyle = { background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' };
const logoutBtn = { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '10px', borderRadius: '8px', width: '100%', cursor: 'pointer' };
const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px', color: '#444' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', fontSize: '14px' };
const textareaStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', fontFamily: 'inherit', fontSize: '14px' };
const btnPrimary = { background: '#D2691E', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', flex: 1 };
const btnAction = { background: 'none', border: '1px solid #eee', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' };
const btnDelete = { color: 'red', border: '1px solid red', background: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', width: '100%', marginTop: '10px' };
const listItem = { padding: '15px', border: '1px solid #eee', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' };
const gridList = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px', marginTop: '20px' };
const placeCard = { border: '1px solid #eee', borderRadius: '16px', overflow: 'hidden', background: '#fff', cursor: 'pointer', transition: '0.2s' };

const Input = ({ label, value, onChange }: { label: string, value: any, onChange: (v: string) => void }) => (
    <div style={{ width: '100%' }}>
        {label && <label style={labelStyle}>{label}</label>}
        <input style={inputStyle} value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
);
