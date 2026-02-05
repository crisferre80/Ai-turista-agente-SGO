"use client";
import React, { useEffect, useState } from 'react';
import CampaignEditor from './CampaignEditor';
import TemplateEditor from './TemplateEditor';

export default function EmailManager() {
  const [openCampaignId, setOpenCampaignId] = useState<string | undefined>(undefined);
  const [openTemplateId, setOpenTemplateId] = useState<string | undefined>(undefined);
  const [templates, setTemplates] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const tRes = await fetch('/api/admin/email/templates');
      const tJson = await tRes.json();
      if (tJson.ok) setTemplates(tJson.templates || []);

      const cRes = await fetch('/api/admin/email/campaigns');
      const cJson = await cRes.json();
      if (cJson.ok) setCampaigns(cJson.campaigns || []);
    } catch (err) {
      console.error('Error fetching email data', err);
    }
    setLoading(false);
  };

  const [contacts, setContacts] = useState<Array<{id?: string; name?: string; email?: string; source?: string}>>([]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [opLoading, setOpLoading] = useState(false);
  const [contactError, setContactError] = useState<string | undefined>(undefined);


  const fetchContacts = async () => {
    setOpLoading(true);
    try {
      const res = await fetch('/api/admin/email/contacts');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        console.error('Failed to fetch contacts:', json || { status: res.status });
        setContacts([]);
        const errBody = json?.error ? (typeof json.error === 'string' ? json.error : JSON.stringify(json.error)) : `Server error ${res.status}`;
        setContactError(errBody);
        return;
      }

      if (json?.ok) {
        // deduplicate just in case, normalize emails
        const map = new Map<string, { id?: string; name?: string; email?: string; source?: string }>();
        (json.contacts || []).forEach((c: any) => {
          if (!c?.email) return;
          const key = String(c.email).toLowerCase();
          if (!map.has(key)) map.set(key, c);
        });
        setContacts(Array.from(map.values()));
        setContactError(undefined);
      } else {
        console.error('Failed to fetch contacts (bad body):', json);
        setContactError('Failed to fetch contacts');
        setContacts([]);
      }
    } catch (err) {
      console.error('fetch contacts', err);
      setContactError(String(err));
      setContacts([]);
    } finally {
      setOpLoading(false);
    }
  };

  const addContact = async () => {
    if (!contactEmail) return alert('Email es requerido');
    setOpLoading(true);
    try {
      const res = await fetch('/api/admin/email/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: contactName, email: contactEmail }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error adding contact');
      setContactName(''); setContactEmail('');
      await fetchContacts();
    } catch (err) { alert('Error añadiendo contacto: ' + String(err)); }
    setOpLoading(false);
  };

  const removeContact = async (id?: string) => {
    if (!id) return;
    if (!confirm('¿Eliminar contacto?')) return;
    setOpLoading(true);
    try {
      const res = await fetch('/api/admin/email/contacts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error deleting');
      await fetchContacts();
    } catch (err) { alert('Error eliminando contacto: ' + String(err)); }
    setOpLoading(false);
  };

  const seedTemplates = async () => {
    if (!confirm('Cargar plantillas de ejemplo (solo en desarrollo)?')) return;
    try {
      const res = await fetch('/api/admin/email/seed-templates', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error seeding');
      alert('Plantillas de ejemplo creadas');
      void fetchAll();
    } catch (err) { alert('Error: ' + String(err)); }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>📧 Email Manager</h3>
      <p style={{ color: '#6b7280' }}>Administra plantillas y campañas de email con Gmail API.</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => setOpenCampaignId('new')} style={{ padding: '8px 12px', borderRadius: 8 }}>Nueva campaña</button>
        <button onClick={() => setOpenTemplateId('new')} style={{ padding: '8px 12px', borderRadius: 8 }}>Nueva plantilla</button>
        <button onClick={() => void fetchAll()} style={{ padding: '8px 12px', borderRadius: 8 }}>Refrescar</button>
        <button onClick={seedTemplates} style={{ padding: '8px 12px', borderRadius: 8 }}>Cargar plantillas de ejemplo</button>
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <div>
          <h4>Contactos</h4>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="Nombre (opcional)" value={contactName} onChange={e => setContactName(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
            <input placeholder="email@example.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
            <button onClick={addContact} disabled={opLoading} style={{ padding: '8px 12px' }}>{opLoading ? 'Guardando...' : 'Añadir'}</button>
            <button onClick={() => void fetchContacts()} style={{ padding: '8px 12px' }}>Refrescar</button>
          </div>
          {contactError ? (
            <div style={{ color: '#ff6b6b', marginBottom: 8 }}>Error cargando contactos: {contactError}</div>
          ) : null}

          {contacts.length ? (
            <ul>
              {contacts.map(c => (
                <li key={c.id} className="list-item">
                  <div className="item-main">
                    <strong>{c.name || c.email}</strong>
                    <div style={{ color: '#666' }}>{c.email} {c.source ? <span style={{ color: '#999', marginLeft: 8 }}>({c.source})</span> : null}</div>
                  </div>
                  <div style={{ marginLeft: 8 }}>
                    <button onClick={() => removeContact(c.id)} style={{ padding: '6px 8px' }}>Eliminar</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div style={{ color: '#666' }}>Sin contactos</div>}
        </div>

        <div>
          <h4>Plantillas</h4>
          {loading ? <div>Cargando...</div> : (
            templates.length ? (
              <ul>
                {templates.map(t => (
                  <li key={t.id} className="list-item">
                    <div className="item-main">
                      <strong>{t.name}</strong>
                      <div style={{ color: '#666' }}>{t.subject}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                      <button onClick={() => setOpenTemplateId(t.id)} style={{ padding: '6px 8px' }}>Editar</button>
                      <button onClick={() => { navigator.clipboard?.writeText(t.html || '') }} style={{ padding: '6px 8px' }}>Copiar HTML</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <div style={{ color: '#666' }}>Sin plantillas</div>
          )}
        </div>

        <div>
          <h4>Campañas</h4>
          {loading ? <div>Cargando...</div> : (
            campaigns.length ? (
              <ul>
                {campaigns.map(c => (
                  <li key={c.id} className="list-item">
                    <div className="item-main">
                      <strong>{c.name}</strong>
                      <div style={{ color: '#666' }}>Estado: {c.status || 'unknown'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                      <button onClick={async () => {
                        try {
                          const res = await fetch('/api/admin/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: c.id }) });
                          const json = await res.json();
                          if (!json.ok) throw new Error(json.error || 'Error sending');
                          alert('Enviado correctamente');
                          void fetchAll();
                        } catch (err) {
                          alert('Error enviando: ' + String(err));
                        }
                      }} style={{ padding: '6px 8px' }}>Enviar ahora</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <div style={{ color: '#666' }}>Sin campañas</div>
          )}
        </div>
      </div>

      {openCampaignId && (
        <CampaignEditor
          campaignId={openCampaignId === 'new' ? undefined : openCampaignId}
          onClose={() => setOpenCampaignId(undefined)}
          onSaved={() => { setOpenCampaignId(undefined); void fetchAll(); }}
        />
      )}

      {openTemplateId && (
        <TemplateEditor
          templateId={openTemplateId === 'new' ? undefined : openTemplateId}
          onClose={() => setOpenTemplateId(undefined)}
          onSaved={() => { setOpenTemplateId(undefined); void fetchAll(); }}
        />
      )}
    </div>
  );
}
