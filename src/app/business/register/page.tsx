"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { generateUniqueFileName } from '@/lib/sanitize-filename';
import { getErrorMessage, logError } from '@/lib/error-handler';

const COLOR_GOLD = '#F1C40F';
const COLOR_BLUE = '#1A3A6C';
const COLOR_DARK = '#0e1f1d';
const COLOR_GREEN = '#10B981';

interface BusinessPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  max_images: number;
}

export default function BusinessRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');

  const [businessData, setBusinessData] = useState({
    name: '',
    email: '',
    password: '',
    password_confirm: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    website_url: '',
    category: 'restaurante',
    instagram_url: '',
    facebook_url: '',
    whatsapp: ''
  });

  const [selectedPlan, setSelectedPlan] = useState<string>('basic');
  const [plans, setPlans] = useState<BusinessPlan[]>([]);

  const categories = [
    'restaurante', 'hotel', 'tour', 'tienda', 'servicio',
    'entretenimiento', 'actividades', 'transporte', 'otro'
  ];

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await supabase
        .from('business_plans')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (data) setPlans(data as BusinessPlan[]);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setCoverPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const validateStep1 = () => {
    if (!businessData.name.trim()) {
      setError('El nombre del negocio es obligatorio');
      return false;
    }
    if (!businessData.email.trim()) {
      setError('El email es obligatorio');
      return false;
    }
    if (!businessData.password || businessData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (businessData.password !== businessData.password_confirm) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    if (!businessData.phone.trim()) {
      setError('El teléfono es obligatorio');
      return false;
    }
    if (!avatarFile) {
      setError('Por favor carga un avatar/logo del negocio');
      return false;
    }
    return true;
  };

  const handleStep1Continue = () => {
    setError('');
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleRegister = async () => {
    if (!selectedPlan) {
      setError('Por favor selecciona un plan');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create auth user with role metadata (trigger will use this)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: businessData.email,
        password: businessData.password,
        options: {
          data: {
            role: 'business',
            name: businessData.name
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user created');

      const userId = authData.user.id;

      // 2. Upload avatar
      let avatarUrl = '';
      if (avatarFile) {
        const fileName = generateUniqueFileName(`business-avatar-${Date.now()}.jpg`);
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`business/${fileName}`, avatarFile);

        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(`business/${fileName}`);
        avatarUrl = data.publicUrl;
      }

      // 3. Upload cover image
      let coverUrl = '';
      if (coverFile) {
        const fileName = generateUniqueFileName(`business-cover-${Date.now()}.jpg`);
        const { error: uploadError } = await supabase.storage
          .from('business_covers')
          .upload(`/${fileName}`, coverFile);

        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('business_covers').getPublicUrl(`/${fileName}`);
        coverUrl = data.publicUrl;
      }

      // 4. Update profile entry (created by trigger) with avatar
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: businessData.name,
          email: businessData.email,
          avatar_url: avatarUrl,
          role: 'business'
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // 5. Create business entry
      const { error: businessError } = await supabase
        .from('business_profiles')
        .insert([{
          auth_id: userId,
          name: businessData.name,
          email: businessData.email,
          description: businessData.description,
          phone: businessData.phone,
          address: businessData.address,
          city: businessData.city,
          country: businessData.country,
          website_url: businessData.website_url,
          category: businessData.category,
          instagram_url: businessData.instagram_url,
          facebook_url: businessData.facebook_url,
          whatsapp: businessData.whatsapp,
          avatar_url: avatarUrl,
          cover_image_url: coverUrl,
          plan: selectedPlan,
          is_active: true,
          is_verified: false,
          created_at: new Date()
        }]);

      if (businessError) throw businessError;

      // 6. Update user metadata
      await supabase.auth.updateUser({
        data: { role: 'business', business_name: businessData.name }
      });

      setStep(3);
    } catch (err) {
      logError('Register business', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${COLOR_DARK} 0%, #1a3a3a 100%)`, padding: '40px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ color: COLOR_GOLD, fontSize: '48px', fontWeight: 'bold', margin: '0 0 20px 0' }}>
            🏢 Registra tu Negocio
          </h1>
          <p style={{ color: '#ddd', fontSize: '18px', margin: 0 }}>
            Únete a nuestra plataforma y atrae más clientes turísticos
          </p>
        </div>

        {/* Progress Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '60px' }}>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: s <= step ? COLOR_GOLD : '#333',
                color: s <= step ? COLOR_DARK : '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '20px',
                transition: 'all 0.3s'
              }}
            >
              {s === 1 && '📋'}
              {s === 2 && '💳'}
              {s === 3 && '✅'}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: '#EF4444',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '12px',
            marginBottom: '30px',
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Step 1: Business Info */}
        {step === 1 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ color: COLOR_BLUE, marginBottom: '30px', fontSize: '28px' }}>01. Información del Negocio</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
              {/* Avatar Upload */}
              <div>
                <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '10px' }}>
                  Logo/Avatar del Negocio *
                </label>
                <div
                  style={{
                    border: `2px dashed ${COLOR_GOLD}`,
                    borderRadius: '12px',
                    padding: '30px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    background: avatarPreview ? '#f9fafb' : 'white'
                  }}
                >
                  {avatarPreview ? (
                    <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
                      <Image
                        src={avatarPreview}
                        alt="Avatar preview"
                        width={120}
                        height={120}
                        style={{ borderRadius: '50%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '40px', marginBottom: '10px' }}>📷</div>
                      <p style={{ color: '#666', marginBottom: '5px' }}>Haz clic para subir</p>
                      <small style={{ color: '#999' }}>JPG, PNG - Max 5MB</small>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                    id="avatar-input"
                  />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                </div>
              </div>

              {/* Cover Upload */}
              <div>
                <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '10px' }}>
                  Imagen de Portada
                </label>
                <div
                  style={{
                    border: `2px dashed ${COLOR_GOLD}33`,
                    borderRadius: '12px',
                    padding: '30px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: coverPreview ? '#f9fafb' : 'white'
                  }}
                >
                  {coverPreview ? (
                    <Image
                      src={coverPreview}
                      alt="Cover preview"
                      width={200}
                      height={120}
                      style={{ borderRadius: '8px', objectFit: 'cover' }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: '40px', marginBottom: '10px' }}>🖼️</div>
                      <p style={{ color: '#666', marginBottom: '5px' }}>Imagen de portada (opcional)</p>
                      <small style={{ color: '#999' }}>JPG, PNG - Max 5MB</small>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleCoverChange} hidden />
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <input
                type="text"
                placeholder="Nombre del negocio *"
                value={businessData.name}
                onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <select
                value={businessData.category}
                onChange={(e) => setBusinessData({ ...businessData, category: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Contact Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <input
                type="email"
                placeholder="Email de contacto *"
                value={businessData.email}
                onChange={(e) => setBusinessData({ ...businessData, email: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <input
                type="tel"
                placeholder="Teléfono *"
                value={businessData.phone}
                onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <input
                type="password"
                placeholder="Contraseña *"
                value={businessData.password}
                onChange={(e) => setBusinessData({ ...businessData, password: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <input
                type="password"
                placeholder="Confirmar contraseña *"
                value={businessData.password_confirm}
                onChange={(e) => setBusinessData({ ...businessData, password_confirm: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Full width fields */}
            <textarea
              placeholder="Descripción del negocio (qué ofreces, especialidad, etc.)"
              value={businessData.description}
              onChange={(e) => setBusinessData({ ...businessData, description: e.target.value })}
              style={{
                padding: '12px 15px',
                border: `2px solid #e2e8f0`,
                borderRadius: '8px',
                fontSize: '14px',
                width: '100%',
                minHeight: '100px',
                marginBottom: '20px'
              }}
            />

            <input
              type="text"
              placeholder="Dirección (opcional)"
              value={businessData.address}
              onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
              style={{
                padding: '12px 15px',
                border: `2px solid #e2e8f0`,
                borderRadius: '8px',
                fontSize: '14px',
                width: '100%',
                marginBottom: '20px'
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <input
                type="text"
                placeholder="Ciudad"
                value={businessData.city}
                onChange={(e) => setBusinessData({ ...businessData, city: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <input
                type="text"
                placeholder="País"
                value={businessData.country}
                onChange={(e) => setBusinessData({ ...businessData, country: e.target.value })}
                style={{
                  padding: '12px 15px',
                  border: `2px solid #e2e8f0`,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Social Links */}
            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
              <h4 style={{ color: COLOR_BLUE, marginBottom: '15px' }}>Redes Sociales (Opcional)</h4>
              <input
                type="text"
                placeholder="Instagram (ej: @mirestaurante)"
                value={businessData.instagram_url}
                onChange={(e) => setBusinessData({ ...businessData, instagram_url: e.target.value })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '13px',
                  width: '100%',
                  marginBottom: '10px'
                }}
              />
              <input
                type="text"
                placeholder="Facebook URL"
                value={businessData.facebook_url}
                onChange={(e) => setBusinessData({ ...businessData, facebook_url: e.target.value })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '13px',
                  width: '100%',
                  marginBottom: '10px'
                }}
              />
              <input
                type="text"
                placeholder="WhatsApp (ej: +56912345678)"
                value={businessData.whatsapp}
                onChange={(e) => setBusinessData({ ...businessData, whatsapp: e.target.value })}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '13px',
                  width: '100%'
                }}
              />
            </div>

            <button
              onClick={handleStep1Continue}
              style={{
                width: '100%',
                padding: '15px',
                background: COLOR_GOLD,
                color: COLOR_DARK,
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              Continuar al Plan →
            </button>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ color: COLOR_BLUE, marginBottom: '30px', fontSize: '28px' }}>02. Elige tu Plan</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', marginBottom: '40px' }}>
              {plans.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  style={{
                    border: selectedPlan === plan.id ? `3px solid ${COLOR_GOLD}` : '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '25px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    background: selectedPlan === plan.id ? '#f9fafb' : 'white',
                    transform: selectedPlan === plan.id ? 'scale(1.05)' : 'scale(1)'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '15px' }}>
                    {plan.name === 'basic' && '🌱'}
                    {plan.name === 'pro' && '⭐'}
                    {plan.name === 'premium' && '👑'}
                  </div>
                  <h3 style={{ color: COLOR_BLUE, marginBottom: '10px' }}>{plan.display_name}</h3>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px', minHeight: '40px' }}>
                    {plan.features[0]}
                  </p>
                  <div style={{ color: COLOR_GOLD, fontWeight: 'bold', marginBottom: '20px', fontSize: '18px' }}>
                    {plan.price_monthly === 0 ? 'Gratuito' : `$${plan.price_monthly}/mes`}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {plan.features.slice(0, 4).map((feat, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#666', marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0 }}>✓</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: '#e2e8f0',
                  color: COLOR_DARK,
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ← Atrás
              </button>
              <button
                onClick={handleRegister}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: COLOR_GOLD,
                  color: COLOR_DARK,
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? '⏳ Registrando...' : 'Crear Cuenta Empresarial →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '80px', marginBottom: '30px' }}>✅</div>
            <h2 style={{ color: COLOR_GREEN, marginBottom: '20px', fontSize: '32px' }}>¡Bienvenido al Agente Turístico</h2>
            <p style={{ color: '#666', marginBottom: '30px', fontSize: '16px' }}>
              Tu cuenta de negocio ha sido creada exitosamente. Ahora puedes acceder a tu panel de control.
            </p>
            <button
              onClick={() => router.push('/dashboard/business')}
              style={{
                padding: '15px 40px',
                background: COLOR_GOLD,
                color: COLOR_DARK,
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Ir a mi Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
