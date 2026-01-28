"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

interface BusinessPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  max_images: number;
  priority: number;
}

export default function BusinessRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Info básica, 2: Plan, 3: Pago
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  // Form data
  const [businessData, setBusinessData] = useState({
    name: '',
    description: '',
    website_url: '',
    phone: '',
    address: '',
    category: '',
    email: '',
    password: ''
  });

  const [selectedPlan, setSelectedPlan] = useState<BusinessPlan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [plans, setPlans] = useState<BusinessPlan[]>([]);

  const COLOR_GOLD = '#F1C40F';
  const COLOR_BLUE = '#1A3A6C';
  const COLOR_DARK = '#0e1f1d';

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    // Mock plans for now - in production, fetch from database
    const mockPlans: BusinessPlan[] = [
      {
        id: '1',
        name: 'basic',
        display_name: 'Plan Gratuito',
        price_monthly: 0,
        price_yearly: 0,
        features: [
          'Registro gratuito en la app',
          'Hasta 5 fotos en galería',
          'Información de contacto',
          'Horarios de atención'
        ],
        max_images: 5,
        priority: 1
      },
      {
        id: '2',
        name: 'pro',
        display_name: 'Plan Pro',
        price_monthly: 5000,
        price_yearly: 50000,
        features: [
          'Todo del plan Básico',
          'Hasta 15 fotos en galería',
          'Posición destacada en búsquedas',
          'Estadísticas de visitas',
          'Soporte prioritario',
          'Actualizaciones ilimitadas'
        ],
        max_images: 15,
        priority: 2
      },
      {
        id: '3',
        name: 'premium',
        display_name: 'Plan Premium',
        price_monthly: 10000,
        price_yearly: 100000,
        features: [
          'Todo del plan Pro',
          'Hasta 50 fotos en galería',
          'Posición TOP en todas las búsquedas',
          'Anuncios destacados',
          'Gestión de promociones',
          'API access',
          'Soporte 24/7'
        ],
        max_images: 50,
        priority: 3
      }
    ];
    setPlans(mockPlans);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedPlan && galleryImages.length + files.length > selectedPlan.max_images) {
      setError(`Máximo ${selectedPlan.max_images} imágenes permitidas para este plan`);
      return;
    }
    setGalleryImages(prev => [...prev, ...files]);
    setError('');
  };

  const removeImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessData.name || !businessData.email || !businessData.password) {
      setError('Por favor completa todos los campos obligatorios');
      return;
    }
    setStep(2);
    setError('');
  };

  const handlePlanSelection = (plan: BusinessPlan) => {
    setSelectedPlan(plan);
    setStep(3);
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;

    setLoading(true);
    setError('');

    try {
      // Create user account first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: businessData.email,
        password: businessData.password,
        options: {
          data: {
            role: 'business'
          }
        }
      });

      if (authError) throw authError;

      // Upload gallery images to Supabase Storage
      const imageUrls: string[] = [];
      for (const image of galleryImages) {
        const fileName = `${Date.now()}-${image.name}`;
        const storagePath = `uploads/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(storagePath, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(storagePath);

        imageUrls.push(publicUrl);
      }

      // Create business profile (unified table)
      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .insert({
          auth_id: authData.user?.id,
          name: businessData.name,
          email: businessData.email,
          description: businessData.description,
          website_url: businessData.website_url,
          phone: businessData.phone,
          address: businessData.address,
          category: businessData.category,
          plan: selectedPlan.name,
          gallery_images: imageUrls,
          payment_status: selectedPlan.name === 'basic' ? 'paid' : 'pending',
          is_active: selectedPlan.name === 'basic' ? true : false
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // After sign-up, require email confirmation: set awaiting state and notify user (do not auto-redirect)
      setAwaitingConfirmation(true);
      setSuccess('¡Registro iniciado! Te enviamos un correo de confirmación. Por favor confirma tu cuenta desde el email antes de ingresar.');

      // For paid plans, create payment preference and open in new window
      if (selectedPlan.name !== 'basic') {
        const paymentAmount = billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly;

        try {
          const paymentResponse = await fetch('/api/payments/mercadopago', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              businessId: businessProfile.id,
              planName: selectedPlan.name,
              amount: paymentAmount,
              period: billingPeriod,
              businessName: businessProfile.name,
              businessEmail: businessData.email,
            }),
          });

          console.log('Sending payment request:', JSON.stringify({
            businessId: businessProfile.id,
            planName: selectedPlan.name,
            amount: paymentAmount,
            period: billingPeriod,
            businessName: businessProfile.name,
            businessEmail: businessData.email,
          }, null, 2));

          if (paymentResponse.ok) {
            const paymentData = await paymentResponse.json();
            if (paymentData.initPoint) {
              setPaymentLink(paymentData.initPoint);
              setSuccess('¡Registro iniciado! Te enviamos un correo de confirmación. Confirma tu cuenta desde el email, luego inicia sesión. Una vez logueado, podrás completar el pago desde el botón abajo o desde tu dashboard.');
            } else {
              setSuccess('¡Registro iniciado! Te enviamos un correo de confirmación. Confirma tu cuenta desde el email, luego inicia sesión. Podrás configurar el pago desde tu panel.');
            }
          } else {
            setSuccess('¡Registro iniciado! Te enviamos un correo de confirmación. Confirma tu cuenta desde el email, luego inicia sesión. Podrás configurar el pago desde tu panel.');
          }
        } catch (paymentErr) {
          console.warn('No se pudo crear la preferencia de pago:', paymentErr);
          setSuccess('¡Registro iniciado! Te enviamos un correo de confirmación. Confirma tu cuenta desde el email, luego inicia sesión. Podrás configurar el pago desde tu panel.');
        }
      }

      // NO redirigir automáticamente, el usuario debe confirmar el email primero

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.status;
      if (status === 429) {
        setError('Demasiados intentos. Espera un momento y revisa tu correo de confirmación.');
      } else {
        setError('Error: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'Restaurante', 'Hotel', 'Café', 'Artesanía', 'Tienda', 'Servicio', 'Otro'
  ];

  return (
    <>
      <style jsx global>{`
        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: 'white',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${COLOR_BLUE} 0%, ${COLOR_DARK} 100%)`,
            color: 'white',
            padding: '30px',
            textAlign: 'center'
          }}>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
              Registrar Negocio
            </h1>
            <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
              {awaitingConfirmation ? 'Confirma tu email para continuar' : `Paso ${step} de 3`}
            </p>
          </div>

        {/* Progress Bar */}
        <div style={{
          padding: '20px 30px',
          background: awaitingConfirmation ? '#fff3cd' : '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}>
          {awaitingConfirmation ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(255,255,255,0.8)',
                padding: '12px 20px',
                borderRadius: '20px',
                border: '2px solid #ffc107'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#ffc107',
                  animation: 'pulse 2s infinite'
                }}></div>
                <span style={{ 
                  fontWeight: '600', 
                  color: '#856404',
                  fontSize: '16px'
                }}>
                  Esperando confirmación de email
                </span>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              {[1, 2, 3].map(num => (
                <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: step >= num ? COLOR_GOLD : '#e2e8f0',
                    color: step >= num ? COLOR_DARK : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    marginRight: '10px'
                  }}>
                    {num}
                  </div>
                  <span style={{
                    fontSize: '14px',
                    color: step >= num ? COLOR_BLUE : '#64748b',
                    fontWeight: step >= num ? '600' : '400'
                  }}>
                    {num === 1 ? 'Información' : num === 2 ? 'Plan' : 'Pago'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '40px' }}>

          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#dc2626',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: awaitingConfirmation ? '#fef3cd' : '#d1fae5',
              color: awaitingConfirmation ? '#856404' : '#059669',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: awaitingConfirmation ? '1px solid #ffeaa7' : '1px solid #a7f3d0'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                {awaitingConfirmation ? '📧 Confirmación Requerida' : '✅ Éxito'}
              </div>
              <div>{success}</div>
              {paymentLink && (
                <div style={{ marginTop: 15 }}>
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer" style={{
                    background: '#00a650',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    display: 'inline-block',
                    fontWeight: 'bold'
                  }}>
                    💳 Completar Pago Ahora
                  </a>
                </div>
              )}
              {awaitingConfirmation && (
                <div style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    background: 'rgba(255,255,255,0.7)', 
                    padding: '10px', 
                    borderRadius: '6px',
                    borderLeft: '4px solid #f39c12'
                  }}>
                    💡 <strong>Pasos siguientes:</strong>
                    <ol style={{ marginTop: '8px', paddingLeft: '18px' }}>
                      <li>Revisa tu email <strong>{businessData.email}</strong></li>
                      <li>Haz clic en el enlace de confirmación</li>
                      <li>Vuelve aquí e inicia sesión</li>
                    </ol>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setError('');
                        try {
                          const { error } = await supabase.auth.signInWithOtp({ email: businessData.email });
                          if (error) throw error;
                          setSuccess('Se envió un nuevo correo de confirmación a tu email. Revisa la bandeja de entrada.');
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : String(err);
                          setError('Error al reenviar correo: ' + msg);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      style={{
                        background: '#1A3A6C',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 8,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      {loading ? 'Enviando...' : 'Reenviar Email'}
                    </button>
                    <button
                      onClick={() => router.push('/login')}
                      style={{
                        background: COLOR_GOLD,
                        color: COLOR_DARK,
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Ir a Iniciar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Basic Information */}
          {step === 1 && !awaitingConfirmation && (
            <form onSubmit={handleBasicInfoSubmit}>
              <h2 style={{ color: COLOR_BLUE, marginBottom: '30px', fontSize: '24px' }}>
                Información del Negocio
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                    Nombre del Negocio *
                  </label>
                  <input
                    type="text"
                    value={businessData.name}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, name: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                    Categoría *
                  </label>
                  <select
                    value={businessData.category}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, category: e.target.value }))}
                    style={inputStyle}
                    required
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                  Descripción
                </label>
                <textarea
                  value={businessData.description}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, description: e.target.value }))}
                  style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                  placeholder="Describe tu negocio..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={businessData.phone}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, phone: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                    Sitio Web
                  </label>
                  <input
                    type="url"
                    value={businessData.website_url}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, website_url: e.target.value }))}
                    style={inputStyle}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                  Dirección
                </label>
                <input
                  type="text"
                  value={businessData.address}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
                  style={inputStyle}
                  placeholder="Dirección completa"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={businessData.email}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, email: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: COLOR_DARK }}>
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    value={businessData.password}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, password: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  ...buttonStyle,
                  marginTop: '30px',
                  width: '100%'
                }}
              >
                Continuar al Plan →
              </button>
            </form>
          )}

          {/* Step 2: Plan Selection */}
          {step === 2 && !awaitingConfirmation && (
            <div>
              <h2 style={{ color: COLOR_BLUE, marginBottom: '30px', fontSize: '24px' }}>
                Selecciona tu Plan
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
              }}>
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    style={{
                      border: `2px solid ${COLOR_GOLD}33`,
                      borderRadius: '16px',
                      padding: '25px',
                      background: 'white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                      e.currentTarget.style.borderColor = COLOR_GOLD;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      e.currentTarget.style.borderColor = `${COLOR_GOLD}33`;
                    }}
                    onClick={() => handlePlanSelection(plan)}
                  >
                    <div style={{
                      background: COLOR_GOLD,
                      color: COLOR_DARK,
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      display: 'inline-block',
                      marginBottom: '15px'
                    }}>
                      {plan.display_name}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: COLOR_BLUE, marginBottom: '5px' }}>
                        ${billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '14px' }}>
                        por {billingPeriod === 'monthly' ? 'mes' : 'año'}
                      </div>
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {plan.features.map((feature, index) => (
                        <li key={index} style={{
                          marginBottom: '8px',
                          fontSize: '14px',
                          color: '#374151',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <span style={{ color: COLOR_GOLD, marginRight: '8px' }}>✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Billing Period Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '30px'
              }}>
                <div style={{
                  background: '#f3f4f6',
                  padding: '4px',
                  borderRadius: '20px',
                  display: 'flex'
                }}>
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      background: billingPeriod === 'monthly' ? COLOR_BLUE : 'transparent',
                      color: billingPeriod === 'monthly' ? 'white' : '#374151',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Mensual
                  </button>
                  <button
                    onClick={() => setBillingPeriod('yearly')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      background: billingPeriod === 'yearly' ? COLOR_BLUE : 'transparent',
                      color: billingPeriod === 'yearly' ? 'white' : '#374151',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Anual (2 meses gratis)
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    ...buttonStyle,
                    background: '#f3f4f6',
                    color: COLOR_DARK,
                    border: '2px solid #e5e7eb'
                  }}
                >
                  ← Volver
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment & Gallery */}
          {step === 3 && selectedPlan && !awaitingConfirmation && (
            <div>
              <h2 style={{ color: COLOR_BLUE, marginBottom: '30px', fontSize: '24px' }}>
                Galería de Imágenes y Pago
              </h2>

              {/* Gallery Upload */}
              <div style={{ marginBottom: '40px' }}>
                <h3 style={{ color: COLOR_DARK, marginBottom: '15px', fontSize: '18px' }}>
                  Galería de Imágenes ({galleryImages.length}/{selectedPlan.max_images})
                </h3>

                <div style={{
                  border: `2px dashed ${COLOR_GOLD}44`,
                  borderRadius: '12px',
                  padding: '30px',
                  textAlign: 'center',
                  background: '#fefce8',
                  marginBottom: '20px'
                }}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    id="gallery-upload"
                  />
                  <label
                    htmlFor="gallery-upload"
                    style={{
                      cursor: 'pointer',
                      color: COLOR_BLUE,
                      fontWeight: '600'
                    }}
                  >
                    📸 Haz clic para subir imágenes
                  </label>
                  <p style={{ color: '#64748b', margin: '10px 0 0 0', fontSize: '14px' }}>
                    JPG, PNG hasta 5MB cada una
                  </p>
                </div>

                {/* Image Preview */}
                {galleryImages.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: '15px',
                    marginBottom: '20px'
                  }}>
                    {galleryImages.map((image, index) => (
                      <div key={index} style={{ position: 'relative' }}>
                        <Image
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          width={120}
                          height={120}
                          style={{
                            borderRadius: '8px',
                            objectFit: 'cover',
                            border: '2px solid #e5e7eb'
                          }}
                        />
                        <button
                          onClick={() => removeImage(index)}
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Summary */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '25px',
                marginBottom: '30px',
                border: `1px solid ${COLOR_GOLD}33`
              }}>
                <h3 style={{ color: COLOR_DARK, marginBottom: '20px', fontSize: '18px' }}>
                  Resumen del Pedido
                </h3>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Plan:</span>
                  <strong>{selectedPlan.display_name}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Período:</span>
                  <strong>{billingPeriod === 'monthly' ? 'Mensual' : 'Anual'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Imágenes incluidas:</span>
                  <strong>Hasta {selectedPlan.max_images}</strong>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '15px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold' }}>
                  <span>Total:</span>
                  <span style={{ color: COLOR_BLUE }}>
                    ${billingPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly}
                    {billingPeriod === 'yearly' && (
                      <span style={{ fontSize: '14px', color: '#059669', marginLeft: '8px' }}>
                        (Ahorras ${(selectedPlan.price_monthly * 12) - selectedPlan.price_yearly})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    ...buttonStyle,
                    background: '#f3f4f6',
                    color: COLOR_DARK,
                    border: '2px solid #e5e7eb'
                  }}
                >
                  ← Volver
                </button>

                <button
                  onClick={handlePayment}
                  disabled={loading || awaitingConfirmation}
                  style={{
                    ...buttonStyle,
                    background: selectedPlan?.name === 'basic' ? '#0e7490' : '#00a650',
                    flex: 1,
                    opacity: (loading || awaitingConfirmation) ? 0.6 : 1
                  }}
                >
                  {loading ? 'Procesando...' : (awaitingConfirmation ? 'Revisa tu email' : (selectedPlan?.name === 'basic' ? 'Registrar Gratis' : 'Pagar con Mercado Pago 💳'))}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          background: '#f8fafc',
          padding: '20px 40px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              color: COLOR_BLUE,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Volver al Inicio
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '2px solid #e2e8f0',
  outline: 'none',
  fontSize: '16px',
  transition: 'all 0.2s ease',
  fontWeight: '500'
};

const buttonStyle = {
  background: '#1A3A6C',
  color: 'white',
  border: 'none',
  padding: '16px 24px',
  borderRadius: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '16px',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(26, 58, 108, 0.3)'
};