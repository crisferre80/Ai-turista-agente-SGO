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

  useEffect(() => { void fetchAll(); }, []);

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>📧 Email Manager</h3>
      <p style={{ color: '#6b7280' }}>Administra plantillas y campañas (integración con OneSignal).</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => setOpenCampaignId('new')} style={{ padding: '8px 12px', borderRadius: 8 }}>Nueva campaña</button>
        <button onClick={() => setOpenTemplateId('new')} style={{ padding: '8px 12px', borderRadius: 8 }}>Nueva plantilla</button>
        <button onClick={() => void fetchAll()} style={{ padding: '8px 12px', borderRadius: 8 }}>Refrescar</button>
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <div>
          <h4>Plantillas</h4>
          {loading ? <div>Cargando...</div> : (
            templates.length ? (
              <ul>
                {templates.map(t => (
                  <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                    <div>
                      <strong>{t.name}</strong>
                      <div style={{ color: '#666' }}>{t.subject}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
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
                  <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                    <div>
                      <strong>{c.name}</strong>
                      <div style={{ color: '#666' }}>Estado: {c.status || 'unknown'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
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
