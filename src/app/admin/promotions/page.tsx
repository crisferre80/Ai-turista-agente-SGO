"use client";
import React, { useEffect, useState } from 'react';

type Promo = {
  id?: string;
  place_id?: string;
  title?: string;
  description?: string;
  image_url?: string;
  terms?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
};

export default function AdminPromotionsPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Promo | null>(null);

  useEffect(() => { fetchPromos(); }, []);

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/promotions');
      const json = await res.json();
      setPromos(json.promotions || []);
    } catch (e) { console.error(e); setPromos([]); }
    setLoading(false);
  };

  const savePromo = async (p: Promo) => {
    try {
      const res = await fetch('/api/admin/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setEditing(null);
      fetchPromos();
    } catch (e) { console.error(e); alert('Error guardando la promoción'); }
  };

  const deletePromo = async (id?: string) => {
    if (!id) return;
    if (!confirm('Eliminar promoción?')) return;
    try {
      const res = await fetch(`/api/admin/promotions?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      fetchPromos();
    } catch (e) { console.error(e); alert('Error eliminando'); }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Promociones</h2>
      <p>Gestiona promociones para lugares y negocios.</p>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setEditing({ is_active: true })} style={{ padding: '8px 12px', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: 8 }}>Nueva Promoción</button>
      </div>

      {editing && (
        <div style={{ background: 'white', padding: 12, borderRadius: 12, marginBottom: 12 }}>
          <label>Título</label>
          <input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={{ width: '100%', padding: 8, margin: '6px 0' }} />
          <label>Descripción</label>
          <textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} style={{ width: '100%', padding: 8, margin: '6px 0' }} />
          <label>Place ID (opcional)</label>
          <input value={editing.place_id || ''} onChange={(e) => setEditing({ ...editing, place_id: e.target.value })} style={{ width: '100%', padding: 8, margin: '6px 0' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => savePromo(editing)} style={{ padding: '8px 12px', background: '#14b8a6', color: 'white', border: 'none', borderRadius: 8 }}>Guardar</button>
            <button onClick={() => setEditing(null)} style={{ padding: '8px 12px', background: '#eee', border: 'none', borderRadius: 8 }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div>Cargando...</div> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {promos.map(p => (
            <div key={p.id} style={{ background: 'white', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{p.title}</div>
                <div style={{ color: '#666' }}>{p.description}</div>
                <div style={{ fontSize: 12, color: '#999' }}>Place: {p.place_id || 'global'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(p)} style={{ padding: '6px 8px' }}>Editar</button>
                <button onClick={() => deletePromo(p.id)} style={{ padding: '6px 8px' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}