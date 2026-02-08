"use client";
import React, { useEffect, useState } from 'react';

type AutoPromotion = {
  id?: string;
  business_id?: string;
  business_name?: string;
  title: string;
  message: string;
  frequency_type: 'hourly' | 'daily' | 'custom';
  frequency_value: number; // Para hourly: veces por hora, para daily: veces por día, para custom: minutos
  is_active: boolean;
  start_time?: string; // HH:MM formato 24h
  end_time?: string; // HH:MM formato 24h
  days_of_week?: string; // JSON array como string ["1","2","3","4","5"] para Lunes-Viernes
  priority: number; // 1-10, mayor número = mayor prioridad
  created_at?: string;
  last_executed?: string;
};

type Business = {
  id: string;
  name: string;
  category: string;
};

export default function AutoPromotionsPage() {
  const [autoPromotions, setAutoPromotions] = useState<AutoPromotion[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AutoPromotion | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAutoPromotions();
    fetchBusinesses();
  }, []);

  const fetchAutoPromotions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auto-promotions');
      const json = await res.json();
      setAutoPromotions(json.promotions || []);
    } catch (e) {
      console.error(e);
      setAutoPromotions([]);
    }
    setLoading(false);
  };

  const fetchBusinesses = async () => {
    try {
      const res = await fetch('/api/admin/businesses');
      const json = await res.json();
      setBusinesses(json.businesses || []);
    } catch (e) {
      console.error(e);
      setBusinesses([]);
    }
  };

  const saveAutoPromotion = async (promotion: AutoPromotion) => {
    try {
      console.log('Sending promotion data:', promotion);
      const res = await fetch('/api/admin/auto-promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promotion)
      });
      
      const json = await res.json();
      console.log('API Response:', json);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${json.error || 'Error desconocido'}`);
      }
      
      if (json.error) {
        throw new Error(json.error);
      }
      
      setEditing(null);
      setShowForm(false);
      fetchAutoPromotions();
      alert('Promoción automática guardada correctamente');
    } catch (e) {
      console.error('Save error:', e);
      alert(`Error guardando la promoción automática: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    }
  };

  const deleteAutoPromotion = async (id?: string) => {
    if (!id) return;
    if (!confirm('¿Eliminar promoción automática?')) return;
    
    try {
      const res = await fetch(`/api/admin/auto-promotions?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      fetchAutoPromotions();
      alert('Promoción automática eliminada');
    } catch (e) {
      console.error(e);
      alert('Error eliminando promoción automática');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/auto-promotions/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !isActive })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      fetchAutoPromotions();
    } catch (e) {
      console.error(e);
      alert('Error actualizando estado');
    }
  };

  const testEmail = async (promotion: AutoPromotion) => {
    const testEmail = prompt('Ingresa el email de prueba:');
    if (!testEmail) return;

    try {
      const res = await fetch('/api/admin/auto-promotions/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promotion, testEmail })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      alert('Email de prueba enviado correctamente');
    } catch (e) {
      console.error(e);
      alert(`Error enviando email de prueba: ${e instanceof Error ? e.message : 'Error desconocido'}`);
    }
  };

  const getFrequencyText = (promotion: AutoPromotion) => {
    switch (promotion.frequency_type) {
      case 'hourly':
        return `${promotion.frequency_value} vez${promotion.frequency_value > 1 ? 'es' : ''} por hora`;
      case 'daily':
        return `${promotion.frequency_value} vez${promotion.frequency_value > 1 ? 'es' : ''} por día`;
      case 'custom':
        return `Cada ${promotion.frequency_value} minutos`;
      default:
        return 'No definida';
    }
  };

  const getDaysText = (daysJson?: string) => {
    if (!daysJson) return 'Todos los días';
    try {
      const days = JSON.parse(daysJson);
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days.map((d: string) => dayNames[parseInt(d)]).join(', ');
    } catch {
      return 'Todos los días';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0, color: '#1A3A6C' }}>🤖 Promociones Automáticas de Santi</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{
            background: '#F1C40F',
            color: '#000',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          + Nueva Promoción Automática
        </button>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          <div style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1A3A6C' }}>📊 Estadísticas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1A3A6C' }}>{autoPromotions.length}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Total Promociones</div>
              </div>
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27AE60' }}>{autoPromotions.filter(p => p.is_active).length}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Activas</div>
              </div>
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#E74C3C' }}>{autoPromotions.filter(p => !p.is_active).length}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Inactivas</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A3A6C', color: 'white' }}>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Negocio</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Mensaje</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Frecuencia</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Horario</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Días</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Prioridad</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {autoPromotions.map((promotion, index) => (
                  <tr key={promotion.id} style={{ borderBottom: '1px solid #eee', background: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 'bold' }}>{promotion.business_name || 'Sin negocio'}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{promotion.title}</div>
                    </td>
                    <td style={{ padding: '15px', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {promotion.message}
                      </div>
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px' }}>{getFrequencyText(promotion)}</td>
                    <td style={{ padding: '15px', fontSize: '14px' }}>
                      {promotion.start_time && promotion.end_time 
                        ? `${promotion.start_time} - ${promotion.end_time}`
                        : 'Todo el día'
                      }
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px' }}>{getDaysText(promotion.days_of_week)}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <span style={{
                        background: promotion.priority >= 8 ? '#E74C3C' : promotion.priority >= 5 ? '#F39C12' : '#27AE60',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {promotion.priority}
                      </span>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleActive(promotion.id!, promotion.is_active)}
                        style={{
                          background: promotion.is_active ? '#27AE60' : '#E74C3C',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '15px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {promotion.is_active ? '✓ Activa' : '✗ Inactiva'}
                      </button>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button
                        onClick={() => { setEditing(promotion); setShowForm(true); }}
                        style={{ background: '#3498DB', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteAutoPromotion(promotion.id)}
                        style={{ background: '#E74C3C', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {autoPromotions.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🤖</div>
                <p>No hay promociones automáticas configuradas</p>
                <p style={{ fontSize: '14px' }}>Crea la primera promoción para que Santi comience a mencionar tus lugares destacados</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Formulario Modal */}
      {showForm && <AutoPromotionForm 
        promotion={editing} 
        businesses={businesses}
        onSave={saveAutoPromotion} 
        onCancel={() => { setShowForm(false); setEditing(null); }} 
      />}
    </div>
  );
}

function AutoPromotionForm({ 
  promotion, 
  businesses, 
  onSave, 
  onCancel 
}: { 
  promotion: AutoPromotion | null; 
  businesses: Business[];
  onSave: (p: AutoPromotion) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState<AutoPromotion>({
    business_id: '',
    business_name: '',
    title: '',
    message: '',
    frequency_type: 'daily',
    frequency_value: 1,
    is_active: true,
    priority: 5,
    days_of_week: '[]',
    ...promotion
  });

  const handleBusinessChange = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    setFormData({
      ...formData,
      business_id: businessId,
      business_name: business?.name || ''
    });
  };

  const handleDaysChange = (day: string, checked: boolean) => {
    try {
      const currentDays = JSON.parse(formData.days_of_week || '[]');
      let newDays;
      if (checked) {
        newDays = [...currentDays, day].sort();
      } else {
        newDays = currentDays.filter((d: string) => d !== day);
      }
      setFormData({ ...formData, days_of_week: JSON.stringify(newDays) });
    } catch {
      setFormData({ ...formData, days_of_week: JSON.stringify(checked ? [day] : []) });
    }
  };

  const isDaySelected = (day: string) => {
    try {
      const days = JSON.parse(formData.days_of_week || '[]');
      return days.includes(day);
    } catch {
      return false;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#1A3A6C' }}>
          {promotion ? 'Editar' : 'Nueva'} Promoción Automática
        </h2>

        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }}>
          {/* Negocio */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Negocio/Lugar:</label>
            <select
              value={formData.business_id || ''}
              onChange={(e) => handleBusinessChange(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              required
            >
              <option value="">Seleccionar negocio...</option>
              {businesses.map(business => (
                <option key={business.id} value={business.id}>
                  {business.name} ({business.category})
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Título:</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Promoción especial del día"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              required
            />
          </div>

          {/* Mensaje */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Mensaje que dirá Santi:</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Ej: ¡Che! No te pierdas las empanadas especiales en La Cocina de la Abuela. ¡Están buenísimas!"
              rows={4}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
              required
            />
          </div>

          {/* Frecuencia */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tipo de frecuencia:</label>
            <select
              value={formData.frequency_type}
              onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value as 'hourly' | 'daily' | 'custom' })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="hourly">Por hora</option>
              <option value="daily">Por día</option>
              <option value="custom">Personalizado (minutos)</option>
            </select>
          </div>

          {/* Valor de frecuencia */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              {formData.frequency_type === 'hourly' ? 'Veces por hora:' :
               formData.frequency_type === 'daily' ? 'Veces por día:' :
               'Cada cuántos minutos:'}
            </label>
            <input
              type="number"
              min="1"
              max={formData.frequency_type === 'hourly' ? '60' : formData.frequency_type === 'daily' ? '24' : '1440'}
              value={formData.frequency_value}
              onChange={(e) => setFormData({ ...formData, frequency_value: parseInt(e.target.value) })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              required
            />
          </div>

          {/* Horario */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Horario (opcional):</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="time"
                value={formData.start_time || ''}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <span>a</span>
              <input
                type="time"
                value={formData.end_time || ''}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <small style={{ color: '#666' }}>Deja vacío para todo el día</small>
          </div>

          {/* Días de la semana */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Días de la semana:</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { value: '0', label: 'Dom' },
                { value: '1', label: 'Lun' },
                { value: '2', label: 'Mar' },
                { value: '3', label: 'Mié' },
                { value: '4', label: 'Jue' },
                { value: '5', label: 'Vie' },
                { value: '6', label: 'Sáb' }
              ].map(day => (
                <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isDaySelected(day.value)}
                    onChange={(e) => handleDaysChange(day.value, e.target.checked)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>

          {/* Prioridad */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Prioridad (1-10):</label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
              <span>1 (Baja)</span>
              <span style={{ fontWeight: 'bold', color: '#1A3A6C' }}>{formData.priority}</span>
              <span>10 (Alta)</span>
            </div>
          </div>

          {/* Estado */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span style={{ fontWeight: 'bold' }}>Activar promoción inmediatamente</span>
            </label>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ padding: '12px 24px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ 
                padding: '12px 24px', 
                background: '#F1C40F', 
                color: '#000', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Guardar Promoción
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => testEmail(editing)}
                style={{ 
                  padding: '12px 24px', 
                  background: '#28a745', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Enviar Email de Prueba
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}