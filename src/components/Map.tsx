"use client";
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Note: Replace with actual token via environment variable
const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();

const Map = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [lng] = useState(-64.2599); // Santiago del Estero
    const [lat] = useState(-27.7834);
    const [zoom] = useState(13);

    useEffect(() => {
        if (map.current) return; // initialize map only once
        if (!mapContainer.current) return;

        if (!MAPBOX_TOKEN) {
            console.warn("Mapbox token is missing!");
            return;
        }

        mapboxgl.accessToken = MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/outdoors-v12',
            center: [lng, lat],
            zoom: zoom
        });

        // Add navigation control (the +/- zoom buttons)
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Cleanup
        return () => {
            map.current?.remove();
        };
    }, [lng, lat, zoom]);

    return (
        <div className="map-wrapper">
            {!MAPBOX_TOKEN && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                    background: 'rgba(255,255,255,0.8)',
                    padding: '1rem',
                    borderRadius: '8px'
                }}>
                    <p>Mapbox Token Required</p>
                </div>
            )}
            <div ref={mapContainer} style={{ width: '100%', height: '100%', minHeight: '500px', borderRadius: '12px' }} />
        </div>
    );
};

export default Map;
