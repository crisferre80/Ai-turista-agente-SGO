"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';
import StoryRecorder from './StoryRecorder';
import { supabase } from '@/lib/supabase';

const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();

interface MapProps {
    attractions?: any[];
    onNarrate?: (text: string, opts?: { source?: string, force?: boolean }) => void;
    onStoryPlay?: (url: string, name: string) => void;
    onPlaceFocus?: (place: any) => void;
}

const Map = ({ attractions = [], onNarrate, onStoryPlay, onPlaceFocus }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingDestination, setPendingDestination] = useState<{ coords: [number, number], name: string } | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);

    const [lng] = useState(-64.2599);
    const [lat] = useState(-27.7834);
    const [zoom] = useState(13);
    const router = useRouter();

    useEffect(() => {
        if (!MAPBOX_TOKEN) {
            setError("Falta el token de Mapbox en .env.local");
            return;
        }
        if (map.current) return;
        if (!mapContainer.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        try {
            const m = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/outdoors-v12',
                center: [lng, lat],
                zoom: zoom
            });

            m.on('error', (e: any) => {
                console.error("Mapbox error:", e);
                if (e.error?.message?.includes("Invalid Access Token") || (e.error as any)?.status === 401) {
                    setError("Token de Mapbox inválido o expirado.");
                }
            });

            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true,
                // Evitar círculo azul grande de precisión
                showAccuracyCircle: false
            });

            m.addControl(geolocate, 'top-right');
            m.addControl(new mapboxgl.NavigationControl(), 'top-right');

            const hasGreetedRef = { current: false };
            geolocate.on('geolocate', (e: any) => {
                const loc: [number, number] = [e.coords.longitude, e.coords.latitude];
                console.log('User location set:', loc);
                setUserLocation(loc);

                if (!hasGreetedRef.current) {
                    onNarrate?.("¡Te encontré! Ahora puedo decirte exactamente cómo llegar a cualquier rincón de Santiago.", { source: 'map-geolocate' });
                    hasGreetedRef.current = true;
                }
            });

            m.on('load', () => {
                map.current = m;
                setIsMapReady(true);

                // Intentar remover capas de círculo de precisión si existen
                try {
                    if (m.getLayer('mapboxgl-user-location-accuracy-circle')) {
                        m.removeLayer('mapboxgl-user-location-accuracy-circle');
                    }
                    if (m.getLayer('mapboxgl-user-location-accuracy-circle-stroke')) {
                        m.removeLayer('mapboxgl-user-location-accuracy-circle-stroke');
                    }
                } catch {}

                // Intentar obtener ubicación inicial
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const loc: [number, number] = [position.coords.longitude, position.coords.latitude];
                            setUserLocation(loc);
                        },
                        (error) => {
                            // Silenciar errores iniciales
                        },
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                }
            });

            return () => {
                m.remove();
                map.current = null;
            };
        } catch (err) {
            console.error("Failed to initialize Mapbox:", err);
            setError("Error al inicializar el mapa.");
        }
    }, [lng, lat, zoom]);

    // Effect to draw pending route when user location becomes available
    useEffect(() => {
        if (userLocation && pendingDestination && map.current) {
            console.log('Drawing pending route to:', pendingDestination.name);
            drawRoute(userLocation, pendingDestination.coords, pendingDestination.name);
            setPendingDestination(null);
        }
    }, [userLocation, pendingDestination]);

    const drawRoute = async (start: [number, number], end: [number, number], destName: string) => {
        if (!map.current) return;
        console.log('Drawing route from', start, 'to', end, 'for', destName);
        try {
            const query = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&language=es&access_token=${mapboxgl.accessToken}`,
                { method: 'GET' }
            );
            const json = await query.json();
            console.log('Route API response:', json);
            if (json.code !== 'Ok') {
                console.log('Route API failed with code:', json.code);
                throw new Error("Route not found");
            }

            const data = json.routes[0];
            const route = data.geometry.coordinates;
            const distance = (data.distance / 1000).toFixed(1);
            const duration = Math.floor(data.duration / 60);
            const stepNarrative = data.legs[0].steps.slice(0, 3).map((s: any) => s.maneuver.instruction).join('. Luego, ');

            // Stop any in-progress narration and play route instructions with priority
            try {
                // stopSantiNarration is imported via page.handleNarration indirectly (it's exposed in speech.ts); we attempt a global call if available
                if (typeof (window as any).stopSantiNarration === 'function') (window as any).stopSantiNarration();
            } catch {}
            onNarrate?.(`¡Listo! Para llegar a ${destName} recorreremos ${distance}km en ${duration} min. Ruta: ${stepNarrative}.`, { source: 'map-route', force: true });

            const geojson: any = {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: route }
            };

            if (map.current.getSource('route')) {
                (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(geojson);
            } else {
                map.current.addLayer({
                    id: 'route',
                    type: 'line',
                    source: { type: 'geojson', data: geojson },
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#007cbf', 'line-width': 7, 'line-opacity': 0.85 }
                });
            }

            const bounds = new mapboxgl.LngLatBounds(route[0], route[0]);
            route.forEach((coord: [number, number]) => bounds.extend(coord));
            map.current.fitBounds(bounds, { padding: 100, duration: 1500 });
            console.log('Route drawn successfully');
        } catch (error) {
            console.error('Error drawing route:', error);
            onNarrate?.("No pude calcular la ruta. Verifica tu conexión a internet o intenta nuevamente.", { source: 'map' });
        }
    };

    const openRecorder = (id: string, name: string) => {
        const recorderDiv = document.createElement('div');
        recorderDiv.id = 'story-recorder-container';
        document.body.appendChild(recorderDiv);
        const root = createRoot(recorderDiv);
        const handleClose = () => { root.unmount(); recorderDiv.remove(); };
        root.render(
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ width: '100%', maxWidth: '400px' }}>
                    <StoryRecorder attractionId={id} onClose={handleClose} />
                </div>
            </div>
        );
    };

    // 1. Marker Creation Effect (Only runs when attractions or map readiness changes)
    useEffect(() => {
        if (!isMapReady || !map.current) return;
        const currentMap = map.current;

        // Clean up old markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        attractions.forEach(attr => {
            if (!currentMap || !attr.coords) return;

            const wrapper = document.createElement('div');
            const el = document.createElement('div');
            el.className = 'custom-circular-marker';

            const markerColor = attr.isBusiness ? '#20B2AA' : '#D2691E';
            const imageUrl = attr.image || "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg";

            el.style.cssText = `
                width: 45px;
                height: 45px;
                border: 3px solid ${markerColor};
                border-radius: 50%;
                background-image: url(${imageUrl});
                background-size: cover;
                background-position: center;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;

            wrapper.appendChild(el);

            el.onmouseenter = () => {
                el.style.transform = 'scale(1.2) translateY(-5px)';
                el.style.boxShadow = `0 0 20px ${markerColor}aa`;
            };
            el.onmouseleave = () => {
                el.style.transform = 'scale(1) translateY(0)';
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            };

            const galleryCount = attr.gallery_urls?.length || 0;

            // Tooltip element for hover title
            const tooltip = document.createElement('div');
            tooltip.className = 'marker-tooltip';
            tooltip.textContent = attr.name;
            tooltip.style.cssText = `
                position: absolute;
                bottom: 60px;
                left: 50%;
                transform: translateX(-50%) translateY(6px);
                background: rgba(0,0,0,0.75);
                color: white;
                padding: 6px 10px;
                border-radius: 10px;
                font-size: 0.85rem;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: all 0.18s ease;
                z-index: 99999;
            `;
            wrapper.appendChild(tooltip);

            el.onmouseenter = () => {
                el.style.transform = 'scale(1.2) translateY(-5px)';
                el.style.boxShadow = `0 0 20px ${markerColor}aa`;
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(-50%) translateY(0)';
            };
            el.onmouseleave = () => {
                el.style.transform = 'scale(1) translateY(0)';
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateX(-50%) translateY(6px)';
            };

            const compactContent = `
                <div style="font-family: system-ui; min-width: 200px;">
                  <div style="display:flex; gap:10px; align-items:center;">
                    <img src="${imageUrl}" style="width:80px; height:60px; object-fit:cover; border-radius:8px;" />
                    <div style="flex:1;">
                      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <strong style="color: ${markerColor}; font-size: 15px;">${attr.name}</strong>
                        <span style="font-size:11px; color:#666; background:#f0f0f0; padding:4px 8px; border-radius:8px;">${attr.category || 'Lugar'}</span>
                      </div>
                      <div style="font-size:12px; color:#666; margin-top:6px;">${(attr.description || '').slice(0, 70)}${(attr.description && attr.description.length > 70) ? '...' : ''}</div>
                    </div>
                  </div>
                  <div style="display:flex; gap:8px; margin-top:10px;">
                    <button onclick="(function(){ window.location.href='/explorar/${attr.id}'; })()" style="flex:1; background:#fff; color:${markerColor}; border:1px solid #eee; padding:8px 10px; border-radius:8px; font-weight:700; cursor:pointer">Más info</button>
                    <button onclick="window.requestRoute(${attr.coords[0]}, ${attr.coords[1]}, '${attr.name.replace(/'/g, "\\'")}')" style="flex:1; background:${markerColor}; color:#fff; border:none; padding:8px 10px; border-radius:8px; font-weight:700; cursor:pointer">Ir</button>
                  </div>
                </div>
            `;

            try {
                const marker = new mapboxgl.Marker(wrapper)
                    .setLngLat(attr.coords as [number, number])
                    .setPopup(new mapboxgl.Popup({ offset: 35, maxWidth: '320px' }).setHTML(compactContent))
                    .addTo(currentMap);

                (wrapper as any)._attrId = attr.id;
                markersRef.current.push(marker);
            } catch (e) { }


        });

    }, [attractions, isMapReady]);

    // 2. Global Listeners Effect (Depends on location/ready state, but doesn't recreate markers)
    useEffect(() => {
        if (!isMapReady || !map.current) return;
        const currentMap = map.current;

        (window as any).requestRoute = (destLng: number, destLat: number, destName: string) => {
            if (userLocation && map.current) drawRoute(userLocation, [destLng, destLat], destName);
            else onNarrate?.("Necesito tu ubicación para guiarte.", { source: 'map' });
        };

        (window as any).requestRecord = (id: string, name: string) => openRecorder(id, name);

        (window as any).requestPlayStories = async (id: string, name: string) => {
            const { data } = await supabase.from('narrations').select('audio_url').eq('attraction_id', id).order('created_at', { ascending: false }).limit(1);
            if (data && data.length > 0) onStoryPlay?.(data[0].audio_url, name);
            else onNarrate?.(`Aún no hay historias para ${name}.`, { source: 'map' });
        };


    (window as any).focusPlaceOnMap = (placeName: string) => {
            console.log('focusPlaceOnMap called with:', placeName);
            const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '');
            const normalizedPlaceName = normalize(placeName);

            const found = attractions.find(a => {
                const normalizedName = normalize(a.name);
                return normalizedPlaceName.includes(normalizedName) || normalizedName.includes(normalizedPlaceName);
            });

            if (found && found.coords) {
                currentMap.flyTo({ center: found.coords as [number, number], zoom: 15 });

                if (userLocation) {
                    drawRoute(userLocation, found.coords as [number, number], found.name);
                } else {
                    console.log('Setting pending destination:', found.name);
                    setPendingDestination({ coords: found.coords as [number, number], name: found.name });
                    onNarrate?.("Para mostrarte la ruta, necesito tu ubicación. Toca el botón azul de la brújula en la esquina superior derecha del mapa.", { source: 'map' });
                }

                const targetMarker = markersRef.current.find((m: any) => m.getElement()._attrId === found.id);
                if (targetMarker) {
                    if (!targetMarker.getPopup()?.isOpen()) targetMarker.togglePopup();
                }

                if (onPlaceFocus) onPlaceFocus(found);
                return found;
            }
            return null;
        };

        // Listen to Santi narrations so we can navigate to a place detail when he mentions a known place
        const onNarration = (ev: Event) => {
            try {
                const detail = (ev as CustomEvent).detail as { text: string, source?: string } | undefined;
                const text = detail?.text || '';
                const source = detail?.source;
                // Ignore narrations emitted by our own map actions to avoid loops
                if (source && typeof source === 'string' && source.startsWith('map')) {
                    // Debug log to help trace potential loops
                    console.debug('Map: Ignoring narration from source:', source, 'text:', text.slice(0,50));
                    return;
                }

                if (!text) return;
                const found = (window as any).focusPlaceOnMap(text);
                if (found && found.id) {
                    // Navigate to the place detail page while Santi narrates
                    router.push(`/explorar/${found.id}`);
                }
            } catch (e) { /* ignore */ }
        };

        window.addEventListener('santi:narrate', onNarration as EventListener);
        // Remove listener on cleanup
        return () => {
            window.removeEventListener('santi:narrate', onNarration as EventListener);
        };
    }, [isMapReady, attractions, userLocation]);

    if (error) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff5f5', color: '#c53030', padding: '20px', textAlign: 'center' }}>
                <span style={{ fontSize: '40px', marginBottom: '10px' }}>⚠️</span>
                <h3 style={{ margin: '0 0 10px 0' }}>Error del Mapa</h3>
                <p style={{ fontSize: '14px' }}>{error}</p>
                <p style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>Por favor, verifica el token en el archivo .env.local</p>
            </div>
        );
    }

    return (
        <div className="map-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
        </div>
    );
};

export default Map;
