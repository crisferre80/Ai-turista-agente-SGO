"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { generateUniqueFileName } from '@/lib/sanitize-filename';
import { getErrorMessage, logError } from '@/lib/error-handler';

interface Business {
  id: string;
  auth_id: string;
  name: string;
  email: string;
  description: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  website_url: string;
  category: string;
  instagram_url: string;
  facebook_url: string;
  whatsapp: string;
  avatar_url: string;
  cover_image_url: string;
  plan: string;
  gallery_images: string[];
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

const COLOR_GOLD = '#F1C40F';
const COLOR_BLUE = '#1A3A6C';
const COLOR_DARK = '#0e1f1d';
const COLOR_GREEN = '#10B981';
const COLOR_RED = '#EF4444';

export default function BusinessProfilePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'gallery' | 'analytics' | 'settings'>('overview');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    website_url: '',
    instagram_url: '',
    facebook_url: '',
    whatsapp: ''
  });

  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (error) throw error;

      const business = data as Business;
      setBusiness(business);
      setFormData({
        name: business.name,
        description: business.description,
        phone: business.phone,
        address: business.address || '',
        city: business.city || '',
        country: business.country || '',
        website_url: business.website_url || '',
        instagram_url: business.instagram_url || '',
        facebook_url: business.facebook_url || '',
        whatsapp: business.whatsapp || ''
      });
    } catch (err) {
      logError('Fetch business profile', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewCoverFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setNewCoverPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadCoverImage = async () => {
    if (!newCoverFile || !business) return;

    setUploadingImages(true);
    try {
      const fileName = generateUniqueFileName(`business-cover-${Date.now()}.jpg`);
      const { error: uploadError } = await supabase.storage
        .from('business_covers')
        .upload(`/${fileName}`, newCoverFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('business_covers').getPublicUrl(`/${fileName}`);
      const newUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from('business_profiles')
        .update({ cover_image_url: newUrl })
        .eq('id', business.id);

      if (updateError) throw updateError;

      setBusiness({ ...business, cover_image_url: newUrl });
      setNewCoverFile(null);
      setNewCoverPreview('');
      setSuccess('Imagen de portada actualizada');
    } catch (err) {
      logError('Upload cover image', err);
      setError(getErrorMessage(err));
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('business_profiles')
        .update(formData)
        .eq('id', business.id);

      if (error) throw error;

      setBusiness({ ...business, ...formData });
      setEditing(false);
      setSuccess('Cambios guardados exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      logError('Save business changes', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR_DARK }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '20px' }}>⏳</div>
          <p style={{ color: '#ddd' }}>Cargando tu negocio...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR_DARK }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <p>No se encontró tu perfil de negocio</p>
          <button onClick={() => router.push('/business/register')} style={{ marginTop: '20px', padding: '10px 20px', background: COLOR_GOLD, color: COLOR_DARK, border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Crear Negocio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${COLOR_DARK} 0%, #1a3a3a 100%)` }}>
      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: COLOR_RED,
          color: 'white',
          padding: '15px 20px',
          borderRadius: '8px',
          zIndex: 1000
        }}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: COLOR_GREEN,
          color: 'white',
          padding: '15px 20px',
          borderRadius: '8px',
          zIndex: 1000
        }}>
          ✅ {success}
        </div>
      )}

      {/* Banner/Header */}
      <div style={{
        background: business.cover_image_url ? `url(${business.cover_image_url})` : `linear-gradient(135deg, ${COLOR_BLUE}, ${COLOR_GOLD})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '300px',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '40px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '30px', width: '100%' }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              {business.avatar_url ? (
                <Image
                  src={business.avatar_url}
                  alt={business.name}
                  width={120}
                  height={120}
                  style={{
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: `4px solid ${COLOR_GOLD}`
                  }}
                />
              ) : (
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '12px',
                  background: COLOR_GOLD,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '50px'
                }}>
                  🏢
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ color: 'white', flex: 1 }}>
              <h1 style={{ margin: '0 0 10px 0', fontSize: '36px', fontWeight: 'bold' }}>{business.name}</h1>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: 0.9 }}>
                📍 {business.city}, {business.country}
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                <span>📋 Plan: <strong>{business.plan}</strong></span>
                {business.is_verified && <span style={{ color: COLOR_GREEN }}>✓ Verificado</span>}
              </div>
            </div>

            {/* Upload Cover Button */}
            <div>
              <label htmlFor="cover-upload" style={{
                padding: '10px 15px',
                background: COLOR_GOLD,
                color: COLOR_DARK,
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'inline-block'
              }}>
                🖼️ Cambiar Portada
              </label>
              <input
                id="cover-upload"
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Cover Preview Modal */}
        {newCoverPreview && (
          <div style={{
            position: 'absolute',
            bottom: '-120px',
            left: '40px',
            background: 'white',
            padding: '15px',
            borderRadius: '8px',
            display: 'flex',
            gap: '15px',
            alignItems: 'center'
          }}>
            <Image
              src={newCoverPreview}
              alt="Preview"
              width={100}
              height={80}
              style={{ borderRadius: '6px', objectFit: 'cover' }}
            />
            <div>
              <button
                onClick={uploadCoverImage}
                disabled={uploadingImages}
                style={{
                  padding: '8px 15px',
                  background: COLOR_GREEN,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: uploadingImages ? 'not-allowed' : 'pointer',
                  marginRight: '10px'
                }}
              >
                {uploadingImages ? '⏳' : '✅'} Guardar
              </button>
              <button
                onClick={() => {
                  setNewCoverFile(null);
                  setNewCoverPreview('');
                }}
                style={{
                  padding: '8px 15px',
                  background: '#999',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Tabs Navigation */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '30px',
          borderBottom: `2px solid ${COLOR_GOLD}33`,
          paddingBottom: '20px'
        }}>
          {(['overview', 'gallery', 'analytics', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                background: activeTab === tab ? COLOR_GOLD : 'transparent',
                color: activeTab === tab ? COLOR_DARK : '#ddd',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                transition: 'all 0.3s'
              }}
            >
              {tab === 'overview' && '📊 Resumen'}
              {tab === 'gallery' && '🖼️ Galería'}
              {tab === 'analytics' && '📈 Estadísticas'}
              {tab === 'settings' && '⚙️ Configuración'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
            {/* Key Metrics */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 5px 20px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>📊 Tu Datos</h3>
              
              <div style={{
                background: `${COLOR_GOLD}22`,
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <p style={{ color: '#666', fontSize: '12px', margin: '0 0 5px 0' }}>PLAN ACTUAL</p>
                <p style={{ color: COLOR_BLUE, fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                  {business.plan === 'basic' && '🌱 Gratuito'}
                  {business.plan === 'pro' && '⭐ Pro'}
                  {business.plan === 'premium' && '👑 Premium'}
                </p>
              </div>

              <div style={{
                background: `${COLOR_GREEN}22`,
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <p style={{ color: '#666', fontSize: '12px', margin: '0 0 5px 0' }}>ESTADO</p>
                <p style={{ color: COLOR_GREEN, fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                  {business.is_active ? '✅ Activo' : '❌ Inactivo'}
                </p>
              </div>

              <div style={{
                background: `${COLOR_BLUE}22`,
                padding: '15px',
                borderRadius: '8px'
              }}>
                <p style={{ color: '#666', fontSize: '12px', margin: '0 0 5px 0' }}>MIEMBRO DESDE</p>
                <p style={{ color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                  {new Date(business.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Business Info */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 5px 20px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: COLOR_BLUE, margin: 0, fontSize: '18px' }}>ℹ️ Información</h3>
                <button
                  onClick={() => setEditing(!editing)}
                  style={{
                    padding: '8px 16px',
                    background: editing ? COLOR_RED : COLOR_GOLD,
                    color: editing ? 'white' : COLOR_DARK,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {editing ? '✕ Cancelar' : '✏️ Editar'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>NOMBRE</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: `1px solid ${COLOR_GOLD}`, borderRadius: '6px', marginTop: '5px' }}
                    />
                  ) : (
                    <p style={{ color: COLOR_BLUE, fontWeight: 'bold', margin: '5px 0 0 0' }}>{business.name}</p>
                  )}
                </div>

                <div>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>TELÉFONO</label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: `1px solid ${COLOR_GOLD}`, borderRadius: '6px', marginTop: '5px' }}
                    />
                  ) : (
                    <p style={{ color: COLOR_BLUE, fontWeight: 'bold', margin: '5px 0 0 0' }}>{business.phone}</p>
                  )}
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>DESCRIPCIÓN</label>
                  {editing ? (
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: `1px solid ${COLOR_GOLD}`, borderRadius: '6px', marginTop: '5px', minHeight: '80px' }}
                    />
                  ) : (
                    <p style={{ color: '#666', margin: '5px 0 0 0', lineHeight: '1.5' }}>{business.description}</p>
                  )}
                </div>

                <div>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>CIUDAD</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: `1px solid ${COLOR_GOLD}`, borderRadius: '6px', marginTop: '5px' }}
                    />
                  ) : (
                    <p style={{ color: COLOR_BLUE, fontWeight: 'bold', margin: '5px 0 0 0' }}>{business.city || '-'}</p>
                  )}
                </div>

                <div>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>PAÍS</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: `1px solid ${COLOR_GOLD}`, borderRadius: '6px', marginTop: '5px' }}
                    />
                  ) : (
                    <p style={{ color: COLOR_BLUE, fontWeight: 'bold', margin: '5px 0 0 0' }}>{business.country || '-'}</p>
                  )}
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>DIRECCIÓN</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: `1px solid ${COLOR_GOLD}`, borderRadius: '6px', marginTop: '5px' }}
                    />
                  ) : (
                    <p style={{ color: COLOR_BLUE, fontWeight: 'bold', margin: '5px 0 0 0' }}>{business.address || '-'}</p>
                  )}
                </div>
              </div>

              {editing && (
                <button
                  onClick={handleSaveChanges}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: COLOR_GREEN,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: '20px',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? '⏳ Guardando...' : '💾 Guardar Cambios'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '25px',
            boxShadow: '0 5px 20px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>🖼️ Galería de Fotos</h3>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Secciona en construcción. Aquí podrás subir y administrar tus fotos.
            </p>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '25px',
            boxShadow: '0 5px 20px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>📈 Estadísticas</h3>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Sección en construcción. Próximamente verás aquí tus vistas, reservas y ratings.
            </p>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '25px',
            boxShadow: '0 5px 20px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>⚙️ Configuración</h3>
            
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{ color: COLOR_BLUE, marginBottom: '15px' }}>Redes Sociales</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>INSTAGRAM</label>
                  <input
                    type="text"
                    placeholder="@usuario"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: `1px solid #e2e8f0`, borderRadius: '6px', marginTop: '5px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>FACEBOOK</label>
                  <input
                    type="text"
                    placeholder="URL de Facebook"
                    value={formData.facebook_url}
                    onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: `1px solid #e2e8f0`, borderRadius: '6px', marginTop: '5px' }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold' }}>WHATSAPP</label>
                  <input
                    type="text"
                    placeholder="+56912345678"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: `1px solid #e2e8f0`, borderRadius: '6px', marginTop: '5px' }}
                  />
                </div>
              </div>
              <button
                onClick={handleSaveChanges}
                disabled={loading}
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  background: COLOR_GREEN,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
