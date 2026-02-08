"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const COLOR_BLUE = "#1A3A6C";
const COLOR_RED = "#9E1B1B";
const COLOR_GOLD = "#F1C40F";

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    html_content: string;
    category: string;
    created_at: string;
}

interface EmailContact {
    id: string;
    email: string;
    name: string;
    tags: string[];
    subscribed: boolean;
}

interface EmailCampaign {
    id: string;
    name: string;
    subject: string;
    status: string;
    total_recipients: number;
    sent_count: number;
    created_at: string;
}

export default function EmailManagement() {
    const [activeTab, setActiveTab] = useState<'templates' | 'contacts' | 'campaigns' | 'notifications'>('templates');
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [contacts, setContacts] = useState<EmailContact[]>([]);
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Editor de plantilla
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<Partial<EmailTemplate>>({
        name: '',
        subject: '',
        html_content: '',
        category: 'marketing'
    });
    const [uploadingImage, setUploadingImage] = useState(false);
    
    // Editor de contacto
    const [showContactEditor, setShowContactEditor] = useState(false);
    const [currentContact, setCurrentContact] = useState<Partial<EmailContact>>({
        email: '',
        name: '',
        tags: []
    });
    
    // Campaña
    const [showCampaignCreator, setShowCampaignCreator] = useState(false);
    const [selectedTemplateForCampaign, setSelectedTemplateForCampaign] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'templates') {
                const { data, error } = await supabase
                    .from('email_templates')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!error && data) setTemplates(data);
            } else if (activeTab === 'contacts') {
                const { data, error } = await supabase
                    .from('email_contacts')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!error && data) setContacts(data);
            } else if (activeTab === 'campaigns') {
                const { data, error } = await supabase
                    .from('email_campaigns')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!error && data) setCampaigns(data);
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const saveTemplate = async () => {
        if (!currentTemplate.name || !currentTemplate.subject || !currentTemplate.html_content) {
            alert('Por favor completa todos los campos');
            return;
        }

        try {
            if (currentTemplate.id) {
                // Actualizar
                const { error } = await supabase
                    .from('email_templates')
                    .update({
                        name: currentTemplate.name,
                        subject: currentTemplate.subject,
                        html_content: currentTemplate.html_content,
                        category: currentTemplate.category
                    })
                    .eq('id', currentTemplate.id);
                
                if (error) throw error;
            } else {
                // Crear nuevo
                const { error } = await supabase
                    .from('email_templates')
                    .insert([currentTemplate]);
                
                if (error) throw error;
            }

            alert('Plantilla guardada correctamente');
            setShowTemplateEditor(false);
            setCurrentTemplate({ name: '', subject: '', html_content: '', category: 'marketing' });
            loadData();
        } catch (error) {
            console.error('Error guardando plantilla:', error);
            alert('Error al guardar la plantilla');
        }
    };

    const saveContact = async () => {
        if (!currentContact.email) {
            alert('El email es requerido');
            return;
        }

        try {
            if (currentContact.id) {
                const { error } = await supabase
                    .from('email_contacts')
                    .update({
                        email: currentContact.email,
                        name: currentContact.name,
                        tags: currentContact.tags
                    })
                    .eq('id', currentContact.id);
                
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('email_contacts')
                    .insert([currentContact]);
                
                if (error) throw error;
            }

            alert('Contacto guardado correctamente');
            setShowContactEditor(false);
            setCurrentContact({ email: '', name: '', tags: [] });
            loadData();
        } catch (error) {
            console.error('Error guardando contacto:', error);
            alert('Error al guardar el contacto');
        }
    };

    const deleteTemplate = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

        try {
            const { error } = await supabase
                .from('email_templates')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            alert('Plantilla eliminada');
            loadData();
        } catch (error) {
            console.error('Error eliminando plantilla:', error);
            alert('Error al eliminar la plantilla');
        }
    };

    const deleteContact = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este contacto?')) return;

        try {
            const { error } = await supabase
                .from('email_contacts')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            alert('Contacto eliminado');
            loadData();
        } catch (error) {
            console.error('Error eliminando contacto:', error);
            alert('Error al eliminar el contacto');
        }
    };

    const sendCampaign = async (campaignData: { templateId: string; recipientType: string }) => {
        try {
            setLoading(true);
            const response = await fetch('/api/email/send-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campaignData)
            });

            const result = await response.json();
            if (result.success) {
                alert(`Campaña enviada a ${result.sent} contactos`);
                setShowCampaignCreator(false);
                loadData();
            } else {
                alert('Error al enviar campaña: ' + result.error);
            }
        } catch (error) {
            console.error('Error enviando campaña:', error);
            alert('Error al enviar la campaña');
        } finally {
            setLoading(false);
        }
    };

    const uploadImage = async (file: File) => {
        setUploadingImage(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `email-images/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('email-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('email-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Error subiendo imagen:', error);
            alert('Error al subir la imagen');
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const imageUrl = await uploadImage(file);
        if (imageUrl) {
            // Insertar la imagen en el contenido HTML
            const imageTag = `<img src="${imageUrl}" alt="Imagen" style="max-width: 100%; height: auto;" />`;
            setCurrentTemplate({
                ...currentTemplate,
                html_content: currentTemplate.html_content + imageTag
            });
        }
    };

    const sendTestEmail = async () => {
        if (!currentTemplate.subject || !currentTemplate.html_content) {
            alert('Por favor completa el asunto y contenido HTML');
            return;
        }

        const testEmail = prompt('Ingresa el email de prueba:');
        if (!testEmail) return;

        setLoading(true);
        try {
            const response = await fetch('/api/email/test-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testEmail,
                    subject: currentTemplate.subject,
                    html: currentTemplate.html_content,
                    templateVars: {
                        nombre: 'Usuario de Prueba',
                        email: testEmail,
                        app_url: window.location.origin
                    }
                })
            });

            if (response.ok) {
                alert('Email de prueba enviado exitosamente');
            } else {
                alert('Error al enviar email de prueba');
            }
        } catch (error) {
            console.error('Error enviando email de prueba:', error);
            alert('Error al enviar email de prueba');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
            <h1 style={{ color: COLOR_BLUE, marginBottom: '30px' }}>📧 Sistema de Email Marketing</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: `2px solid ${COLOR_BLUE}20` }}>
                {[
                    { key: 'templates', label: '📝 Plantillas', icon: '📝' },
                    { key: 'contacts', label: '👥 Contactos', icon: '👥' },
                    { key: 'campaigns', label: '📨 Campañas', icon: '📨' },
                    { key: 'notifications', label: '🔔 Notificaciones', icon: '🔔' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as typeof activeTab)}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            background: activeTab === tab.key ? COLOR_BLUE : 'transparent',
                            color: activeTab === tab.key ? 'white' : COLOR_BLUE,
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            borderRadius: '8px 8px 0 0',
                            transition: 'all 0.3s'
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h2 style={{ color: COLOR_BLUE }}>Plantillas de Email</h2>
                        <button
                            onClick={() => {
                                setCurrentTemplate({ name: '', subject: '', html_content: '', category: 'marketing' });
                                setShowTemplateEditor(true);
                            }}
                            style={{
                                padding: '12px 24px',
                                background: COLOR_RED,
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            + Nueva Plantilla
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {templates.map(template => (
                            <div key={template.id} style={{
                                background: 'white',
                                border: `2px solid ${COLOR_BLUE}20`,
                                borderRadius: '12px',
                                padding: '20px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    background: COLOR_GOLD,
                                    color: COLOR_BLUE,
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    marginBottom: '12px'
                                }}>
                                    {template.category}
                                </div>
                                <h3 style={{ color: COLOR_BLUE, margin: '0 0 10px 0' }}>{template.name}</h3>
                                <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>{template.subject}</p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => {
                                            setCurrentTemplate({
                                                ...template,
                                                category: template.category || 'marketing'
                                            });
                                            setShowTemplateEditor(true);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: COLOR_BLUE,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => deleteTemplate(template.id)}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: COLOR_RED,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h2 style={{ color: COLOR_BLUE }}>Lista de Contactos</h2>
                        <button
                            onClick={() => {
                                setCurrentContact({ email: '', name: '', tags: [] });
                                setShowContactEditor(true);
                            }}
                            style={{
                                padding: '12px 24px',
                                background: COLOR_RED,
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            + Agregar Contacto
                        </button>
                    </div>

                    <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: COLOR_BLUE, color: 'white' }}>
                                    <th style={{ padding: '15px', textAlign: 'left' }}>Email</th>
                                    <th style={{ padding: '15px', textAlign: 'left' }}>Nombre</th>
                                    <th style={{ padding: '15px', textAlign: 'left' }}>Tags</th>
                                    <th style={{ padding: '15px', textAlign: 'center' }}>Estado</th>
                                    <th style={{ padding: '15px', textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contacts.map((contact) => (
                                    <tr key={contact.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '15px' }}>{contact.email}</td>
                                        <td style={{ padding: '15px' }}>{contact.name || '-'}</td>
                                        <td style={{ padding: '15px' }}>
                                            {contact.tags?.map(tag => (
                                                <span key={tag} style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    background: COLOR_GOLD,
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    marginRight: '5px'
                                                }}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                background: contact.subscribed ? '#4ade80' : '#ef4444',
                                                color: 'white',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {contact.subscribed ? 'Suscrito' : 'Desuscrito'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => {
                                                    setCurrentContact(contact);
                                                    setShowContactEditor(true);
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: COLOR_BLUE,
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    marginRight: '8px'
                                                }}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => deleteContact(contact.id)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: COLOR_RED,
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h2 style={{ color: COLOR_BLUE }}>Campañas de Email</h2>
                        <button
                            onClick={() => setShowCampaignCreator(true)}
                            style={{
                                padding: '12px 24px',
                                background: COLOR_RED,
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            + Nueva Campaña
                        </button>
                    </div>

                    <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: COLOR_BLUE, color: 'white' }}>
                                    <th style={{ padding: '15px', textAlign: 'left' }}>Nombre</th>
                                    <th style={{ padding: '15px', textAlign: 'left' }}>Asunto</th>
                                    <th style={{ padding: '15px', textAlign: 'center' }}>Estado</th>
                                    <th style={{ padding: '15px', textAlign: 'center' }}>Enviados</th>
                                    <th style={{ padding: '15px', textAlign: 'left' }}>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map(campaign => (
                                    <tr key={campaign.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '15px' }}>{campaign.name}</td>
                                        <td style={{ padding: '15px' }}>{campaign.subject}</td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                background: campaign.status === 'sent' ? '#4ade80' : 
                                                           campaign.status === 'sending' ? COLOR_GOLD : '#94a3b8',
                                                color: 'white',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {campaign.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            {campaign.sent_count} / {campaign.total_recipients}
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            {new Date(campaign.created_at).toLocaleDateString('es-AR')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div>
                    <h2 style={{ color: COLOR_BLUE, marginBottom: '20px' }}>Notificaciones Automáticas</h2>
                    <p style={{ color: '#666', marginBottom: '30px' }}>
                        Configura las notificaciones automáticas que se enviarán cuando ocurran eventos específicos en la app.
                    </p>
                    
                    <div style={{ display: 'grid', gap: '20px' }}>
                        {[
                            { event: 'welcome', name: 'Bienvenida', desc: 'Email de bienvenida al registrarse' },
                            { event: 'new_business', name: 'Nuevo Negocio', desc: 'Notificar cuando se registra un nuevo negocio' },
                            { event: 'new_feature', name: 'Nueva Función', desc: 'Anunciar nuevas funcionalidades de la app' },
                            { event: 'new_story', name: 'Nuevo Relato', desc: 'Notificar sobre nuevos relatos creados' },
                            { event: 'reminder', name: 'Recordatorios', desc: 'Enviar recordatorios programados' }
                        ].map(notif => (
                            <div key={notif.event} style={{
                                background: 'white',
                                border: `2px solid ${COLOR_BLUE}20`,
                                borderRadius: '12px',
                                padding: '24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h3 style={{ color: COLOR_BLUE, margin: '0 0 8px 0' }}>{notif.name}</h3>
                                    <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>{notif.desc}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                        <input type="checkbox" defaultChecked style={{ marginRight: '8px' }} />
                                        <span style={{ color: COLOR_BLUE, fontWeight: 'bold' }}>Activado</span>
                                    </label>
                                    <button style={{
                                        padding: '8px 16px',
                                        background: COLOR_BLUE,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}>
                                        Configurar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Template Editor Modal */}
            {showTemplateEditor && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '30px',
                        maxWidth: '900px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }}>
                        <h2 style={{ color: COLOR_BLUE, marginBottom: '20px' }}>
                            {currentTemplate.id ? 'Editar Plantilla' : 'Nueva Plantilla'}
                        </h2>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Nombre de la Plantilla
                            </label>
                            <input
                                type="text"
                                value={currentTemplate.name}
                                onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                                placeholder="Ej: Bienvenida Usuarios"
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Asunto del Email
                            </label>
                            <input
                                type="text"
                                value={currentTemplate.subject}
                                onChange={(e) => setCurrentTemplate({ ...currentTemplate, subject: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                                placeholder="Ej: ¡Bienvenido a SantiGuía!"
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Categoría
                            </label>
                            <select
                                value={currentTemplate.category || 'marketing'}
                                onChange={(e) => setCurrentTemplate({ ...currentTemplate, category: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                            >
                                <option value="marketing">Marketing</option>
                                <option value="transactional">Transaccional</option>
                                <option value="notification">Notificación</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Contenido HTML
                            </label>
                            <textarea
                                value={currentTemplate.html_content}
                                onChange={(e) => setCurrentTemplate({ ...currentTemplate, html_content: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontFamily: 'monospace',
                                    minHeight: '300px'
                                }}
                                placeholder="<html>...</html>"
                            />
                            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                                Variables disponibles: {'{'}{'{'} nombre {'}'}{'}'},  {'{'}{'{'} email {'}'}{'}'}, {'{'}{'{'} app_url {'}'}{'}'}
                            </p>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Subir Imagen
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploadingImage}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '14px'
                                }}
                            />
                            {uploadingImage && <p style={{ fontSize: '12px', color: COLOR_BLUE, marginTop: '8px' }}>Subiendo imagen...</p>}
                            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                                Las imágenes se subirán automáticamente y se insertarán en el contenido HTML
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowTemplateEditor(false)}
                                style={{
                                    padding: '12px 24px',
                                    background: '#94a3b8',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={sendTestEmail}
                                disabled={loading}
                                style={{
                                    padding: '12px 24px',
                                    background: COLOR_GOLD,
                                    color: COLOR_BLUE,
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {loading ? 'Enviando...' : '📧 Enviar Prueba'}
                            </button>
                            <button
                                onClick={saveTemplate}
                                style={{
                                    padding: '12px 24px',
                                    background: COLOR_BLUE,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Guardar Plantilla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Editor Modal */}
            {showContactEditor && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '30px',
                        maxWidth: '600px',
                        width: '100%'
                    }}>
                        <h2 style={{ color: COLOR_BLUE, marginBottom: '20px' }}>
                            {currentContact.id ? 'Editar Contacto' : 'Nuevo Contacto'}
                        </h2>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Email *
                            </label>
                            <input
                                type="email"
                                value={currentContact.email}
                                onChange={(e) => setCurrentContact({ ...currentContact, email: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                                placeholder="email@ejemplo.com"
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={currentContact.name}
                                onChange={(e) => setCurrentContact({ ...currentContact, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                                placeholder="Nombre Apellido"
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Tags (separados por coma)
                            </label>
                            <input
                                type="text"
                                value={currentContact.tags?.join(', ')}
                                onChange={(e) => setCurrentContact({ 
                                    ...currentContact, 
                                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
                                })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                                placeholder="turista, vip, local"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowContactEditor(false)}
                                style={{
                                    padding: '12px 24px',
                                    background: '#94a3b8',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveContact}
                                style={{
                                    padding: '12px 24px',
                                    background: COLOR_BLUE,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Guardar Contacto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Creator Modal */}
            {showCampaignCreator && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '30px',
                        maxWidth: '600px',
                        width: '100%'
                    }}>
                        <h2 style={{ color: COLOR_BLUE, marginBottom: '20px' }}>Nueva Campaña</h2>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Seleccionar Plantilla
                            </label>
                            <select
                                value={selectedTemplateForCampaign}
                                onChange={(e) => setSelectedTemplateForCampaign(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                            >
                                <option value="">Selecciona una plantilla...</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                Destinatarios
                            </label>
                            <select
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    border: `2px solid ${COLOR_BLUE}20`,
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}
                            >
                                <option>Todos los contactos suscritos</option>
                                <option>Solo turistas</option>
                                <option>Solo negocios</option>
                                <option>Contactos VIP</option>
                            </select>
                        </div>

                        <div style={{ 
                            background: `${COLOR_BLUE}10`,
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '20px'
                        }}>
                            <p style={{ margin: 0, color: COLOR_BLUE, fontSize: '14px' }}>
                                ℹ️ Se enviará a aproximadamente {contacts.filter(c => c.subscribed).length} contactos
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowCampaignCreator(false)}
                                style={{
                                    padding: '12px 24px',
                                    background: '#94a3b8',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedTemplateForCampaign) {
                                        alert('Selecciona una plantilla');
                                        return;
                                    }
                                    sendCampaign({ 
                                        templateId: selectedTemplateForCampaign,
                                        recipientType: 'all'
                                    });
                                }}
                                disabled={loading}
                                style={{
                                    padding: '12px 24px',
                                    background: COLOR_RED,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                {loading ? 'Enviando...' : 'Enviar Campaña'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
