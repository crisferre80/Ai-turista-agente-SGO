'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Save, Trash2, Navigation, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PositionedObject {
  id: string;
  attraction_id: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  label: string;
  model_url?: string;
  created_at: string;
}

interface GPSObjectPositionerProps {
  attractionId: string;
  attractionName: string;
  modelUrl?: string;
}

/**
 * Componente para posicionar objetos AR en coordenadas GPS específicas
 * Usa mapa interactivo para colocar marcadores
 */
export default function GPSObjectPositioner({
  attractionId,
  attractionName,
  modelUrl
}: GPSObjectPositionerProps) {
  const [positions, setPositions] = useState<PositionedObject[]>([]);
  // Default center: Santiago del Estero, ARG
  const [selectedLat, setSelectedLat] = useState<number>(-27.7834);
  const [selectedLng, setSelectedLng] = useState<number>(-64.2599);
  const [altitude, setAltitude] = useState<number>(0);
  const [label, setLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // mapReady removed (no map initialization required for iframe embed)

  // Cargar posiciones existentes
  const loadPositions = useCallback(async () => {
    const { data, error } = await supabase
      .from('ar_positioned_objects')
      .select('*')
      .eq('attraction_id', attractionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando posiciones:', error);
    } else {
      console.log('✅ Posiciones cargadas desde DB:', (data || []).length);
      console.log(data);
      setPositions(data || []);
    }
  }, [attractionId]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  // Mapbox setup
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [nearbyAttractions, setNearbyAttractions] = useState<Array<{id: string; name: string; latitude: number; longitude: number}>>([]);

  const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();

  // Initialize Mapbox map
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (mapRef.current) return;
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current as HTMLElement,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [selectedLng, selectedLat],
        zoom: 13
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');

      // On click add temporary marker coords to form
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        setSelectedLat(lat);
        setSelectedLng(lng);
        // place temporary marker
        try {
          if (tempMarkerRef.current) tempMarkerRef.current.remove();
          const elTemp = document.createElement('div');
          elTemp.style.width = '24px';
          elTemp.style.height = '24px';
          elTemp.style.borderRadius = '50%';
          elTemp.style.background = '#ffb020';
          elTemp.style.border = '3px solid white';
          tempMarkerRef.current = new mapboxgl.Marker({ element: elTemp })
            .setLngLat([lng, lat])
            .addTo(map);
        } catch (err) { console.error('temp marker error', err); }
      });

      mapRef.current = map;
      setMapReady(true);
    } catch (err) {
      console.error('Error initializing Mapbox in GPSObjectPositioner:', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [MAPBOX_TOKEN, selectedLat, selectedLng]);

  // Sync markers when positions change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    console.log('🔁 Actualizando marcadores en mapa, posiciones:', positions.length);
    positions.forEach(pos => {
      try {
        const el = document.createElement('div');
        el.className = 'rounded-full border-2 border-white shadow-lg';
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.background = '#7c3aed';

        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat([pos.longitude, pos.latitude])
          .addTo(map);

        marker.getElement().addEventListener('click', () => {
          loadPositionToForm(pos);
        });

        marker.on('dragend', async () => {
          const lngLat = marker.getLngLat();
          try {
            // Use server API to avoid RLS issues
            const res = await fetch('/api/ar-position', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: pos.id, latitude: lngLat.lat, longitude: lngLat.lng })
            });
            if (!res.ok) throw new Error('failed_update');
            // Update local state
            setPositions(prev => prev.map(p => p.id === pos.id ? { ...p, latitude: lngLat.lat, longitude: lngLat.lng } : p));
          } catch (err) {
            console.error('Error updating position after drag:', err);
            alert('Error actualizando posición en la base de datos');
          }
        });

        markersRef.current[pos.id] = marker;
        } catch {
        // ignore marker errors
      }
    });

    // Optionally fit bounds to markers
    if (positions.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      positions.forEach(p => bounds.extend([p.longitude, p.latitude]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
    } else {
      map.flyTo({ center: [selectedLng, selectedLat], zoom: 13, duration: 800 });
    }

  }, [positions, selectedLat, selectedLng]);

  // When map is ready, also load attractions with coords to show as blue markers
  const loadAttractionsWithCoords = useCallback(async () => {
    try {
      // Intentar seleccionar lat/lng (forma más probable en esta BD)
      let data: Array<Record<string, unknown>> | null = null;
      let error: { code?: string; message?: string } | null = null;

      const resp1 = await supabase.from('attractions').select('id, name, lat, lng');
      data = resp1.data as Array<Record<string, unknown>> | null;
      error = resp1.error as { code?: string; message?: string } | null;

      // Si falla por columnas inexistentes, intentar variantes alternativas
      if (error && error.code === '42703') {
        console.warn('Columna lat/lng no encontrada, intentando latitude/longitude...');
        const resp2 = await supabase.from('attractions').select('id, name, latitude, longitude');
        data = resp2.data as Array<Record<string, unknown>> | null;
        error = resp2.error as { code?: string; message?: string } | null;
      }

      if (error) {
        console.error('Error cargando atractivos con coordenadas:', error);
        return;
      }

      const list = (data || []).map((d) => {
        const latVal = (d['lat'] ?? d['latitude'] ?? null) as string | number | null;
        const lngVal = (d['lng'] ?? d['longitude'] ?? null) as string | number | null;
        return latVal != null && lngVal != null ? {
          id: String(d['id']),
          name: String(d['name'] ?? ''),
          latitude: parseFloat(String(latVal)),
          longitude: parseFloat(String(lngVal))
        } : null;
      }).filter(Boolean) as Array<{id:string;name:string;latitude:number;longitude:number}>;

      setNearbyAttractions(list);
      console.log('✅ Atractivos con coords cargados:', list.length, list);
      console.log(list);
    } catch (e) {
      console.error('Excepción cargando atractivos con coords:', e);
    }
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    loadAttractionsWithCoords();
    // ensure positions are re-synced when map becomes ready
    // trigger re-render by setting positions to same value
    setPositions(prev => [...prev]);
  }, [mapReady, loadAttractionsWithCoords]);

  // Render attractions markers when nearbyAttractions change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Add blue markers for attractions
    (nearbyAttractions || []).forEach(attr => {
      const key = `a_${attr.id}`;
      // skip if marker already exists
      if (markersRef.current[key]) return;
      try {
        const el = document.createElement('div');
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.background = '#2563eb';
        el.style.border = '3px solid white';

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([attr.longitude, attr.latitude])
          .addTo(map);

        marker.getElement().addEventListener('click', () => {
          // center & load attraction into form
          setSelectedLat(attr.latitude);
          setSelectedLng(attr.longitude);
          // load attraction coordinates into form as a convenience
          setLabel(attr.name);
        });

        markersRef.current[key] = marker;
      } catch (err) {
        console.error('Error creando marcador de attraction:', err);
      }
    });
  }, [nearbyAttractions, mapReady]);

  // Obtener ubicación actual del usuario
  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSelectedLat(position.coords.latitude);
          setSelectedLng(position.coords.longitude);
          if (position.coords.altitude) {
            setAltitude(position.coords.altitude);
          }
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
          alert('No se pudo obtener tu ubicación actual');
        }
      );
    } else {
      alert('Geolocalización no disponible en este navegador');
    }
  };

  // Buscar ubicación por nombre (usando Nominatim de OpenStreetMap)
  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    try {
      if (MAPBOX_TOKEN) {
        const q = encodeURIComponent(searchQuery);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Mapbox Geocoding error: ${res.status}`);
        const json = await res.json();
        if (json.features && json.features.length > 0) {
          const feat = json.features[0];
          const [lng, lat] = feat.center;
          setSelectedLat(Number(lat));
          setSelectedLng(Number(lng));
          alert(`📍 Encontrado: ${feat.place_name}`);
        } else {
          alert('No se encontraron resultados');
        }
      } else {
        // Fallback a Nominatim si no hay token de Mapbox
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
          { headers: { 'Accept': 'application/json' } }
        );
        const data = await response.json();
        if (data.length > 0) {
          setSelectedLat(parseFloat(data[0].lat));
          setSelectedLng(parseFloat(data[0].lon));
          alert(`📍 Encontrado: ${data[0].display_name}`);
        } else {
          alert('No se encontraron resultados');
        }
      }
    } catch (error) {
      console.error('Error buscando ubicación:', error);
      alert('Error al buscar el lugar');
    }
  };

  // Guardar nueva posición
  const savePosition = async () => {
    if (!label.trim()) {
      alert('Ingresa una etiqueta para identificar esta posición');
      return;
    }

    setLoading(true);
    try {
      // Call server-side endpoint to create position (uses service role)
      const res = await fetch('/api/ar-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attraction_id: attractionId,
          latitude: selectedLat,
          longitude: selectedLng,
          altitude: altitude,
          label: label.trim(),
          model_url: modelUrl || null
        })
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'server_error');
      }

      // Recargar posiciones desde la BD para obtener la fila insertada
      await loadPositions();
      setLabel('');
      alert('✅ Posición guardada correctamente');
    } catch (error) {
      console.error('Error guardando posición:', error);
      // Mostrar mensaje específico si es problema de permisos (RLS)
      const supErr = error as unknown as { code?: string; message?: string };
      if (supErr?.code === '42501' || (supErr?.message || '').includes('permission')) {
        alert('Error al guardar: permisos insuficientes en la base de datos. Revisa las políticas RLS de Supabase para la tabla ar_positioned_objects.');
      } else {
        alert('Error al guardar: ' + (error as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Eliminar posición
  const deletePosition = async (id: string) => {
    if (!confirm('¿Eliminar esta posición?')) return;

    try {
      const res = await fetch(`/api/ar-position?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');

      // Remove marker from map if exists
      if (markersRef.current[id]) {
        try { markersRef.current[id].remove(); } catch {}
        delete markersRef.current[id];
      }
      setPositions(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error eliminando posición:', error);
      alert('Error al eliminar');
    }
  };

  // Cargar posición en el formulario
  const loadPositionToForm = (pos: PositionedObject) => {
    setSelectedLat(pos.latitude);
    setSelectedLng(pos.longitude);
    setAltitude(pos.altitude || 0);
    setLabel(pos.label);
  };

  return (
    <div className="space-y-6">
      {!MAPBOX_TOKEN && (
        <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
          <strong>Token de Mapbox no configurado.</strong> Por favor agrega `NEXT_PUBLIC_MAPBOX_TOKEN` en tu archivo <em>.env.local</em> y reinicia el servidor. Sin token el mapa no se inicializa y no se verán marcadores.
        </div>
      )}
      {/* Controles de búsqueda y ubicación */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Seleccionar Ubicación
            {attractionName ? (
              <span className="text-sm text-gray-500 ml-2">• {attractionName}</span>
            ) : null}
          </h3>

        <div className="space-y-3">
          {/* Buscar por nombre */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar lugar (ej: Plaza de Armas, Santiago)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
            />
            <button
              onClick={searchLocation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          {/* Usar ubicación actual */}
          <button
            onClick={getCurrentLocation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Usar Mi Ubicación Actual
          </button>
        </div>
      </div>

      {/* Mapa interactivo con Mapbox */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="h-96 bg-gray-100 relative">
          <div ref={mapContainerRef} className="w-full h-full" />
          <div className="absolute bottom-4 left-4 bg-white px-3 py-2 rounded-lg shadow-lg text-sm">
            <span className="font-mono">
              {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
            </span>
          </div>
        </div>
      </div>

      {/* Coordenadas manuales */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Coordenadas</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitud
            </label>
            <input
              type="number"
              step="0.000001"
              value={selectedLat}
              onChange={(e) => setSelectedLat(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitud
            </label>
            <input
              type="number"
              step="0.000001"
              value={selectedLng}
              onChange={(e) => setSelectedLng(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Altitud (metros sobre el suelo, opcional)
          </label>
          <input
            type="number"
            step="0.1"
            value={altitude}
            onChange={(e) => setAltitude(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Etiqueta / Nombre del Punto
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Entrada principal, Mirador norte, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={savePosition}
          disabled={loading || !label.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Guardando...' : 'Guardar Posición'}
        </button>
      </div>

      {/* Lista de posiciones guardadas */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">
          Posiciones Guardadas ({positions.length})
        </h3>

        {positions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No hay posiciones guardadas para este atractivo
          </p>
        ) : (
          <div className="space-y-2">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{pos.label}</h4>
                  <p className="text-sm text-gray-600 font-mono">
                    {pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}
                    {pos.altitude ? ` • ${pos.altitude}m alt` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadPositionToForm(pos)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deletePosition(pos.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">🌍 Cómo Funciona</h4>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
          <li>Los objetos posicionados por GPS aparecen automáticamente cuando el usuario está cerca</li>
          <li>La precisión típica de GPS es de 5-10 metros</li>
          <li>Usa la altitud para elevar objetos sobre el suelo</li>
          <li>Los usuarios verán el objeto 3D anclado en esas coordenadas exactas</li>
        </ul>
      </div>
    </div>
  );
}
