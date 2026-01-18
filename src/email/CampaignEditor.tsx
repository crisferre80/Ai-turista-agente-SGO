"use client";
import React, { useEffect, useState } from 'react';

export default function CampaignEditor({ campaignId, onClose, onSaved }: { campaignId?: string; onClose: () => void; onSaved: () => void }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [sendNow, setSendNow] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/email/templates');
        const json = await res.json();
        if (json.ok) setTemplates(json.templates || []);
      } catch { }
    })();
  }, []);

  const save = async () => {
    if (!name || !templateId) return alert('Nombre y plantilla son obligatorios');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, template_id: templateId, sendNow }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error creating campaign');
      onSaved();
    } catch (err) {
      alert('Error creando campaña: ' + String(err));
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
      <div style={{ width: '100%', maxWidth: 720, background: 'white', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>{campaignId ? 'Editar Campaña' : 'Nueva Campaña'}</h3>

        <div style={{ display: 'grid', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la campaña" style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}>
            <option value="">-- Selecciona plantilla --</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} /> Enviar ahora</label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 12px' }}>Cerrar</button>
          <button onClick={save} disabled={loading} style={{ padding: '8px 12px', background: '#0e1f1d', color: '#fff' }}>{loading ? 'Creando...' : (campaignId ? 'Guardar' : 'Crear y enviar')}</button>
        </div>
      </div>
    </div>
  );
}
