"use client";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';
import { useRef, useState, useEffect, useCallback } from 'react';
import StoryRecorder from './StoryRecorder';
import { supabase } from '@/lib/supabase';

declare global {
    interface Window {
        requestRoute?: (destLng: number, destLat: number, destName: string) => void;
        requestRecord?: (id: string, name: string) => void;
        requestPlayStories?: (id: string, name: string) => Promise<void>;
        focusPlaceOnMap?: (place: string) => void;
        stopMapAnimation?: () => void;
    }
}

const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();

// Tipo para lugares/attractions
interface Attraction {
  id: string;
  name: string;
  image: string;
  description: string;
  coords: [number, number];
  isBusiness?: boolean;
  info?: string;
  category?: string;
  contact_info?: string;
  gallery_urls?: string[];
}

interface MapProps {
    attractions?: Attraction[];
    onNarrate?: (text: string, opts?: { source?: string, force?: boolean }) => void;
    onStoryPlay?: (url: string, name: string) => void;
    onPlaceFocus?: (place: Attraction) => void;
    onLocationChange?: (coords: [number, number]) => void;
    userLocation?: { latitude: number; longitude: number } | null;
}

const Map = ({ attractions = [], onNarrate, onStoryPlay, onPlaceFocus, onLocationChange, userLocation: parentUserLocation }: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    // Refs para controlar animaciones desde funciones globales
    const isAnimatingRef = useRef(false);
    const animationIdRef = useRef<number | null>(null);
    const startTimeRef = useRef(Date.now());
    const pausedElapsedRef = useRef(0);
    const isOrbitingRef = useRef(false);
    // Inicializar ubicación local con la del parent si existe
    const [userLocation, setUserLocation] = useState<[number, number] | null>(
        parentUserLocation ? [parentUserLocation.longitude, parentUserLocation.latitude] : null
    );
    
    // Actualizar ubicación local cuando cambia la del parent
    useEffect(() => {
        if (parentUserLocation && (!userLocation || 
            userLocation[0] !== parentUserLocation.longitude || 
            userLocation[1] !== parentUserLocation.latitude)) {
            const loc: [number, number] = [parentUserLocation.longitude, parentUserLocation.latitude];
            setUserLocation(loc);
            console.log('📍 Map: Ubicación actualizada desde parent:', loc);
        }
    }, [parentUserLocation, userLocation]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingDestination, setPendingDestination] = useState<{ coords: [number, number], name: string } | null>(null);
    const [activeRoute, setActiveRoute] = useState<{ start: [number, number], end: [number, number], name: string } | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);

    // Refs para callbacks para evitar re-renders por cambios en props
    const onNarrateRef = useRef(onNarrate);
    const onLocationChangeRef = useRef(onLocationChange);
    const onPlaceFocusRef = useRef(onPlaceFocus);
    const onStoryPlayRef = useRef(onStoryPlay);

    // Actualizar refs cuando cambian las props
    useEffect(() => {
        onNarrateRef.current = onNarrate;
    }, [onNarrate]);

    useEffect(() => {
        onLocationChangeRef.current = onLocationChange;
    }, [onLocationChange]);

    useEffect(() => {
        onPlaceFocusRef.current = onPlaceFocus;
    }, [onPlaceFocus]);

    useEffect(() => {
        onStoryPlayRef.current = onStoryPlay;
    }, [onStoryPlay]);

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

            m.on('error', (e: mapboxgl.ErrorEvent) => {
                console.error("Mapbox error:", e);
                if (e.error?.message?.includes("Invalid Access Token")) {
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
            geolocate.on('geolocate', (e: GeolocationPosition) => {
                const loc: [number, number] = [e.coords.longitude, e.coords.latitude];
                console.log('📍 Map: Nueva ubicación obtenida:', loc);
                setUserLocation(loc);
                
                // Emit location to parent component
                onLocationChangeRef.current?.(loc);

                if (!hasGreetedRef.current && !parentUserLocation) {
                    // Solo saludar si es la primera vez y no ya teníamos ubicación
                    // Enviar evento para que ChatInterface narre
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narrate', {
                            detail: { 
                                text: "¡Te encontré! Ahora puedo decirte exactamente cómo llegar a cualquier rincón de Santiago.", 
                                source: 'map-geolocate' 
                            }
                        }));
                    }
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

                // Animación de dron: tour por marcadores con órbita
                let animationId: number | null = null;
                let inactivityTimer: NodeJS.Timeout | null = null;
                let startTime = Date.now();
                let pausedElapsed = 0;
                const tourDuration = 10000; // 10 segundos por marcador
                const orbitDuration = 8000; // 8 segundos de órbita
                const inactivityDelay = 10000;
                
                // Crear waypoints de attractions
                const waypoints = attractions.map(attr => ({
                    center: attr.coords as [number, number],
                    zoom: 16,
                    name: attr.name,
                    markerIndex: attractions.indexOf(attr)
                }));
                
                let currentWaypointIndex = 0;
                let isTransitioning = false;
                let orbitStartTime = 0;
                
                const animateTour = () => {
                    if (!map.current || !isAnimatingRef.current || waypoints.length === 0) return;
                    
                    const currentTime = Date.now();
                    
                    if (isTransitioning) {
                        // Esperando a llegar al waypoint
                        animationId = requestAnimationFrame(animateTour);
                        return;
                    }
                    
                    if (isOrbitingRef.current) {
                        // Órbita circular alrededor del marcador
                        const orbitElapsed = currentTime - orbitStartTime;
                        const bearing = (orbitElapsed * 0.010) % 360; // Velocidad de rotación muy suave
                        
                        // Pitch incremental de 60º a 80º durante la órbita
                        const pitchProgress = Math.min(orbitElapsed / orbitDuration, 1);
                        const pitch = 60 + (pitchProgress * 20); // De 60 a 80 grados
                        
                        map.current.setBearing(bearing);
                        map.current.setPitch(pitch);
                        
                        // Terminar órbita después de orbitDuration
                        if (orbitElapsed >= orbitDuration) {
                            isOrbitingRef.current = false;
                            // No cerrar popup aquí, mantenerlo hasta el siguiente vuelo
                            currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
                            // Iniciar vuelo inmediato al siguiente
                            const nextWaypoint = waypoints[currentWaypointIndex];
                            isTransitioning = true;
                            
                            map.current.flyTo({
                                center: nextWaypoint.center,
                                zoom: nextWaypoint.zoom,
                                pitch: 45,
                                bearing: 0,
                                duration: 3000
                            });
                            
                            setTimeout(() => {
                                // Cerrar popups anteriores al llegar
                                markersRef.current.forEach(marker => {
                                    const popup = marker.getPopup();
                                    if (popup) popup.remove();
                                });
                                const marker = markersRef.current[nextWaypoint.markerIndex];
                                if (marker) {
                                    const popup = marker.getPopup();
                                    if (popup && map.current) popup.addTo(map.current);
                                }
                                isOrbitingRef.current = true;
                                orbitStartTime = Date.now();
                                isTransitioning = false;
                            }, 3000);
                        }
                    } else {
                        // Si no está orbitando ni transitando, iniciar órbita en el marcador actual
                        if (!isTransitioning && waypoints.length > 0) {
                            const waypoint = waypoints[currentWaypointIndex];
                            isTransitioning = true;
                            
                            map.current.flyTo({
                                center: waypoint.center,
                                zoom: waypoint.zoom,
                                pitch: 45,
                                bearing: 0,
                                duration: 3000
                            });
                            
                            setTimeout(() => {
                                markersRef.current.forEach(marker => {
                                    const popup = marker.getPopup();
                                    if (popup) popup.remove();
                                });
                                const marker = markersRef.current[waypoint.markerIndex];
                                if (marker) {
                                    const popup = marker.getPopup();
                                    if (popup && map.current) popup.addTo(map.current);
                                }
                                isOrbitingRef.current = true;
                                orbitStartTime = Date.now();
                                isTransitioning = false;
                            }, 3000);
                        }
                    }
                    
                    animationId = requestAnimationFrame(animateTour);
                };
                
                const startAnimation = () => {
                    if (isAnimatingRef.current) return;
                    isAnimatingRef.current = true;
                    console.log('🎬 Iniciando tour de dron con órbitas');
                    animateTour();
                };
                
                const stopAnimation = () => {
                    if (!isAnimatingRef.current) return;
                    isAnimatingRef.current = false;
                    pausedElapsed += Date.now() - startTime;
                    isOrbitingRef.current = false;
                    if (animationId !== null) {
                        cancelAnimationFrame(animationId);
                        animationId = null;
                    }
                    console.log('⏸️ Tour de dron detenido');
                };
                
                const resetInactivityTimer = () => {
                    // Detener animación inmediatamente cuando hay interacción
                    stopAnimation();
                    
                    // Limpiar timer anterior
                    if (inactivityTimer !== null) {
                        clearTimeout(inactivityTimer);
                    }
                    
                    // Configurar nuevo timer de inactividad
                    inactivityTimer = setTimeout(() => {
                        startAnimation();
                    }, inactivityDelay);
                };
                
                // Detectar interacciones del usuario que detienen la animación temporalmente
                const interactionEvents = [
                    'click', 'touchstart',  // Interacción principal
                    'wheel'                 // Zoom con rueda (manual)
                ];
                
                interactionEvents.forEach(event => {
                    m.on(event as any, resetInactivityTimer);
                });
                
                // Iniciar animación automáticamente después de 2 segundos
                setTimeout(() => {
                    if (map.current) {
                        startAnimation();
                    }
                }, 2000);
                
                // Limpiar animación y timers cuando el componente se desmonte
                const originalRemove = m.remove.bind(m);
                m.remove = () => {
                    stopAnimation();
                    if (inactivityTimer !== null) {
                        clearTimeout(inactivityTimer);
                    }
                    // Remover event listeners
                    interactionEvents.forEach(event => {
                        m.off(event as any, resetInactivityTimer);
                    });
                    originalRemove();
                };

                // Intentar obtener ubicación inicial
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const loc: [number, number] = [position.coords.longitude, position.coords.latitude];
                            setUserLocation(loc);
                            onLocationChangeRef.current?.(loc);
                        },
                        () => {
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

    const drawRoute = useCallback(async (start: [number, number], end: [number, number], destName: string) => {
        if (!map.current) return;
        console.log('Drawing route from', start, 'to', end, 'for', destName);
        
        // Guardar información de la ruta activa para Google Maps
        setActiveRoute({ start, end, name: destName });
        
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
            const stepNarrative = data.legs[0].steps.slice(0, 3).map((s: { maneuver: { instruction: string } }) => s.maneuver.instruction).join('. Luego, ');

            // Limpiar ruta previa si existe
            if (map.current.getLayer('route')) {
                map.current.removeLayer('route');
            }
            if (map.current.getSource('route')) {
                map.current.removeSource('route');
            }
            
            // Limpiar ruta activa anterior
            setActiveRoute(null);

            // Narrar instrucciones de ruta a través de evento - ChatInterface lo manejará
            console.log('🗺️ Map: Dispatching route narration event for', destName);
            const routeMessage = `¡Listo! Para llegar a ${destName} recorreremos ${distance}km en ${duration} min. Ruta: ${stepNarrative}.`;
            
            // Enviar evento para que ChatInterface lo narre
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('santi:narrate', {
                    detail: { 
                        text: routeMessage, 
                        source: 'map-route', 
                        force: true 
                    }
                }));
            }

            const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
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
            map.current.fitBounds(bounds, { 
                padding: 120, 
                duration: 1500, // Más rápido para rutas
                pitch: 0, // Vista plana para mejor navegación
                bearing: 0, // Sin rotación para vista clara
                easing: (t: number) => t * (2 - t) // Easing suave pero rápido
            });
            
            // Activar la ruta después de que se complete la animación del mapa
            setTimeout(() => {
                setActiveRoute({ start, end, name: destName });
            }, 1500);
            
            // Mostrar opción de Google Maps después de dibujar la ruta
            setTimeout(() => {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('santi:narrate', {
                        detail: { 
                            text: `También podés abrir esta ruta en Google Maps para iniciar la navegación GPS.`, 
                            source: 'map-route-google',
                            force: false
                        }
                    }));
                }
            }, 2000); // Esperar a que termine la animación del mapa
            console.log('Route drawn successfully');
        } catch (error) {
            console.error('Error drawing route:', error);
            // Enviar evento para que ChatInterface narre el error
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('santi:narrate', {
                    detail: { 
                        text: "No pude calcular la ruta. Verifica tu conexión a internet o intenta nuevamente.", 
                        source: 'map-error' 
                    }
                }));
            }
        }
    }, []);

    // Effect to draw pending route when user location becomes available
    useEffect(() => {
        if (userLocation && pendingDestination && map.current) {
            console.log('🗺️ Map: Procesando destino pendiente:', pendingDestination.name);
            console.log('🗺️ Map: Con ubicación:', userLocation);
            drawRoute(userLocation, pendingDestination.coords, pendingDestination.name);
            setPendingDestination(null);
        }
    }, [userLocation, pendingDestination, drawRoute]);

    // Effect to prevent map focus when chat input has focus
    useEffect(() => {
        const preventMapFocus = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            
            // Never interfere with input or textarea elements
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Only act on map container or its canvas
            if (target !== mapContainer.current && !mapContainer.current?.contains(target)) {
                return;
            }

            // Prevent map from taking focus during animations
            if (isAnimating) {
                console.log('🗺️ Map: Removiendo foco del mapa durante animación');
                target.blur();
                e.preventDefault();
            }
        };

        document.addEventListener('focusin', preventMapFocus, true);

        return () => {
            document.removeEventListener('focusin', preventMapFocus, true);
        };
    }, [isAnimating]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const openRecorder = (id: string, _name: string) => {
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

                (wrapper as unknown as HTMLElement & { _attrId: string })._attrId = attr.id;
                markersRef.current.push(marker);
            } catch { }


        });

    }, [attractions, isMapReady]);

    // 2. Global Listeners Effect (Depends on location/ready state, but doesn't recreate markers)
    useEffect(() => {
        if (!isMapReady || !map.current) return;
        const currentMap = map.current;

        window.requestRoute = (destLng: number, destLat: number, destName: string) => {
            if (userLocation && map.current) drawRoute(userLocation, [destLng, destLat], destName);
            else {
                // Enviar evento para que ChatInterface narre
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('santi:narrate', {
                        detail: { 
                            text: "Necesito tu ubicación para guiarte.", 
                            source: 'map-location' 
                        }
                    }));
                }
            }
        };

        window.requestRecord = (id: string, name: string) => openRecorder(id, name);

        window.requestPlayStories = async (id: string, name: string) => {
            const { data } = await supabase.from('narrations').select('audio_url').eq('attraction_id', id).order('created_at', { ascending: false }).limit(1);
            if (data && data.length > 0) onStoryPlayRef.current?.(data[0].audio_url, name);
            else {
                // Enviar evento para que ChatInterface narre
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('santi:narrate', {
                        detail: { 
                            text: `Aún no hay historias para ${name}.`, 
                            source: 'map-stories' 
                        }
                    }));
                }
            }
        };


    window.focusPlaceOnMap = (placeName: string) => {
            console.log('=== focusPlaceOnMap DEBUG ===');
            
            // Don't focus map if chat input has focus (user is typing)
            const chatInput = document.querySelector('input[type="text"]') as HTMLInputElement;
            if (chatInput && chatInput === document.activeElement) {
                console.log('Map: Skipping focusPlaceOnMap because chat input has focus');
                return;
            }

            // Additional check: don't focus if any input/textarea has focus
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                console.log('Map: Skipping focusPlaceOnMap because an input element has focus');
                return;
            }
            
            console.log('1. Input placeName:', placeName);
            console.log('2. Total attractions available:', attractions.length);
            
            const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '');
            const normalizedPlaceName = normalize(placeName);
            console.log('3. Normalized placeName:', normalizedPlaceName);

            // Log todos los nombres disponibles
            console.log('4. Available place names:', attractions.map(a => a.name).slice(0, 10));

            const found = attractions.find(a => {
                const normalizedName = normalize(a.name);
                const matches = normalizedPlaceName.includes(normalizedName) || normalizedName.includes(normalizedPlaceName);
                if (matches) {
                    console.log('5. MATCH FOUND:', a.name, 'with coords:', a.coords);
                }
                return matches;
            });

            if (found && found.coords) {
                console.log('6. Flying to coordinates:', found.coords);
                
                // Marcar que hay una animación en curso
                setIsAnimating(true);
                
                // Limpiar ruta activa anterior cuando se hace flyTo
                setActiveRoute(null);
                
                // Animación cinematográfica 3D con movimiento y orientación
                setTimeout(() => {
                    currentMap.flyTo({
                        center: found.coords as [number, number],
                        zoom: 16,
                        pitch: 45, // Inclinación 3D para efecto tridimensional
                        bearing: 15, // Rotación ligera para no parecer plano
                        duration: 2500, // Duración más larga para efecto cinematográfico
                        easing: (t: number) => t * (2 - t) // Easing más suave y natural
                    });
                    
                    // Terminar la animación después de la duración
                    setTimeout(() => {
                        setIsAnimating(false);
                    }, 2500);
                }, 300); // Pequeña pausa antes de la animación

                if (userLocation) {
                    console.log('7. User location available, drawing route');
                    drawRoute(userLocation, found.coords as [number, number], found.name);
                } else {
                    console.log('7. No user location, setting pending destination');
                    setPendingDestination({ coords: found.coords as [number, number], name: found.name });
                    // Enviar evento para que ChatInterface narre
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narrate', {
                            detail: { 
                                text: "Para mostrarte la ruta, necesito tu ubicación. Toca el botón azul de la brújula en la esquina superior derecha del mapa.", 
                                source: 'map-location' 
                            }
                        }));
                    }
                }

                // NO abrir el popup automáticamente cuando es consulta de ruta
                // El popup solo debe abrirse si el usuario hace clic en el marcador
                
                // Notificar al componente padre que se enfocó un lugar (sin causar navegación)
                if (onPlaceFocusRef.current) onPlaceFocusRef.current(found);
                console.log('8. Place focused successfully');
            } else {
                console.log('6. NO MATCH FOUND for:', placeName);
            }
        };

        // Global function to stop map animations when user starts typing
        window.stopMapAnimation = () => {
            if (!isAnimatingRef.current) return;
            isAnimatingRef.current = false;
            pausedElapsedRef.current += Date.now() - startTimeRef.current;
            isOrbitingRef.current = false;
            if (animationIdRef.current !== null) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }
            console.log('⏸️ Map animation stopped by user interaction (chat focus)');
        };

        // Listen to Santi narrations so we can focus places on the map when mentioned
        const onNarration = (ev: Event) => {
            try {
                const detail = (ev as CustomEvent).detail as { text: string, source?: string } | undefined;
                const text = detail?.text || '';
                const source = detail?.source;

                // Don't process narrations if any input has focus (user is typing)
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                    console.debug('Map: Ignoring narration because an input element has focus');
                    return;
                }

                // Only process narrations that should trigger map focus
                // Ignore all narrations during typing or from automated sources
                const shouldProcess = source === 'user-route' || source === 'user-place-query';
                if (!shouldProcess) {
                    console.debug('Map: Ignoring narration from source:', source, 'text:', text.slice(0,50));
                    return;
                }

                if (!text) return;
                // Process narration that should focus the map
                console.log('Map: Processing narration from source:', source || 'unknown');
                window.focusPlaceOnMap?.(text);
            } catch { /* ignore */ }
        };

        window.addEventListener('santi:narrate', onNarration as EventListener);
        // Remove listener on cleanup
        return () => {
            window.removeEventListener('santi:narrate', onNarration as EventListener);
        };
    }, [isMapReady, attractions, userLocation, drawRoute]);

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
            <div 
                ref={mapContainer} 
                tabIndex={-1}
                style={{ width: '100%', height: '100%', borderRadius: '12px' }}
                onFocus={(e) => {
                    // Prevenir que el mapa tome foco, especialmente durante animaciones
                    if (isAnimating) {
                        console.log('🗺️ Map: Previniendo foco durante animación');
                        e.preventDefault();
                        e.stopPropagation();
                        // Remover foco si se logró obtener
                        if (document.activeElement === e.target) {
                            (e.target as HTMLElement).blur();
                        }
                        return false;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onKeyDown={(e) => {
                    // Prevenir navegación por teclado durante animaciones
                    if (isAnimating) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}
            />
            
            {/* Overlay de Google Maps cuando hay ruta activa */}
            {activeRoute && (
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    background: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    zIndex: 1000,
                    maxWidth: '200px'
                }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A3A6C', marginBottom: '8px' }}>
                        🗺️ Ruta a {activeRoute.name}
                    </div>
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&origin=${activeRoute.start[1]},${activeRoute.start[0]}&destination=${activeRoute.end[1]},${activeRoute.end[0]}`}
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            background: '#4285F4',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#3367D6';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#4285F4';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <span>🚗</span>
                        <span>Google Maps</span>
                    </a>
                </div>
            )}
        </div>
    );
};

export default Map;
