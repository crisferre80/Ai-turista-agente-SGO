"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

interface Business {
  id: string;
  auth_id: string;
  name: string;
  email: string;
  description: string;
  website_url: string;
  phone: string;
  address: string;
  category: string;
  plan: string;
  gallery_images: string[];
  is_active: boolean;
  payment_status: string;
  subscription_end: string;
  created_at: string;
  is_verified: boolean;
}

interface BusinessProfile {
  id: string;
  name: string;
  avatar_url: string;
  role: string;
  created_at: string;
}

interface BusinessStats {
  total_views: number;
  monthly_views: number;
  total_reviews: number;
  average_rating: number;
  total_bookings: number;
}

export default function BusinessProfilePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'gallery' | 'analytics' | 'settings'>('overview');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website_url: '',
    phone: '',
    address: '',
    category: ''
  });

  const [uploadingImages, setUploadingImages] = useState(false);

  const COLOR_GOLD = '#F1C40F';
  const COLOR_BLUE = '#1A3A6C';
  const COLOR_DARK = '#0e1f1d';
  const COLOR_GREEN = '#10B981';
  const COLOR_RED = '#EF4444';

  // Fetch business profile and related data
  const fetchBusinessProfile = React.useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch business data
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (businessError) throw businessError;

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Mock stats for now - in real implementation, these would come from analytics tables
      const mockStats: BusinessStats = {
        total_views: Math.floor(Math.random() * 1000) + 500,
        monthly_views: Math.floor(Math.random() * 100) + 50,
        total_reviews: Math.floor(Math.random() * 50) + 10,
        average_rating: +(Math.random() * 2 + 3).toFixed(1), // 3.0 - 5.0
        total_bookings: Math.floor(Math.random() * 30) + 5
      };

      if (businessData) {
        setBusiness(businessData);
        setProfile(businessData); // Profile is now part of business data
        setStats(mockStats);
        setFormData({
          name: businessData.name || '',
          description: businessData.description || '',
          website_url: businessData.website_url || '',
          phone: businessData.phone || '',
          address: businessData.address || '',
          category: businessData.category || ''
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Error al cargar el perfil: ' + msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchBusinessProfile();
  }, [fetchBusinessProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('business_profiles')
        .update({
          name: formData.name,
          description: formData.description,
          website_url: formData.website_url,
          phone: formData.phone,
          address: formData.address,
          category: formData.category
        })
        .eq('id', business.id);

      if (error) throw error;

      setSuccess('Perfil actualizado correctamente');
      setEditing(false);
      fetchBusinessProfile();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Error al actualizar: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !business) return;
    
    const files = Array.from(e.target.files);
    const maxImages = getMaxImagesForPlan(business.plan);
    const currentImageCount = business.gallery_images?.length || 0;
    
    if (currentImageCount + files.length > maxImages) {
      setError(`Solo puedes subir ${maxImages - currentImageCount} imágenes más con tu plan actual.`);
      return;
    }

    setUploadingImages(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `business-${business.id}-${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `business-galleries/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const newGalleryImages = [...(business.gallery_images || []), ...uploadedUrls];

      const { error } = await supabase
        .from('businesses')
        .update({ gallery_images: newGalleryImages })
        .eq('id', business.id);

      if (error) throw error;

      setBusiness({ ...business, gallery_images: newGalleryImages });
      setSuccess('Imágenes subidas correctamente');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Error al subir imágenes: ' + msg);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = async (imageUrl: string) => {
    if (!business) return;

    try {
      const newGalleryImages = business.gallery_images?.filter(url => url !== imageUrl) || [];

      const { error } = await supabase
        .from('business_profiles')
        .update({ gallery_images: newGalleryImages })
        .eq('id', business.id);

      if (error) throw error;

      setBusiness({ ...business, gallery_images: newGalleryImages });
      setSuccess('Imagen eliminada correctamente');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Error al eliminar imagen: ' + msg);
    }
  };

  const getMaxImagesForPlan = (plan: string) => {
    switch (plan) {
      case 'basic': return 5;
      case 'pro': return 15;
      case 'premium': return 50;
      default: return 5;
    }
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'basic': return 'Plan Básico';
      case 'pro': return 'Plan Pro';
      case 'premium': return 'Plan Premium';
      default: return plan;
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'restaurante': '🍽️',
      'hotel': '🏨',
      'artesania': '🎨',
      'tienda': '🛍️',
      'servicio': '⚙️',
      'otro': '📍'
    };
    return icons[category] || '📍';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return COLOR_GREEN;
      case 'pending': return '#F59E0B';
      case 'expired': return COLOR_RED;
      default: return '#64748b';
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: `4px solid ${COLOR_GOLD}33`,
            borderTop: `4px solid ${COLOR_GOLD}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p style={{ color: COLOR_BLUE, fontWeight: '600', fontSize: '18px' }}>
            Cargando tu panel de negocio...
          </p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
        padding: '20px'
      }}>
        <div style={{ 
          textAlign: 'center',
          background: 'white',
          borderRadius: '24px',
          padding: '60px 40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏢</div>
          <h2 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
            Negocio no encontrado
          </h2>
          <p style={{ color: '#64748b', marginBottom: '30px', fontSize: '16px', lineHeight: '1.5' }}>
            No se encontró un perfil de negocio asociado a tu cuenta.
            ¿Te gustaría registrar tu negocio ahora?
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button
              onClick={() => router.push('/business/register')}
              style={{
                background: COLOR_GOLD,
                color: COLOR_DARK,
                border: 'none',
                padding: '14px 28px',
                borderRadius: '50px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '16px',
                boxShadow: `0 6px 20px ${COLOR_GOLD}44`
              }}
            >
              Registrar Negocio
            </button>
            <button
              onClick={() => router.push('/')}
              style={{
                background: 'white',
                color: COLOR_BLUE,
                border: `2px solid ${COLOR_BLUE}22`,
                padding: '14px 28px',
                borderRadius: '50px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
      padding: '80px 20px 20px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header Navigation */}
        <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          
          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => router.push('/dashboard/business')}
              style={{
                background: 'white',
                border: `2px solid ${COLOR_BLUE}22`,
                color: COLOR_BLUE,
                padding: '12px 20px',
                borderRadius: '50px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              📊 Dashboard
            </button>
          </div>
        </div>

        {/* Business Header Card */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '40px',
          marginBottom: '30px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          border: `2px solid ${COLOR_GOLD}22`
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: '30px',
            alignItems: 'center'
          }}>
            {/* Business Logo/Icon */}
            <div style={{
              width: '100px',
              height: '100px',
              background: `linear-gradient(135deg, ${COLOR_GOLD}22 0%, ${COLOR_GOLD}11 100%)`,
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              border: `3px solid ${COLOR_GOLD}44`
            }}>
              {getCategoryIcon(business.category)}
            </div>

            {/* Business Info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                <h1 style={{ 
                  margin: 0, 
                  fontSize: '32px',
                  color: COLOR_BLUE,
                  fontWeight: '800'
                }}>
                  {business.name}
                </h1>
                {business.is_verified && (
                  <div style={{
                    background: COLOR_GREEN,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ✓ Verificado
                  </div>
                )}
              </div>
              
              <p style={{ 
                color: '#64748b', 
                fontSize: '16px',
                margin: '0 0 15px 0',
                lineHeight: '1.5'
              }}>
                {business.description || 'Descripción del negocio no disponible'}
              </p>
              
              <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: COLOR_BLUE }}>
                    {stats?.total_views || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Vistas Totales
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: COLOR_BLUE }}>
                    {stats?.average_rating || 0}⭐
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Calificación
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: COLOR_BLUE }}>
                    {business.gallery_images?.length || 0}/{getMaxImagesForPlan(business.plan)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Imágenes
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Actions */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                background: business.is_active ? `${COLOR_GREEN}22` : `${COLOR_RED}22`,
                color: business.is_active ? COLOR_GREEN : COLOR_RED,
                padding: '12px 20px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '15px',
                border: `2px solid ${business.is_active ? COLOR_GREEN : COLOR_RED}44`
              }}>
                {business.is_active ? '🟢 Activo' : '🔴 Inactivo'}
              </div>
              
              <div style={{
                background: `${getStatusColor(business.payment_status)}22`,
                color: getStatusColor(business.payment_status),
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginBottom: '20px'
              }}>
                💳 {business.payment_status === 'paid' ? 'Al día' : business.payment_status === 'pending' ? 'Pendiente' : 'Vencido'}
              </div>
              
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
                    boxShadow: `0 6px 20px ${COLOR_GOLD}44`
                  }}
                >
                  ✏️ Editar Perfil
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    onClick={handleUpdateProfile} 
                    disabled={loading}
                    style={{
                      background: COLOR_GREEN,
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '50px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✓ Guardar
                  </button>
                  <button 
                    onClick={() => setEditing(false)} 
                    style={{
                      background: COLOR_RED,
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '50px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✕ Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{
            background: `${COLOR_RED}11`,
            border: `2px solid ${COLOR_RED}44`,
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '20px',
            color: COLOR_RED,
            fontWeight: '500'
          }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: `${COLOR_GREEN}11`,
            border: `2px solid ${COLOR_GREEN}44`,
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '20px',
            color: COLOR_GREEN,
            fontWeight: '500'
          }}>
            ✅ {success}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          background: 'white',
          borderRadius: '20px',
          padding: '8px',
          marginBottom: '30px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
          gap: '8px'
        }}>
          {[
            { key: 'overview' as const, label: 'Vista General', icon: '📋' },
            { key: 'gallery' as const, label: 'Galería', icon: '🖼️' },
            { key: 'analytics' as const, label: 'Analíticas', icon: '📊' },
            { key: 'settings' as const, label: 'Configuración', icon: '⚙️' }
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
                borderRadius: '14px',
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
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gap: '30px' }}>
            
            {/* Business Details */}
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
              }}>
                📋 Información del Negocio
              </h2>
              
              {editing ? (
                <form onSubmit={handleUpdateProfile}>
                  <div style={{ display: 'grid', gap: '25px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ 
                          display: 'block',
                          color: COLOR_BLUE, 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          marginBottom: '8px'
                        }}>Nombre del Negocio</label>
                        <input 
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            border: `2px solid #e2e8f0`,
                            borderRadius: '12px',
                            outline: 'none',
                            fontSize: '16px',
                            fontWeight: '500'
                          }} 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                          placeholder="Nombre de tu negocio"
                          required
                        />
                      </div>
                      
                      <div>
                        <label style={{ 
                          display: 'block',
                          color: COLOR_BLUE, 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          marginBottom: '8px'
                        }}>Categoría</label>
                        <select
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            border: `2px solid #e2e8f0`,
                            borderRadius: '12px',
                            outline: 'none',
                            fontSize: '16px',
                            fontWeight: '500'
                          }}
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                          <option value="">Seleccionar categoría</option>
                          {['restaurante', 'hotel', 'artesania', 'tienda', 'servicio', 'otro'].map(cat => (
                            <option key={cat} value={cat}>
                              {getCategoryIcon(cat)} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block',
                        color: COLOR_BLUE, 
                        fontSize: '14px', 
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>Descripción</label>
                      <textarea 
                        style={{
                          width: '100%',
                          padding: '14px 18px',
                          border: `2px solid #e2e8f0`,
                          borderRadius: '12px',
                          outline: 'none',
                          fontFamily: 'inherit',
                          fontSize: '16px',
                          fontWeight: '500',
                          minHeight: '120px',
                          resize: 'vertical'
                        }} 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        placeholder="Describe tu negocio, servicios, especialidades..."
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ 
                          display: 'block',
                          color: COLOR_BLUE, 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          marginBottom: '8px'
                        }}>Teléfono</label>
                        <input 
                          type="tel"
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            border: `2px solid #e2e8f0`,
                            borderRadius: '12px',
                            outline: 'none',
                            fontSize: '16px',
                            fontWeight: '500'
                          }} 
                          value={formData.phone} 
                          onChange={e => setFormData({...formData, phone: e.target.value})} 
                          placeholder="+54 385 123 4567"
                        />
                      </div>
                      
                      <div>
                        <label style={{ 
                          display: 'block',
                          color: COLOR_BLUE, 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          marginBottom: '8px'
                        }}>Sitio Web</label>
                        <input 
                          type="url"
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            border: `2px solid #e2e8f0`,
                            borderRadius: '12px',
                            outline: 'none',
                            fontSize: '16px',
                            fontWeight: '500'
                          }} 
                          value={formData.website_url} 
                          onChange={e => setFormData({...formData, website_url: e.target.value})} 
                          placeholder="https://tu-negocio.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block',
                        color: COLOR_BLUE, 
                        fontSize: '14px', 
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>Dirección</label>
                      <input 
                        style={{
                          width: '100%',
                          padding: '14px 18px',
                          border: `2px solid #e2e8f0`,
                          borderRadius: '12px',
                          outline: 'none',
                          fontSize: '16px',
                          fontWeight: '500'
                        }} 
                        value={formData.address} 
                        onChange={e => setFormData({...formData, address: e.target.value})} 
                        placeholder="Calle, número, barrio, ciudad"
                      />
                    </div>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'grid', gap: '25px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <div>
                      <h4 style={{ color: COLOR_BLUE, fontSize: '16px', marginBottom: '8px' }}>📱 Contacto</h4>
                      {business.phone && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Teléfono:</strong> 
                          <a href={`tel:${business.phone}`} style={{ color: COLOR_BLUE, marginLeft: '8px' }}>
                            {business.phone}
                          </a>
                        </div>
                      )}
                      {business.website_url && (
                        <div>
                          <strong>Web:</strong> 
                          <a href={business.website_url} target="_blank" rel="noopener noreferrer" style={{ color: COLOR_BLUE, marginLeft: '8px' }}>
                            {business.website_url}
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 style={{ color: COLOR_BLUE, fontSize: '16px', marginBottom: '8px' }}>📍 Ubicación</h4>
                      <p style={{ margin: 0, color: '#64748b' }}>
                        {business.address || 'Dirección no especificada'}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ color: COLOR_BLUE, fontSize: '16px', marginBottom: '8px' }}>ℹ️ Descripción</h4>
                    <p style={{ margin: 0, color: '#64748b', lineHeight: '1.6' }}>
                      {business.description || 'No se ha agregado una descripción del negocio.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Plan Information */}
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
              }}>
                💎 Tu Plan Actual
              </h2>
              
              <div style={{
                background: `linear-gradient(135deg, ${COLOR_GOLD}22 0%, ${COLOR_GOLD}11 100%)`,
                border: `3px solid ${COLOR_GOLD}44`,
                borderRadius: '20px',
                padding: '30px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: COLOR_BLUE, marginBottom: '10px' }}>
                  {getPlanDisplayName(business.plan)}
                </div>
                <div style={{ color: '#64748b', marginBottom: '20px' }}>
                  Hasta {getMaxImagesForPlan(business.plan)} imágenes en galería
                </div>
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: COLOR_BLUE }}>
                      {business.gallery_images?.length || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Imágenes usadas
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: COLOR_BLUE }}>
                      {getMaxImagesForPlan(business.plan) - (business.gallery_images?.length || 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Disponibles
                    </div>
                  </div>
                </div>
                <button
                  style={{
                    background: COLOR_GOLD,
                    color: COLOR_DARK,
                    border: 'none',
                    padding: '12px 30px',
                    borderRadius: '50px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: `0 6px 20px ${COLOR_GOLD}44`
                  }}
                >
                  🚀 Mejorar Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
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
            }}>
              🖼️ Galería de Imágenes ({business.gallery_images?.length || 0}/{getMaxImagesForPlan(business.plan)})
            </h2>

            {/* Upload Section */}
            <div style={{
              border: `3px dashed ${COLOR_GOLD}66`,
              borderRadius: '20px',
              padding: '40px',
              textAlign: 'center',
              background: `${COLOR_GOLD}08`,
              marginBottom: '40px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📸</div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="gallery-upload"
                disabled={uploadingImages}
              />
              <label
                htmlFor="gallery-upload"
                style={{
                  cursor: uploadingImages ? 'not-allowed' : 'pointer',
                  color: COLOR_BLUE,
                  fontWeight: 'bold',
                  fontSize: '18px'
                }}
              >
                {uploadingImages ? '⏳ Subiendo imágenes...' : '📎 Haz clic para agregar imágenes'}
              </label>
              <p style={{ color: '#64748b', margin: '15px 0 0 0', fontSize: '14px' }}>
                JPG, PNG hasta 5MB cada una • Máximo {getMaxImagesForPlan(business.plan)} imágenes con tu plan
              </p>
            </div>

            {/* Gallery Grid */}
            {business.gallery_images && business.gallery_images.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '20px'
              }}>
                {business.gallery_images.map((imageUrl, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <Image
                      src={imageUrl}
                      alt={`Imagen ${index + 1} de ${business.name}`}
                      width={200}
                      height={200}
                      style={{
                        borderRadius: '16px',
                        objectFit: 'cover',
                        border: '3px solid #e5e7eb',
                        width: '100%',
                        height: '200px'
                      }}
                    />
                    <button
                      onClick={() => handleRemoveImage(imageUrl)}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: COLOR_RED,
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '60px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🖼️</div>
                <p style={{ fontSize: '18px', fontWeight: '500' }}>
                  Aún no has subido imágenes de tu negocio
                </p>
                <p style={{ fontSize: '14px' }}>
                  Las imágenes ayudan a atraer más clientes
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
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
            }}>
              📊 Estadísticas y Rendimiento
            </h2>
            
            <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              <div style={{
                background: `linear-gradient(135deg, ${COLOR_GOLD}22 0%, ${COLOR_GOLD}11 100%)`,
                borderRadius: '16px',
                padding: '24px',
                border: `2px solid ${COLOR_GOLD}44`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '16px', color: COLOR_BLUE, margin: 0 }}>Vistas Totales</h3>
                  <span style={{ fontSize: '24px' }}>👁️</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: COLOR_BLUE }}>
                  {stats?.total_views || 0}
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '5px 0 0 0' }}>
                  +{stats?.monthly_views || 0} este mes
                </p>
              </div>

              <div style={{
                background: `linear-gradient(135deg, ${COLOR_GREEN}22 0%, ${COLOR_GREEN}11 100%)`,
                borderRadius: '16px',
                padding: '24px',
                border: `2px solid ${COLOR_GREEN}44`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '16px', color: COLOR_BLUE, margin: 0 }}>Calificación</h3>
                  <span style={{ fontSize: '24px' }}>⭐</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: COLOR_BLUE }}>
                  {stats?.average_rating || 0}
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '5px 0 0 0' }}>
                  {stats?.total_reviews || 0} reseñas
                </p>
              </div>

              <div style={{
                background: `linear-gradient(135deg, #3B82F622 0%, #3B82F611 100%)`,
                borderRadius: '16px',
                padding: '24px',
                border: `2px solid #3B82F644`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '16px', color: COLOR_BLUE, margin: 0 }}>Reservas</h3>
                  <span style={{ fontSize: '24px' }}>📅</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: COLOR_BLUE }}>
                  {stats?.total_bookings || 0}
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '5px 0 0 0' }}>
                  Este mes
                </p>
              </div>
            </div>

            <div style={{ marginTop: '40px' }}>
              <h3 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '18px' }}>
                📈 Tendencias Recientes
              </h3>
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '30px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
                <p style={{ color: '#64748b', fontSize: '16px' }}>
                  Las estadísticas detalladas estarán disponibles próximamente
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
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
            }}>
              ⚙️ Configuración del Negocio
            </h2>
            
            <div style={{ display: 'grid', gap: '30px' }}>
              
              {/* Business Status */}
              <div>
                <h3 style={{ color: COLOR_BLUE, fontSize: '18px', marginBottom: '15px' }}>
                  🔄 Estado del Negocio
                </h3>
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>Estado actual:</strong> {business.is_active ? 'Activo' : 'Inactivo'}
                    <p style={{ color: '#64748b', fontSize: '14px', margin: '5px 0 0 0' }}>
                      {business.is_active 
                        ? 'Tu negocio es visible para los visitantes' 
                        : 'Tu negocio no es visible públicamente'}
                    </p>
                  </div>
                  <button
                    style={{
                      background: business.is_active ? COLOR_RED : COLOR_GREEN,
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '50px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {business.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>

              {/* Subscription */}
              <div>
                <h3 style={{ color: COLOR_BLUE, fontSize: '18px', marginBottom: '15px' }}>
                  💳 Suscripción y Pagos
                </h3>
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <div style={{ marginBottom: '15px' }}>
                    <strong>Plan actual:</strong> {getPlanDisplayName(business.plan)}
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <strong>Estado de pago:</strong> 
                    <span style={{ 
                      color: getStatusColor(business.payment_status),
                      marginLeft: '8px',
                      fontWeight: 'bold'
                    }}>
                      {business.payment_status === 'paid' ? 'Al día' : 'Pendiente'}
                    </span>
                  </div>
                  {business.subscription_end && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong>Vencimiento:</strong> {new Date(business.subscription_end).toLocaleDateString('es-AR')}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 style={{ color: COLOR_BLUE, fontSize: '18px', marginBottom: '15px' }}>
                  🚀 Acciones Rápidas
                </h3>
                <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <button style={{
                    background: 'white',
                    border: `2px solid ${COLOR_BLUE}22`,
                    color: COLOR_BLUE,
                    padding: '16px',
                    borderRadius: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}>
                    💬 Contactar Soporte
                  </button>
                  
                  <button style={{
                    background: 'white',
                    border: `2px solid ${COLOR_BLUE}22`,
                    color: COLOR_BLUE,
                    padding: '16px',
                    borderRadius: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}>
                    📊 Exportar Datos
                  </button>
                  
                  <button style={{
                    background: 'white',
                    border: `2px solid ${COLOR_RED}22`,
                    color: COLOR_RED,
                    padding: '16px',
                    borderRadius: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}>
                    🗑️ Eliminar Cuenta
                  </button>
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