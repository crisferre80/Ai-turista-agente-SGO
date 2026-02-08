'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function EmailManagementPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendLog, setSendLog] = useState<any[]>([]);
  const [manualEmails, setManualEmails] = useState('');

  // Colores del tema
  const COLOR_BLUE = '#1e40af';
  const COLOR_GOLD = '#f59e0b';

  // Función para obtener emails manuales válidos
  const getManualEmailsList = () => {
    if (!manualEmails.trim()) return [];
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return manualEmails
      .split(/[\n,;]+/)
      .map(email => email.trim())
      .filter(email => email && emailRegex.test(email));
  };

  // Función para validar y agregar emails manuales
  const validateAndAddManualEmails = () => {
    const validEmails = getManualEmailsList();
    setRecipients(prev => [...new Set([...prev, ...validEmails])]);
    setManualEmails('');
  };

  // Función para manejar cambio de destinatarios
  const handleRecipientChange = (email: string, checked: boolean) => {
    if (checked) {
      setRecipients(prev => [...new Set([...prev, email])]);
    } else {
      setRecipients(prev => prev.filter(e => e !== email));
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Cargar plantillas
      const { data: templatesData, error: templatesError } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      // Cargar configuraciones de notificaciones
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('email_notifications')
        .select('*');

      if (notificationsError) throw notificationsError;

      // Cargar usuarios con emails desde auth.users
      const { data: usersData, error: usersError } = await supabase.rpc('get_users_with_profiles');
      
      // Si el RPC no existe, usar consulta alternativa
      let finalUsersData = usersData;
      if (usersError) {
        console.warn('RPC get_users_with_profiles no disponible, usando consulta alternativa');
        // Intentar cargar desde profiles y obtener emails manualmente
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, role, created_at')
          .eq('role', 'tourist')
          .order('created_at', { ascending: false })
          .limit(100);
        
        finalUsersData = profilesData || [];
      }

      // Cargar negocios aprobados
      const { data: businessesData, error: businessesError } = await supabase
        .from('business_profiles')
        .select('id, name, email, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100);

      setTemplates(templatesData || []);
      setNotifications(notificationsData || []);
      setUsers(finalUsersData || []);
      setBusinesses(businessesData || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setIsLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!selectedTemplate || recipients.length === 0) {
      alert('Selecciona una plantilla y al menos un destinatario');
      return;
    }

    setIsSending(true);
    const newLogEntry = {
      id: Date.now(),
      template_name: selectedTemplate.name,
      subject: customSubject || selectedTemplate.subject,
      recipients_count: recipients.length,
      sent_at: new Date().toLocaleString(),
      status: 'sending',
      details: [] as string[]
    };
    setSendLog(prev => [newLogEntry, ...prev]);

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Procesar plantilla HTML con variables básicas
      let processedHtml = selectedTemplate.html_content;
      const currentYear = new Date().getFullYear();
      
      // Reemplazar variables comunes
      processedHtml = processedHtml.replace(/\{\{current_year\}\}/g, currentYear.toString());
      processedHtml = processedHtml.replace(/\{\{app_url\}\}/g, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

      // Enviar a cada destinatario
      for (const recipient of recipients) {
        try {
          // Personalizar contenido por destinatario
          let personalizedHtml = processedHtml.replace(/\{\{user_name\}\}/g, recipient.split('@')[0]);
          personalizedHtml = personalizedHtml.replace(/\{\{user_email\}\}/g, recipient);

          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: recipient,
              subject: customSubject || selectedTemplate.subject,
              html: personalizedHtml
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error del servidor');
          }

          const result = await response.json();
          
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            errors.push(`${recipient}: ${result.error}`);
          }
        } catch (error) {
          failCount++;
          const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
          errors.push(`${recipient}: ${errorMsg}`);
          console.error(`Error enviando a ${recipient}:`, error);
        }

        // Pequeña pausa entre envíos
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Actualizar log con resultados
      const finalStatus = failCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial';
      setSendLog(prev => prev.map(log => 
        log.id === newLogEntry.id 
          ? { ...log, status: finalStatus, details: errors }
          : log
      ));

      // Mostrar resultado
      if (failCount === 0) {
        alert(`✅ Email enviado exitosamente a ${successCount} destinatarios`);
      } else if (successCount === 0) {
        alert(`❌ Error: No se pudo enviar a ningún destinatario. Revisa la configuración de Mailjet.`);
      } else {
        alert(`⚠️ Enviado parcialmente: ${successCount} exitosos, ${failCount} fallidos`);
      }
      
      // Reset form solo si fue exitoso
      if (failCount === 0) {
        setSelectedTemplate(null);
        setRecipients([]);
        setCustomSubject('');
      }
    } catch (error) {
      console.error('Error general al enviar email:', error);
      setSendLog(prev => prev.map(log => 
        log.id === newLogEntry.id 
          ? { ...log, status: 'failed', details: [`Error general: ${error instanceof Error ? error.message : 'Error desconocido'}`] }
          : log
      ));
      alert('❌ Error crítico al enviar el email');
    }
    setIsSending(false);
  };

  const cardStyle = {
    background: 'white',
    padding: '30px',
    borderRadius: '20px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    marginBottom: '30px',
    border: '1px solid #e2e8f0'
  };

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📧</div>
          <h2 style={{ color: COLOR_BLUE, margin: 0 }}>Cargando sistema de emails...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)',
      padding: '30px' 
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h1 style={{ color: COLOR_BLUE, fontSize: '2.5rem', margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '15px' }}>
                📧 Gestión de Emails
              </h1>
              <p style={{ color: '#64748b', margin: '10px 0 0 0', fontSize: '16px' }}>
                Envía emails, gestiona campañas y supervisa notificaciones automáticas
              </p>
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button
                onClick={() => router.push('/admin/email-templates')}
                style={{
                  padding: '12px 24px',
                  background: COLOR_GOLD,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📝 Gestionar Plantillas
              </button>
              <button
                onClick={() => router.push('/admin')}
                style={{
                  padding: '12px 24px',
                  background: COLOR_BLUE,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ← Volver al Admin
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          {/* Panel de envío */}
          <div style={cardStyle}>
            <h2 style={{ color: COLOR_BLUE, marginBottom: '25px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📤 Envío de Emails
            </h2>

            {/* Selección de plantilla */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '12px', fontSize: '16px' }}>
                📝 Seleccionar Plantilla:
              </label>
              <div style={{ display: 'grid', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {templates.map((template) => (
                  <div 
                    key={template.id}
                    style={{
                      padding: '15px',
                      border: selectedTemplate?.id === template.id ? `3px solid ${COLOR_BLUE}` : '2px solid #e2e8f0',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      background: selectedTemplate?.id === template.id ? '#f0f9ff' : '#fafbfc'
                    }}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setCustomSubject(template.subject);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: selectedTemplate?.id === template.id ? COLOR_BLUE : '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px'
                      }}>
                        📧
                      </div>
                      <div>
                        <h4 style={{ margin: 0, color: COLOR_BLUE, fontSize: '14px' }}>{template.name}</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>{template.subject}</p>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {template.variables.length} variables disponibles
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personalización del asunto */}
            {selectedTemplate && (
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '8px' }}>
                  ✏️ Personalizar Asunto:
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '14px'
                  }}
                  placeholder="Asunto del email"
                />
              </div>
            )}

            {/* Selección de destinatarios */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '12px', fontSize: '16px' }}>
                👥 Seleccionar Destinatarios:
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                {/* Usuarios */}
                <div style={{
                  background: '#f8fafc',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0'
                }}>
                  <h4 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '14px' }}>👤 Usuarios ({users.length})</h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {users.map((user) => (
                      <label key={user.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={recipients.includes(user.email || user.id)}
                          onChange={(e) => handleRecipientChange(user.email || user.id, e.target.checked)}
                          style={{ marginRight: '8px' }}
                        />
                        <div style={{ fontSize: '12px' }}>
                          <div style={{ fontWeight: 'bold', color: '#374151' }}>{user.name || 'Usuario'}</div>
                          <div style={{ color: '#64748b' }}>{user.email || 'Sin email'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const allUserEmails = users.map(u => u.email || u.id).filter(Boolean);
                      setRecipients(prev => [...new Set([...prev, ...allUserEmails])]);
                    }}
                    style={{
                      marginTop: '10px',
                      padding: '6px 12px',
                      background: COLOR_BLUE,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Seleccionar Todos
                  </button>
                </div>

                {/* Negocios */}
                <div style={{
                  background: '#f8fafc',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0'
                }}>
                  <h4 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '14px' }}>🏪 Negocios ({businesses.length})</h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {businesses.map((business) => (
                      <label key={business.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={recipients.includes(business.email)}
                          onChange={(e) => handleRecipientChange(business.email, e.target.checked)}
                          style={{ marginRight: '8px' }}
                        />
                        <div style={{ fontSize: '12px' }}>
                          <div style={{ fontWeight: 'bold', color: '#374151' }}>{business.name}</div>
                          <div style={{ color: '#64748b' }}>{business.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const allBusinessEmails = businesses.map(b => b.email).filter(Boolean);
                      setRecipients(prev => [...new Set([...prev, ...allBusinessEmails])]);
                    }}
                    style={{
                      marginTop: '10px',
                      padding: '6px 12px',
                      background: COLOR_GOLD,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Seleccionar Todos
                  </button>
                </div>
              </div>

              {/* Resumen de selección */}
              <div style={{
                background: '#f0f9ff',
                padding: '15px',
                borderRadius: '12px',
                border: '2px solid #bfdbfe',
                fontSize: '14px'
              }}>
                <strong>Destinatarios seleccionados: {recipients.length}</strong>
                {recipients.length > 0 && (
                  <button
                    onClick={() => setRecipients([])}
                    style={{
                      marginLeft: '15px',
                      padding: '4px 12px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Limpiar Todo
                  </button>
                )}
              </div>

              {/* Sección de Emails Manuales */}
              <div style={{
                marginTop: '20px',
                background: '#f9fafb',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb'
              }}>
                <h4 style={{ margin: '0 0 15px 0', color: COLOR_BLUE, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✉️ Agregar Emails Manuales
                </h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6b7280' }}>
                  Ingresa emails adicionales separados por líneas, comas o punto y coma
                </p>
                <textarea
                  value={manualEmails}
                  onChange={(e) => setManualEmails(e.target.value)}
                  placeholder="ejemplo@email.com&#10;admin@empresa.com&#10;marketing@negocio.com"
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '10px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    resize: 'vertical',
                    fontFamily: 'monospace'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    {getManualEmailsList().length} email{getManualEmailsList().length !== 1 ? 's' : ''} válido{getManualEmailsList().length !== 1 ? 's' : ''}
                  </span>
                  {getManualEmailsList().length > 0 && (
                    <button
                      onClick={validateAndAddManualEmails}
                      style={{
                        padding: '6px 12px',
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      ✓ Agregar ({getManualEmailsList().length})
                    </button>
                  )}
                </div>
                
                {/* Preview de emails válidos */}
                {getManualEmailsList().length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0'
                  }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 'bold', color: '#15803d' }}>
                      Preview de emails a agregar:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {getManualEmailsList().map((email, index) => (
                        <span key={index} style={{
                          padding: '2px 8px',
                          background: '#dcfce7',
                          color: '#15803d',
                          borderRadius: '12px',
                          fontSize: '10px',
                          border: '1px solid #bbf7d0'
                        }}>
                          {email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de envío */}
            <button
              onClick={sendEmail}
              disabled={!selectedTemplate || recipients.length === 0 || isSending}
              style={{
                width: '100%',
                padding: '15px',
                background: (!selectedTemplate || recipients.length === 0 || isSending) ? '#d1d5db' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: (!selectedTemplate || recipients.length === 0 || isSending) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              {isSending ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Enviando...
                </>
              ) : (
                <>🚀 Enviar Email</>
              )}
            </button>
          </div>

          {/* Panel de estadísticas y notificaciones */}
          <div>
            {/* Estado de notificaciones automáticas */}
            <div style={cardStyle}>
              <h2 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '1.5rem' }}>
                ⚡ Notificaciones Automáticas
              </h2>
              <div style={{ display: 'grid', gap: '15px' }}>
                {notifications.map((notification) => {
                  const template = templates.find(t => t.id === notification.template_id);
                  return (
                    <div key={notification.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '15px',
                      background: notification.is_active ? '#f0fdf4' : '#fef3c7',
                      borderRadius: '12px',
                      border: `2px solid ${notification.is_active ? '#bbf7d0' : '#fed7aa'}`
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>
                          {notification.event_type.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {template?.name || 'Plantilla no encontrada'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Para: {notification.recipient_type}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: notification.is_active ? '#dcfce7' : '#fef3c7',
                        color: notification.is_active ? '#166534' : '#92400e'
                      }}>
                        {notification.is_active ? '✅ Activa' : '⏸️ Pausada'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Log de envíos */}
            <div style={cardStyle}>
              <h2 style={{ color: COLOR_BLUE, marginBottom: '20px', fontSize: '1.5rem' }}>
                📊 Historial de Envíos
              </h2>
              {sendLog.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#64748b',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px', opacity: 0.5 }}>📨</div>
                  <div>No hay envíos registrados aún</div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>Los emails enviados aparecerán aquí</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                  {sendLog.map((log) => (
                    <div key={log.id} style={{
                      padding: '15px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>
                          {log.template_name}
                        </div>
                        <div style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: '#dcfce7',
                          color: '#166534'
                        }}>
                          ✅ Enviado
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>
                        {log.subject}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                        <span>{log.recipients_count} destinatarios</span>
                        <span>{log.sent_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
