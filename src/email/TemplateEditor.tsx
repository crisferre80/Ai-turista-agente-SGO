"use client";
import React, { useEffect, useState } from 'react';

export default function TemplateEditor({ templateId, onClose, onSaved }: { templateId?: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/email/templates');
        const json = await res.json();
        if (json.ok && Array.isArray(json.templates)) {
          const t = json.templates.find((x: any) => x.id === templateId);
          if (t) {
            setName(t.name || '');
            setSubject(t.subject || '');
            setHtml(t.html || '');
          }
        }
      } catch { /* ignore */ }
    })();
  }, [templateId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/email/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: templateId, name, subject, html }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error saving');
      onSaved();
    } catch (err) {
      alert('Error guardando plantilla: ' + String(err));
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
      <div style={{ width: '100%', maxWidth: 720, background: 'white', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>{templateId ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto" style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
          <textarea value={html} onChange={e => setHtml(e.target.value)} placeholder="HTML del email" rows={10} style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 12px' }}>Cerrar</button>
          <button onClick={save} disabled={saving} style={{ padding: '8px 12px', background: '#0e1f1d', color: '#fff' }}>{saving ? 'Guardando...' : (templateId ? 'Guardar' : 'Crear')}</button>
        </div>
      </div>
    </div>
  );
}
