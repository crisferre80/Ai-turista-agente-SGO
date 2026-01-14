"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminMap from '@/components/AdminMap';

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('lugares');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(false);

    // Data State
    const [places, setPlaces] = useState<any[]>([]);
    const [phrases, setPhrases] = useState<any[]>([]);
    const [businesses, setBusinesses] = useState<any[]>([]);

    // Form States
    const [newPlace, setNewPlace] = useState({ name: '', lat: -27.7834, lng: -64.2599, desc: '', img: '', info: '', category: 'historico' });
    const [newPhrase, setNewPhrase] = useState({ text: '', category: 'general' });
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    useEffect(() => {
        const auth = localStorage.getItem('adminToken');
        if (auth !== 'granted') {
            router.push('/login');
        } else {
            setIsAuthorized(true);
            fetchData();
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: attData } = await supabase.from('attractions').select('*').order('created_at', { ascending: false });
        const { data: phrData } = await supabase.from('santis_phrases').select('*');
        const { data: bizData } = await supabase.from('businesses').select('*');

        if (attData) setPlaces(attData);
        if (phrData) setPhrases(phrData);
        if (bizData) setBusinesses(bizData);
        setLoading(false);
    };

    const handleFileUpload = async (file: File, bucket: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
            .from(bucket)
            .upload(filePath, file);

        if (uploadError) {
            console.error('Detailed Upload Error:', uploadError);
            alert('Error subiendo archivo: ' + uploadError.message);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return publicUrl;
    };

    const handleAddPlace = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let finalImgUrl = newPlace.img;
        if (uploadFile) {
            const uploadedUrl = await handleFileUpload(uploadFile, 'images');
            if (uploadedUrl) finalImgUrl = uploadedUrl;
        }

        const { error } = await supabase.from('attractions').insert([{
            name: newPlace.name,
            description: newPlace.desc,
            lat: newPlace.lat,
            lng: newPlace.lng,
            image_url: finalImgUrl,
            info_extra: newPlace.info,
            category: newPlace.category
        }]);

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            alert('¡Lugar guardado en las nubes de Santiago!');
            setNewPlace({ name: '', lat: -27.7834, lng: -64.2599, desc: '', img: '', info: '', category: 'historico' });
            setUploadFile(null);
            fetchData();
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

    const deletePlace = async (id: string) => {
        if (!confirm('¿Seguro que querés borrar este lugar?')) return;
        const { error } = await supabase.from('attractions').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    if (!isAuthorized) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7f6', fontFamily: 'system-ui' }}>
            {/* Sidebar */}
            <div style={{ width: '260px', background: '#20B2AA', color: 'white', padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png" style={{ width: '40px' }} />
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Santi Admin Cloud</h2>
                </div>

                <button onClick={() => setActiveTab('lugares')} style={tabStyle(activeTab === 'lugares')}>📍 Atractivos & Mapa</button>
                <button onClick={() => setActiveTab('negocios')} style={tabStyle(activeTab === 'negocios')}>🏢 Negocios & Webs</button>
                <button onClick={() => setActiveTab('frases')} style={tabStyle(activeTab === 'frases')}>💬 Frases de Santi</button>
                <button onClick={() => setActiveTab('relatos')} style={tabStyle(activeTab === 'relatos')}>🎙️ Relatos de Usuarios</button>

                <div style={{ marginTop: 'auto' }}>
                    <button onClick={() => { localStorage.removeItem('adminToken'); router.push('/login'); }} style={logoutBtn}>Cerrar Sesión</button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h1>{
                        activeTab === 'lugares' ? 'Gestión de Atractivos' :
                            activeTab === 'negocios' ? 'Directorio de Negocios' :
                                activeTab === 'frases' ? 'Entrenamiento de Santi' : 'Relatos y Experiencias'
                    }</h1>
                    {loading && <span style={{ color: '#20B2AA', fontWeight: 'bold' }}>Cargando...</span>}
                </header>

                {/* Tab: LUGARES */}
                {activeTab === 'lugares' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
                            <form onSubmit={handleAddPlace} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <Input label="Nombre del Atractivo" value={newPlace.name} onChange={v => setNewPlace({ ...newPlace, name: v })} />

                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Categoría</label>
                                        <select
                                            style={inputStyle}
                                            value={newPlace.category}
                                            onChange={e => setNewPlace({ ...newPlace, category: e.target.value })}
                                        >
                                            <option value="historico">Histórico</option>
                                            <option value="naturaleza">Naturaleza / Río</option>
                                            <option value="compras">Compras / Mercado</option>
                                            <option value="gastronomia">Gastronomía</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>Imagen del Lugar</label>
                                    <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ marginBottom: '10px' }} />
                                    <p style={{ fontSize: '12px', color: '#888' }}>O pega una URL: </p>
                                    <Input label="" value={newPlace.img} onChange={v => setNewPlace({ ...newPlace, img: v })} />
                                </div>

                                <label style={labelStyle}>Descripción para Santi</label>
                                <textarea style={textareaStyle} value={newPlace.desc} onChange={e => setNewPlace({ ...newPlace, desc: e.target.value })} rows={3} />

                                <Input label="Info Extra (Horarios, Web, etc)" value={newPlace.info} onChange={v => setNewPlace({ ...newPlace, info: v })} />

                                <button type="submit" disabled={loading} style={btnPrimary}>
                                    {loading ? 'Guardando...' : 'Publicar Atractivo'}
                                </button>
                            </form>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <label style={labelStyle}>Ubicación en el Mapa</label>
                                <AdminMap onLocationSelect={(lng, lat) => setNewPlace({ ...newPlace, lat, lng })} />
                                <div style={{ background: '#eee', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
                                    Coordenadas: <strong>{newPlace.lat.toFixed(4)}, {newPlace.lng.toFixed(4)}</strong>
                                </div>
                            </div>
                        </div>

                        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #eee' }} />
                        <h3>Lugares en el Mapa</h3>
                        <div style={gridList}>
                            {places.map(p => (
                                <div key={p.id} style={placeCard}>
                                    {p.image_url && <img src={p.image_url} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />}
                                    <div style={{ padding: '10px' }}>
                                        <h4 style={{ margin: '0 0 5px 0' }}>{p.name}</h4>
                                        <p style={{ fontSize: '11px', color: '#666', height: '30px', overflow: 'hidden' }}>{p.description}</p>
                                        <button onClick={() => deletePlace(p.id)} style={btnDelete}>Eliminar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Other tabs as placeholders or simple forms */}
                {activeTab === 'frases' && (
                    <div style={cardStyle}>
                        <form onSubmit={handleAddPhrase} style={{ marginBottom: '30px' }}>
                            <label style={labelStyle}>Nueva Frase o Sabiduría Santiagueña</label>
                            <textarea style={textareaStyle} value={newPhrase.text} onChange={e => setNewPhrase({ ...newPhrase, text: e.target.value })} rows={3} placeholder="Santi dirá esto aleatoriamente..." />
                            <button type="submit" style={{ ...btnPrimary, marginTop: '15px' }}>Guardar Frase</button>
                        </form>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {phrases.map(ph => (
                                <div key={ph.id} style={listItem}>
                                    <span>"{ph.phrase}"</span>
                                    <button onClick={async () => {
                                        await supabase.from('santis_phrases').delete().eq('id', ph.id);
                                        fetchData();
                                    }} style={btnTextDelete}>Borrar</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Placeholder for business & relatos */}
                {(activeTab === 'negocios' || activeTab === 'relatos') && (
                    <div style={{ textAlign: 'center', padding: '100px', color: '#888', background: 'white', borderRadius: '16px' }}>
                        <p style={{ fontSize: '32px' }}>🚧</p>
                        <p style={{ fontSize: '20px' }}>Esta sección está conectada a Supabase y lista para recibir el formulario de registro extendido.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Styles
const tabStyle = (active: boolean) => ({ background: active ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', padding: '12px 15px', borderRadius: '10px', color: 'white', textAlign: 'left' as const, cursor: 'pointer', fontSize: '15px' });
const cardStyle = { background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' };
const logoutBtn = { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '10px', borderRadius: '8px', width: '100%', cursor: 'pointer' };
const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#555' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' };
const textareaStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { background: '#D2691E', color: 'white', border: 'none', padding: '15px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const btnDelete = { color: 'red', border: '1px solid red', background: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', marginTop: '10px', width: '100%' };
const btnTextDelete = { color: 'red', border: 'none', background: 'none', cursor: 'pointer' };
const listItem = { padding: '15px', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const gridList = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' };
const placeCard = { border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: '#fafafa' };

const Input = ({ label, value, onChange }: { label: string, value: any, onChange: (v: string) => void }) => (
    <div style={{ width: '100%' }}>
        {label && <label style={labelStyle}>{label}</label>}
        <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} />
    </div>
);
