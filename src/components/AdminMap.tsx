"use client";
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();

interface AdminMapProps {
    onLocationSelect: (lng: number, lat: number) => void;
    initialCoords?: [number, number];
}

const AdminMap = ({ onLocationSelect, initialCoords }: AdminMapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const marker = useRef<mapboxgl.Marker | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [lng] = useState(initialCoords ? initialCoords[0] : -64.2599);
    const [lat] = useState(initialCoords ? initialCoords[1] : -27.7834);

    useEffect(() => {
        if (!MAPBOX_TOKEN) {
            setError("Falta el token de Mapbox");
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
                zoom: 13
            });

            m.on('error', (e: any) => {
                if (e.error?.message?.includes("Invalid Access Token") || (e.error as any)?.status === 401) {
                    setError("Token de Mapbox inválido.");
                }
            });

            m.on('load', () => {
                map.current = m;
                // Create marke on load
                marker.current = new mapboxgl.Marker({ color: '#FF0000', draggable: true })
                    .setLngLat([lng, lat])
                    .addTo(m);

                m.on('click', (e) => {
                    const { lng, lat } = e.lngLat;
                    marker.current?.setLngLat([lng, lat]);
                    onLocationSelect(lng, lat);
                });

                marker.current.on('dragend', () => {
                    const { lng, lat } = marker.current!.getLngLat();
                    onLocationSelect(lng, lat);
                });
            });

            m.addControl(new mapboxgl.NavigationControl(), 'top-right');

            return () => {
                m.remove();
                map.current = null;
            };
        } catch (err) {
            setError("Error al cargar el mapa.");
        }
    }, [lng, lat]);

    if (error) {
        return (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '300px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #ddd' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default AdminMap;
