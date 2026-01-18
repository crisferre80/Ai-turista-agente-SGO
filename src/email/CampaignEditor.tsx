"use client";
import React from 'react';

export default function CampaignEditor({ campaignId, onClose, onSaved }: { campaignId?: string; onClose: () => void; onSaved: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
      <div style={{ width: '100%', maxWidth: 720, background: 'white', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>{campaignId ? 'Editar Campaña' : 'Nueva Campaña'}</h3>
        <p style={{ color: '#666' }}>Editor simple (placeholder). Implementa más campos aquí según necesites.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 12px' }}>Cerrar</button>
          <button onClick={() => { onSaved(); }} style={{ padding: '8px 12px', background: '#0e1f1d', color: '#fff' }}>{campaignId ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </div>
  );
}
