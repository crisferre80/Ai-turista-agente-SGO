'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

interface EmailNotification {
  id: string;
  event_type: string;
  template_id: string;
  recipient_type: string;
  is_active: boolean;
}

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Colores del tema
  const COLOR_BLUE = '#1e40af';
  const COLOR_GOLD = '#f59e0b';

  useEffect(() => {
    loadTemplatesAndNotifications();
  }, []);

  const loadTemplatesAndNotifications = async () => {
    try {
      // Cargar plantillas
      const { data: templatesData, error: templatesError } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      // Cargar notificaciones
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('email_notifications')
        .select('*');

      if (notificationsError) throw notificationsError;

      setTemplates(templatesData || []);
      setNotifications(notificationsData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const getNotificationForTemplate = (templateId: string) => {
    return notifications.find(n => n.template_id === templateId);
  };

  const generatePreview = (template: EmailTemplate) => {
    if (!template) return '';

    let html = template.html_content;
    
    // Usar datos de previsualización o valores por defecto
    const sampleData: Record<string, string> = {
      user_name: 'María González',
      user_email: 'maria@ejemplo.com',
      business_name: 'Hotel Colonial',
      business_owner: 'Carlos Ruiz',
      business_email: 'carlos@example.com',
      business_category: 'Hotelería',
      business_phone: '+54 385 123-4567',
      business_dashboard_url: '#',
      admin_url: '#',
      current_year: new Date().getFullYear().toString(),
      ...previewData
    };

    // Reemplazar variables
    template.variables.forEach(variable => {
      const value = sampleData[variable] || previewData[variable] || `{{${variable}}}`;
      const regex = new RegExp(`{{${variable}}}`, 'g');
      html = html.replace(regex, `<span style="background: #fef3c7; padding: 2px 4px; border-radius: 3px; font-weight: bold;">${value}</span>`);
    });

    return html;
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      if (isCreating) {
        const { error } = await supabase
          .from('email_templates')
          .insert({
            name: selectedTemplate.name,
            subject: selectedTemplate.subject,
            html_content: selectedTemplate.html_content,
            variables: selectedTemplate.variables
          });

        if (error) throw error;
        alert('Plantilla creada exitosamente');
      } else {
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: selectedTemplate.name,
            subject: selectedTemplate.subject,
            html_content: selectedTemplate.html_content,
            variables: selectedTemplate.variables,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;
        alert('Plantilla actualizada exitosamente');
      }

      setIsEditing(false);
      setIsCreating(false);
      setSelectedTemplate(null);
      loadTemplatesAndNotifications();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error al guardar la plantilla');
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (!confirm(`¿Estás seguro de eliminar la plantilla "${template.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      alert('Plantilla eliminada');
      loadTemplatesAndNotifications();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error al eliminar la plantilla');
    }
  };

  const toggleNotificationActive = async (notification: EmailNotification) => {
    try {
      const { error } = await supabase
        .from('email_notifications')
        .update({ is_active: !notification.is_active })
        .eq('id', notification.id);

      if (error) throw error;
      loadTemplatesAndNotifications();
    } catch (error) {
      console.error('Error toggling notification:', error);
      alert('Error al cambiar el estado');
    }
  };

  const startCreating = () => {
    setSelectedTemplate({
      id: '',
      name: '',
      subject: '',
      html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 40px; text-align: center; }
    .content { padding: 40px; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8fafc; }
    h1 { margin: 0; font-size: 24px; }
    h2 { color: #1e40af; margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{titulo}}</h1>
    </div>
    <div class="content">
      <h2>Hola {{usuario}},</h2>
      <p>Este es el contenido de tu email personalizado.</p>
      <p style="text-align: center;">
        <a href="{{action_url}}" class="button">Ver Más</a>
      </p>
    </div>
    <div class="footer">
      <p>&copy; {{current_year}} SantiGuía - Santiago del Estero Turismo</p>
    </div>
  </div>
</body>
</html>`,
      variables: ['titulo', 'usuario', 'action_url', 'current_year'],
      created_at: '',
      updated_at: ''
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  const extractVariablesFromHTML = (html: string): string[] => {
    const regex = /{{(\w+)}}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  const handleContentChange = (html: string) => {
    if (!selectedTemplate) return;
    
    const newVariables = extractVariablesFromHTML(html);
    setSelectedTemplate({
      ...selectedTemplate,
      html_content: html,
      variables: newVariables
    });
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cardStyle = {
    background: 'white',
    padding: '30px',
    borderRadius: '20px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    marginBottom: '30px',
    border: '1px solid #e2e8f0'
  };

  if (loading) {
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
          <h2 style={{ color: COLOR_BLUE, margin: 0 }}>Cargando plantillas...</h2>
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
                📧 Plantillas de Email
              </h1>
              <p style={{ color: '#64748b', margin: '10px 0 0 0', fontSize: '16px' }}>
                Gestiona plantillas de correo con vista previa en tiempo real
              </p>
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button
                onClick={startCreating}
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
                  gap: '8px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                ➕ Nueva Plantilla
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

        {/* Estadísticas y Buscador */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
              <input
                type="text"
                placeholder="🔍 Buscar plantillas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '12px 20px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  width: '300px',
                  background: '#f8fafc'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', color: COLOR_BLUE, fontWeight: 'bold' }}>{templates.length}</div>
                <div style={{ color: '#64748b' }}>Plantillas</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', color: '#10b981', fontWeight: 'bold' }}>
                  {notifications.filter(n => n.is_active).length}
                </div>
                <div style={{ color: '#64748b' }}>Activas</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', color: '#f59e0b', fontWeight: 'bold' }}>
                  {filteredTemplates.length}
                </div>
                <div style={{ color: '#64748b' }}>Mostrando</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de plantillas */}
        <div style={cardStyle}>
          <h2 style={{ color: COLOR_BLUE, marginBottom: '25px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📋 Plantillas Disponibles ({filteredTemplates.length})
          </h2>
          
          {filteredTemplates.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '2px dashed #cbd5e1'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}>📧</div>
              <h3 style={{ color: '#64748b', margin: 0 }}>
                {searchTerm ? 'No se encontraron plantillas con ese término' : 'No hay plantillas disponibles'}
              </h3>
              {!searchTerm && (
                <button
                  onClick={startCreating}
                  style={{
                    marginTop: '20px',
                    padding: '12px 24px',
                    background: COLOR_GOLD,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ➕ Crear Primera Plantilla
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {filteredTemplates.map((template) => {
                const notification = getNotificationForTemplate(template.id);
                return (
                  <div key={template.id} style={{
                    background: notification?.is_active ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' : '#f3f4f6',
                    padding: '25px',
                    borderRadius: '16px',
                    border: `3px solid ${notification?.is_active ? '#3b82f6' : '#d1d5db'}`,
                    transition: 'all 0.3s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Badge de estado */}
                    <div style={{
                      position: 'absolute',
                      top: '15px',
                      right: '15px',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: notification?.is_active ? '#dcfce7' : '#fef3c7',
                      color: notification?.is_active ? '#166534' : '#92400e'
                    }}>
                      {notification?.is_active ? '✅ Activa' : '⏸️ Pausada'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '120px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: COLOR_BLUE,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '18px'
                          }}>
                            📧
                          </div>
                          <div>
                            <h3 style={{ color: COLOR_BLUE, margin: '0 0 5px 0', fontSize: '1.2rem' }}>
                              {template.name}
                            </h3>
                            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                              {template.subject}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                          {notification && (
                            <span><strong>Evento:</strong> {notification.event_type}</span>
                          )}
                          {notification && (
                            <span><strong>Para:</strong> {notification.recipient_type}</span>
                          )}
                          <span><strong>Variables:</strong> {template.variables.length}</span>
                          <span><strong>Actualizada:</strong> {new Date(template.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setSelectedTemplate(template);
                              setShowPreview(true);
                            }}
                            style={{
                              padding: '8px 16px',
                              background: COLOR_GOLD,
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            👁️ Preview
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedTemplate(template);
                              setIsEditing(true);
                              setIsCreating(false);
                            }}
                            style={{
                              padding: '8px 16px',
                              background: COLOR_BLUE,
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            ✏️ Editar
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          {notification && (
                            <button
                              onClick={() => toggleNotificationActive(notification)}
                              style={{
                                padding: '8px 16px',
                                background: notification.is_active ? '#ef4444' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              {notification.is_active ? '⏸️ Pausar' : '▶️ Activar'}
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(template)}
                            style={{
                              padding: '8px 16px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            🗑️ Borrar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Variables disponibles */}
                    {template.variables.length > 0 && (
                      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 'bold' }}>Variables disponibles:</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {template.variables.map((variable) => (
                            <span key={variable} style={{
                              background: '#f1f5f9',
                              color: '#374151',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              border: '1px solid #d1d5db',
                              fontFamily: 'monospace'
                            }}>
                              {`{{${variable}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de Vista Previa */}
        {showPreview && selectedTemplate && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
          }}>
            <div style={{
              background: 'white',
              width: '95%',
              height: '95%',
              borderRadius: '24px',
              padding: '30px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ color: COLOR_BLUE, margin: '0 0 5px 0', fontSize: '1.5rem' }}>
                    👁️ Vista Previa: {selectedTemplate.name}
                  </h3>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                    Así se verá el email que recibirán los usuarios
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewData({});
                  }}
                  style={{
                    padding: '12px 20px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ✕ Cerrar
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px', flex: 1 }}>
                {/* Panel de variables */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '16px',
                  padding: '20px',
                  border: '2px solid #e2e8f0'
                }}>
                  <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
                    🏷️ Variables de prueba:
                  </label>
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable} style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                        {`{{${variable}}}`}
                      </label>
                      <input
                        type="text"
                        value={previewData[variable] || ''}
                        onChange={(e) => setPreviewData({
                          ...previewData,
                          [variable]: e.target.value
                        })}
                        className="preview-input"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                        placeholder={`Valor para ${variable}`}
                      />
                    </div>
                  ))}
                </div>

                {/* Preview del email */}
                <div style={{
                  background: '#f1f5f9',
                  borderRadius: '16px',
                  padding: '20px',
                  border: '2px solid #e2e8f0',
                  overflow: 'hidden'
                }}>
                  <iframe
                    srcDoc={generatePreview(selectedTemplate)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: '12px',
                      background: 'white'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edición/Creación */}
        {(isEditing || isCreating) && selectedTemplate && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
          }}>
            <div style={{
              background: 'white',
              width: '98%',
              height: '98%',
              borderRadius: '24px',
              padding: '30px',
              overflow: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                  <h3 style={{ color: COLOR_BLUE, margin: '0 0 5px 0', fontSize: '1.5rem' }}>
                    {isCreating ? '➕ Crear Nueva Plantilla' : `✏️ Editando: ${selectedTemplate.name}`}
                  </h3>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                    {isCreating ? 'Las variables se detectan automáticamente en el HTML' : 'Modifica el contenido y usa la vista previa'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleSave}
                    style={{
                      padding: '12px 24px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    💾 {isCreating ? 'Crear' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setIsCreating(false);
                      setSelectedTemplate(null);
                    }}
                    style={{
                      padding: '12px 24px',
                      background: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', height: 'calc(100% - 120px)' }}>
                {/* Panel de edición */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>
                      📝 Nombre de la Plantilla:
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.name || ''}
                      onChange={(e) => setSelectedTemplate({
                        ...selectedTemplate,
                        name: e.target.value
                      })}
                      style={{
                        width: '100%',
                        padding: '15px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        background: '#fafbfc'
                      }}
                      placeholder="Ej: Bienvenida VIP"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>
                      📧 Asunto del Email:
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.subject || ''}
                      onChange={(e) => setSelectedTemplate({
                        ...selectedTemplate,
                        subject: e.target.value
                      })}
                      style={{
                        width: '100%',
                        padding: '15px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        background: '#fafbfc'
                      }}
                      placeholder="Ej: ¡Bienvenido a SantiGuía!"
                    />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>
                      🎨 Contenido HTML:
                    </label>
                    <textarea
                      value={selectedTemplate.html_content || ''}
                      onChange={(e) => handleContentChange(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '15px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontFamily: 'JetBrains Mono, Consolas, monospace',
                        resize: 'none',
                        background: '#fafbfc',
                        lineHeight: '1.5'
                      }}
                      placeholder="Escribe el contenido HTML aquí..."
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '12px', fontSize: '16px' }}>
                      🏷️ Variables Detectadas ({selectedTemplate.variables.length}):
                    </label>
                    <div style={{
                      background: '#f0f9ff',
                      padding: '20px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      border: '2px solid #bfdbfe',
                      maxHeight: '120px',
                      overflowY: 'auto'
                    }}>
                      {selectedTemplate.variables.length > 0 ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedTemplate.variables.map((variable) => (
                            <code key={variable} style={{ 
                              background: COLOR_GOLD, 
                              padding: '6px 10px', 
                              borderRadius: '8px', 
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}>
                              {`{{${variable}}}`}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                          No hay variables en el HTML. Usa la sintaxis: {`{{nombre_variable}}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Panel de vista previa */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', color: COLOR_BLUE, fontWeight: 'bold', marginBottom: '12px', fontSize: '16px' }}>
                    👁️ Vista Previa en Tiempo Real:
                  </label>
                  <div style={{
                    flex: 1,
                    background: '#f1f5f9',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '2px solid #e2e8f0'
                  }}>
                    <iframe
                      key={selectedTemplate.html_content} // Force re-render when content changes
                      srcDoc={generatePreview(selectedTemplate)}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: '12px',
                        background: 'white'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .preview-input:focus {
          outline: none;
          border-color: ${COLOR_BLUE};
          box-shadow: 0 0 0 3px ${COLOR_BLUE}20;
        }
      `}</style>
    </div>
  );
}