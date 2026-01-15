"use client";
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';
import StoryRecorder from './StoryRecorder';
import { supabase } from '@/lib/supabase';

const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();

interface MapProps {
    attractions?: any[];
    onNarrate?: (text: string) => void;
    onStoryPlay?: (url: string, name: string) => void;
    onPlaceFocus?: (place: any) => void;
}

const Map = ({ attractions = [], onNarrate, onStoryPlay, onPlaceFocus }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);

    const [lng] = useState(-64.2599);
    const [lat] = useState(-27.7834);
    const [zoom] = useState(13);

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
                showUserHeading: true
            });

            m.addControl(geolocate, 'top-right');
            m.addControl(new mapboxgl.NavigationControl(), 'top-right');

            geolocate.on('geolocate', (e: any) => {
                const loc: [number, number] = [e.coords.longitude, e.coords.latitude];
                setUserLocation(loc);
                onNarrate?.("¡Te encontré! Ahora puedo decirte exactamente cómo llegar a cualquier rincón de Santiago.");
            });

            m.on('load', () => {
                map.current = m;
                setIsMapReady(true);
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

    const drawRoute = async (start: [number, number], end: [number, number], destName: string) => {
        if (!map.current) return;
        try {
            const query = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&language=es&access_token=${mapboxgl.accessToken}`,
                { method: 'GET' }
            );
            const json = await query.json();
            if (json.code !== 'Ok') throw new Error("Route not found");

            const data = json.routes[0];
            const route = data.geometry.coordinates;
            const distance = (data.distance / 1000).toFixed(1);
            const duration = Math.floor(data.duration / 60);
            const stepNarrative = data.legs[0].steps.slice(0, 3).map((s: any) => s.maneuver.instruction).join('. Luego, ');

            onNarrate?.(`¡Listo! Para llegar a ${destName} recorreremos ${distance}km en ${duration} min. Ruta: ${stepNarrative}.`);

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
        } catch (error) {
            onNarrate?.("Tuve un problema con el GPS. ¿Habilitaste tu ubicación?");
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
            const imageUrl = attr.image || "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png";

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
            const popupContent = `
                <div style="color: #333; padding: 0; min-width: 240px; overflow: hidden; border-radius: 12px; font-family: system-ui;">
                    <div style="position: relative">
                        <img src="${imageUrl}" style="width: 100%; height: 130px; object-fit: cover; border-bottom: 2px solid #eee" />
                        ${galleryCount > 0 ? '<span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px;">+' + galleryCount + ' fotos</span>' : ''}
                    </div>
                    <div style="padding: 12px">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px">
                            <h4 style="margin: 0; font-size: 17px; font-weight: 800; color: ${markerColor}">${attr.name}</h4>
                            <span style="font-size: 10px; background: #eee; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${attr.category || 'Lugar'}</span>
                        </div>
                        <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #555">${attr.description}</p>
                        
                        <button onclick="window.requestRoute(${attr.coords[0]}, ${attr.coords[1]}, '${attr.name.replace(/'/g, "\\'")}')" 
                            style="background: ${markerColor}; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; width: 100%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-bottom: 8px">
                            🚀 ¡Ir ahora!
                        </button>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
                            <button onclick="window.requestRecord('${attr.id}', '${attr.name.replace(/'/g, "\\'")}')" 
                                style="background: white; color: #777; border: 1px solid #ddd; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 11px">
                                🎙️ Grabar
                            </button>
                            <button onclick="window.requestPlayStories('${attr.id}', '${attr.name.replace(/'/g, "\\'")}')" 
                                style="background: #f5f5f5; color: #333; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 11px">
                                👂 Historias
                            </button>
                        </div>
                    </div>
                </div>
            `;

            try {
                const marker = new mapboxgl.Marker(wrapper)
                    .setLngLat(attr.coords as [number, number])
                    .setPopup(new mapboxgl.Popup({ offset: 35, maxWidth: '280px' }).setHTML(popupContent))
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
            else onNarrate?.("Necesito tu ubicación para guiarte.");
        };

        (window as any).requestRecord = (id: string, name: string) => openRecorder(id, name);

        (window as any).requestPlayStories = async (id: string, name: string) => {
            const { data } = await supabase.from('narrations').select('audio_url').eq('attraction_id', id).order('created_at', { ascending: false }).limit(1);
            if (data && data.length > 0) onStoryPlay?.(data[0].audio_url, name);
            else onNarrate?.(`Aún no hay historias para ${name}.`);
        };

        (window as any).focusPlaceOnMap = (placeName: string) => {
            const found = attractions.find(a =>
                placeName.toLowerCase().includes(a.name.toLowerCase()) ||
                a.name.toLowerCase().includes(placeName.toLowerCase())
            );

            if (found && found.coords) {
                currentMap.flyTo({ center: found.coords as [number, number], zoom: 15 });

                if (userLocation) {
                    drawRoute(userLocation, found.coords as [number, number], found.name);
                } else {
                    onNarrate?.("Para mostrarte cómo llegar, por favor activá tu ubicación tocando el botoncito de la brújula arriba a la derecha.");
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
