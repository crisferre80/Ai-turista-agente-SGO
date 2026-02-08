"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

declare global {
    interface Window {
        santiNarrate?: (text: string) => void;
        santiSpeak?: (text: string) => void;
        focusPlaceOnMap?: (placeName: string) => void;
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
        testSantiAnimation?: () => void;
        forceSantiSpeaking?: (speaking: boolean) => void;
    }
}

const COLOR_RED = "#9E1B1B";
const COLOR_BLUE = "#1A3A6C";
const COLOR_GOLD = "#F1C40F";

const ChatInterface = ({ externalTrigger, externalStory, isModalOpen, userLocation }: {
    externalTrigger?: string,
    externalStory?: { url: string, name: string },
    isModalOpen?: boolean,
    userLocation?: { latitude: number; longitude: number } | null
}) => {
    const router = useRouter();
    
    // State
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showHistory, setShowHistory] = useState(false); // Toggle for full chat history
    const [audioBlocked, setAudioBlocked] = useState(false); // Handle autoplay block
    const [displayedText, setDisplayedText] = useState(''); // Typewriter effect text
    const [isIdle, setIsIdle] = useState(false); // For auto-hide
    const [isHovering, setIsHovering] = useState(false); // Hover state for bubble
    const [showBubbleManual, setShowBubbleManual] = useState(false); // Manual click toggle for bubble
    const [isMicHover, setIsMicHover] = useState(false); // Hover/focus state for mic legend
    const [promotionalMessages, setPromotionalMessages] = useState<string[]>([]); // Promotional messages from DB
    const [showVideoModal, setShowVideoModal] = useState(false); // Modal de video
    const [currentVideo, setCurrentVideo] = useState<{ title: string; url: string; videos?: { id: string; title: string; url: string; thumbnail: string; channelTitle: string; description: string }[] } | null>(null); // Video actual o lista de videos
    const [showVideoList, setShowVideoList] = useState(false); // Mostrar lista de videos de YouTube

    // External triggers effects will be registered after callbacks are defined

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastInteractionRef = useRef(Date.now()); // Track inactivity
    const micHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout to auto-hide mic legend on touch

    const [engagementPrompts, setEngagementPrompts] = useState<string[]>([]);

    useEffect(() => {
        loadGuestPrompts();
        fetchCloudPhrases();
        fetchPromotionalMessages();
    }, []);

    const loadGuestPrompts = () => {
        // Frases para visitantes no registrados (incluyen preguntas personales)
        const guestPrompts = [
            "¿Hay algo en que pueda ayudarte?",
            "¿De dónde nos visitas?",
            "¿Cómo te llamas?",
            "¿Cuál es tu edad?",
            "Cuanto más sepa de vos, mejor podré guiarte.",
            "¿Te gustaría conocer algún lugar histórico?",
            "¿Sabías que Santiago es la Madre de Ciudades?",
            "Si buscas comida rica, puedo recomendarte lugares."
        ];
        setEngagementPrompts(guestPrompts);
    };

    const fetchCloudPhrases = async () => {
        const { data } = await supabase.from('santis_phrases').select('phrase');
        if (data && data.length > 0) {
            const cloudPhrases = data.map((d: { phrase: string }) => d.phrase);
            setEngagementPrompts(prev => [...prev, ...cloudPhrases]);
        }
    };

    const fetchPromotionalMessages = async () => {
        const { data } = await supabase
            .from('promotional_messages')
            .select('message')
            .eq('is_active', true)
            .order('priority', { ascending: false });
        
        if (data && data.length > 0) {
            const messages = data.map((d: { message: string }) => d.message);
            setPromotionalMessages(messages);
            console.log('📢 Loaded promotional messages:', messages.length);
        }
    };

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const updateInteractionTime = () => {
        lastInteractionRef.current = Date.now();
    };

    useEffect(() => {
        if (showHistory) {
            scrollToBottom();
        }
    }, [messages, isThinking, showHistory]);

    // Format messages for API
    const getApiMessages = useCallback(() => {
        return messages.map(m => ({ role: m.role, content: m.content }));
    }, [messages]);

    // Helper to get the content to show
    const getLastAssistantMessage = useCallback(() => {
        const assistantMsgs = messages.filter(m => m.role === 'assistant');
        if (assistantMsgs.length === 0) return null;
        return assistantMsgs[assistantMsgs.length - 1].content;
    }, [messages]);

    // Idle / Auto-hide logic will be registered after callbacks are defined

    // Debug: Monitor isSpeaking state changes
    useEffect(() => {
        console.log(`🎭 Santi Animation State: isSpeaking = ${isSpeaking} ${isSpeaking ? '(ANIMADO 🎬)' : '(ESTÁTICO 📸)'}`);
        console.log(`🖼️ Image URL will be: ${isSpeaking ? 'guiarobotalpha_vv5jbj.webp (ANIMATED)' : 'guiarobotalpha_vv5jbj.png (STATIC)'}`);
    }, [isSpeaking]);

    // Global access for triggers will be registered after callbacks are defined

    // Typewriter Effect Logic will be registered after callbacks are defined

    // Helper function to clean text for speech
    const cleanTextForSpeech = useCallback((text: string): string => {
        return text
            // Remove markdown formatting
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold markdown **text** -> text
            .replace(/\*(.*?)\*/g, '$1') // Italic markdown *text* -> text
            .replace(/`(.*?)`/g, '$1') // Code markdown `text` -> text
            .replace(/#{1,6}\s/g, '') // Headers # ## ### -> remove
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links [text](url) -> text
            .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // Images ![alt](url) -> alt
            // Remove special characters that sound unnatural
            .replace(/[_~\[\]{}|\\<>]/g, ' ') // Remove underscores, tildes, brackets, etc.
            .replace(/\n+/g, '. ') // Replace newlines with periods for natural pauses
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            // Make it more conversational
            .replace(/\b(USD|ARS|\$)\s*(\d+)/gi, '$2 pesos') // Currency formatting
            .replace(/\bkm\b/gi, 'kilómetros') // Abbreviations
            .replace(/\bm\b(?=\s|$)/gi, 'metros') // Meters
            .replace(/&/g, 'y') // Ampersands
            .replace(/\s+\./g, '.') // Remove spaces before periods
            .trim();
    }, []);

    // Voice commands help state
    const [showVoiceHelp, setShowVoiceHelp] = useState(false);

    // Text-to-Speech Helper
    const playAudioResponse = useCallback(async (text: string, force = false) => {
        // Clean text for natural speech
        const cleanText = cleanTextForSpeech(text);
        console.log('🎵 ChatInterface: playAudioResponse called with text:', text.substring(0, 50), 'cleaned:', cleanText.substring(0, 50), 'force:', force);
        
        // Si no es forzado, evitar llamadas duplicadas si ya hay audio reproduciéndose
        if (!force && audioRef.current && !audioRef.current.paused) {
            console.log('ChatInterface: Audio already playing, ignoring duplicate request');
            return;
        }
        
        // Si es forzado, detener audio actual
        if (force && audioRef.current && !audioRef.current.paused) {
            console.log('🔇 ChatInterface: Force playback - stopping current audio');
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        
        console.log('ChatInterface: Making TTS request...');
        
        try {
            const response = await fetch('/api/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cleanText }), // Use cleaned text for TTS
            });

            if (response.status === 401) throw new Error("API_KEY_MISSING");
            if (!response.ok) throw new Error("Audio generation failed");

            // If server returned JSON (fallback instruction), parse and handle
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const payload = await response.json();
                console.log('ChatInterface: TTS endpoint returned JSON payload', payload);
                if (payload?.fallback) {
                    // Use browser TTS as fallback with cleaned text
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        const utter = new SpeechSynthesisUtterance(cleanText); // Use cleaned text
                        utter.lang = 'es-AR';
                        const voices = window.speechSynthesis.getVoices();
                        utter.voice = voices.find(v => v.lang?.startsWith('es')) || null;
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(utter);
                        // Emit start event
                        window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text: cleanText } }));
                        // Emit end when finished
                        utter.onend = () => window.dispatchEvent(new CustomEvent('santi:narration:end'));
                        return;
                    } else {
                        console.warn('Browser TTS not available, fallback requested');
                        throw new Error('TTS fallback requested but browser TTS unavailable');
                    }
                }
                throw new Error(payload?.message || 'TTS server returned JSON');
            }

            const blob = await response.blob();
            console.log('🎵 ChatInterface: Got audio blob, size:', blob.size);
            
            // Validate blob
            if (!blob || blob.size === 0) {
                throw new Error('Received empty audio blob from TTS service');
            }
            
            console.log('ChatInterface: Received audio blob, size:', blob.size, 'type:', blob.type);
            const url = URL.createObjectURL(blob);
            console.log('🎵 ChatInterface: Created object URL, length:', url.length);

            if (audioRef.current) {
                console.log('🎵 ChatInterface: Setting up audio element...');
                // Clear previous handlers
                audioRef.current.onended = null;
                audioRef.current.onerror = null;
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.src = url;
                
                // Validate audio element before playing
                if (!audioRef.current.src || audioRef.current.src === '') {
                    console.error('Audio src not set correctly');
                    URL.revokeObjectURL(url);
                    throw new Error('Audio source not set');
                }
                
                console.log('ChatInterface: Audio element configured, src length:', audioRef.current.src.length);
                
                // Set up end handler to emit event
                audioRef.current.onended = () => {
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narration:end'));
                    }
                    URL.revokeObjectURL(url);
                };
                
                audioRef.current.onerror = (ev) => {
                    try {
                        const error = audioRef.current?.error;
                        const errorDetails = {
                            code: error?.code,
                            message: error?.message,
                            src: audioRef.current?.src?.substring(0, 100),
                            networkState: audioRef.current?.networkState,
                            readyState: audioRef.current?.readyState,
                            event: (ev as Event)?.type
                        };
                        console.error('Audio playback error:', errorDetails);
                        // Also log to console for easier debugging
                        console.error('Audio element error object:', error);
                        console.error('Audio element event:', ev);
                    } catch (e) {
                        console.error('Audio onerror handler exception:', e);
                    }
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narration:end'));
                    }
                };

                // Play and emit start event BEFORE attempting to play (to ensure animation starts)
                // Emit start event immediately for UI responsiveness
                if (typeof window !== 'undefined') {
                    console.log('🎵 ChatInterface: Emitting narration start event');
                    window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text: cleanText } }));
                }
                
                audioRef.current.play().then(() => {
                    console.log('🔊 ChatInterface: Audio playing successfully');
                }).catch(err => {
                    if (err.name !== 'AbortError') {
                        console.warn("Autoplay blocked:", err);
                        setAudioBlocked(true);
                        // Animation already started above, so no need to emit again
                    }
                });
            }
        } catch (error: unknown) {
            console.error("TTS Error:", error);
            // Emit end event on error
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('santi:narration:end'));
            }
            if (typeof error === 'object' && error && (error as { message?: string }).message === "API_KEY_MISSING") {
                alert("Santi no puede hablar porque falta la OPENAI_API_KEY");
            } else if (typeof error === 'object' && error && (error as { message?: string }).message) {
                console.error("TTS failed with message:", (error as { message: string }).message);
            } else {
                console.error("TTS failed with unknown error:", error);
            }
        }
    }, [cleanTextForSpeech]);

    // Auto-promotion system
    useEffect(() => {
        const checkAutoPromotions = async () => {
            if (isSpeaking || isListening || isLoading || isThinking || showHistory) {
                return;
            }

            // Verificar si han pasado al menos 30 segundos desde la última interacción
            const timeSinceLastInteraction = Date.now() - lastInteractionRef.current;
            if (timeSinceLastInteraction < 30000) { // 30 segundos
                return;
            }

            try {
                const response = await fetch('/api/auto-promotion');
                if (response.ok) {
                    const data = await response.json();
                    if (data.shouldShow && data.promotion) {
                        console.log('🤖 Santi: Mostrando promoción automática:', data.promotion.title);
                        
                        // Agregar mensaje como asistente
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `🎯 **${data.promotion.business_name}**: ${data.promotion.message}`
                        }]);

                        // Reproducir audio
                        playAudioResponse(data.promotion.message, true);
                        
                        // Actualizar tiempo de interacción para evitar spam
                        updateInteractionTime();
                    }
                }
            } catch (error) {
                console.error('❌ Error checking auto-promotions:', error);
            }
        };

        // Verificar promociones automáticas cada 2 minutos
        const autoPromotionInterval = setInterval(checkAutoPromotions, 120000); // 2 minutos

        return () => clearInterval(autoPromotionInterval);
    }, [isSpeaking, isListening, isLoading, isThinking, showHistory, playAudioResponse]);

    const triggerAssistantMessage = useCallback((text: string, skipMapFocus = false) => {
        updateInteractionTime();
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        playAudioResponse(text);

        // Trigger map focus if a place is mentioned and not explicitly skipped
        if (!skipMapFocus && typeof window !== 'undefined' && 'focusPlaceOnMap' in window && typeof (window as Window & typeof globalThis).focusPlaceOnMap === 'function') {
            (window as Window & typeof globalThis).focusPlaceOnMap!(text);
        }
    }, [playAudioResponse]);

    // Send Message Logic
    const handleSend = useCallback(async (overrideText?: string) => {
        updateInteractionTime(); // Reset timer
        const textToSend = overrideText || input;
        if (!textToSend.trim()) return;

        // Add User Message
        const userMsg = { role: 'user' as const, content: textToSend };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setIsThinking(true);

        try {
            // Obtener token del usuario autenticado
            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            // Call Chat API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    messages: [...getApiMessages(), { role: 'user', content: textToSend }],
                    userLocation: userLocation || undefined
                }),
            });

            const bodyText = await response.text();
            if (!response.ok) {
                console.error('ChatInterface: /api/chat error', response.status, bodyText);
                let parsed;
                try { parsed = JSON.parse(bodyText); } catch { parsed = null; }
                throw new Error(parsed?.message || parsed?.error || `Chat API error ${response.status}`);
            }

            const data = JSON.parse(bodyText);
            
            // Manejar rate limit exceeded
            if (data.rateLimitExceeded) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
                setTimeout(() => setIsThinking(false), 600);
                setIsLoading(false);
                updateInteractionTime();
                return;
            }
            
            let botReply = data.reply || "Lo siento, tuve un problema al pensar. ¿Podrías repetir?";
            const placeId = data.placeId;
            const placeName = data.placeName;
            const isRouteOnly = data.isRouteOnly; // Flag para indicar consulta de ruta únicamente
            const relevantVideo = data.relevantVideo; // Video relevante si existe

            // Si hay video relevante, modificar la respuesta y preparar modal
            if (relevantVideo) {
                // Verificar si es una lista de videos de YouTube
                if (relevantVideo.isYouTubeList && relevantVideo.videos && relevantVideo.videos.length > 0) {
                    const videoCount = relevantVideo.videos.length;
                    botReply = `${botReply}\n\n¡Mirá! Encontré ${videoCount} videos sobre esto en YouTube. Elegí el que más te guste.`;
                    setCurrentVideo({ 
                        title: relevantVideo.title, 
                        url: '', 
                        videos: relevantVideo.videos 
                    });
                    setShowVideoList(true);
                    // Mostrar lista después de un pequeño delay
                    setTimeout(() => {
                        setShowVideoModal(true);
                    }, 1500);
                } else if (relevantVideo.url) {
                    // Video único (local o YouTube)
                    const videoTitle = relevantVideo.title;
                    botReply = `${botReply}\n\n¡Mirá! Te muestro imágenes de "${videoTitle}" para que lo veas mejor.`;
                    setCurrentVideo({ title: videoTitle, url: relevantVideo.url });
                    setShowVideoList(false);
                    // Mostrar modal después de un pequeño delay
                    setTimeout(() => {
                        setShowVideoModal(true);
                    }, 1500);
                }
            }

            console.log('Chat API response:', { botReply: botReply.substring(0, 50), placeId, placeName, isRouteOnly, hasVideo: !!relevantVideo });

            // Add Assistant Message
            setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);

            // Si es consulta de ruta (isRouteOnly), desactivar thinking inmediatamente
            // y NO navegar a la página de detalles
            if (isRouteOnly) {
                setTimeout(() => {
                    setIsThinking(false);
                }, 600);
            } else if (!placeId) {
                // Si no hay placeId, también desactivar thinking
                setTimeout(() => {
                    setIsThinking(false);
                }, 600);
            }
            // Si hay placeId y NO es isRouteOnly, isThinking se apagará con narration:start

            console.log('🎵 ChatInterface: Checking isRouteOnly flag:', isRouteOnly, 'botReply preview:', botReply.substring(0, 50));
            
            // Speak the response (except for route queries, which are narrated by the map)
            if (!isRouteOnly) {
                console.log('🎵 ChatInterface: Playing audio response (not route query)');
                playAudioResponse(botReply);
            } else {
                console.log('🎵 ChatInterface: Skipping audio response (route query detected)');
            }
            
            // Solo navegar a detail page si hay placeId Y NO es consulta de ruta
            if (placeId && !isRouteOnly && typeof window !== 'undefined') {
                // Store that we're narrating about this place
                // Use sessionStorage as fallback if localStorage is blocked
                const setStorage = (key: string, value: string) => {
                    try {
                        localStorage.setItem(key, value);
                    } catch {
                        try {
                            sessionStorage.setItem(key, value);
                        } catch {
                            console.warn('Storage blocked, narration may not show on detail page');
                        }
                    }
                };
                
                try {
                    console.log('ChatInterface: Storing narration data before navigation:', {
                        placeId,
                        textLength: botReply.length
                    });
                    setStorage('santi:narratingPlace', placeId);
                    setStorage('santi:narratingText', botReply);
                    // Navigate with enough delay to ensure storage completes
                    setTimeout(() => {
                        console.log('ChatInterface: Navigating to place detail page');
                        router.push(`/explorar/${placeId}`);
                    }, 500); // Increased to 500ms to ensure localStorage saves properly
                } catch (err) {
                    console.error('Navigation error:', err);
                }
            }

            // Si es consulta de ruta, usar placeName de la respuesta de API para enfocar mapa
            // Esto es más preciso que extraer del mensaje del usuario
            if (isRouteOnly && typeof window !== 'undefined' && 'focusPlaceOnMap' in window && typeof (window as Window & typeof globalThis).focusPlaceOnMap === 'function') {
                if (placeName) {
                    console.log('Route query: Focusing map on place from API:', placeName);
                    (window as Window & typeof globalThis).focusPlaceOnMap!(placeName);
                } else {
                    // Si no se encontró placeName en la respuesta, intentar extraer del mensaje del usuario
                    console.log('Route query: placeName not found in API response, trying to extract from user message');
                    const placeMatch = textToSend.match(/(?:a\s+|al\s+|hacia\s+|para\s+|llegar a\s+|ir a\s+|voy a\s+)([^?.,]+)/i);
                    if (placeMatch) {
                        const extractedPlace = placeMatch[1].trim();
                        console.log('Route query: Extracted place from user message:', extractedPlace);
                        (window as Window & typeof globalThis).focusPlaceOnMap!(extractedPlace);
                    } else {
                        console.warn('Route query: Could not extract place name from user message');
                    }
                }
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Ocurrió un error al contactar a mi cerebro digital. Intenta más tarde." }]);
            setIsThinking(false);
        } finally {
            setIsLoading(false);
            updateInteractionTime(); // Reset timer again after response
        }
    }, [input, getApiMessages, playAudioResponse, router, userLocation]);

    // Voice navigation command processor - defined after triggerAssistantMessage and playAudioResponse
    const processVoiceNavigationCommand = useCallback((transcript: string): boolean => {
        const lowerTranscript = transcript.toLowerCase().trim();
        console.log('🎙️ Processing voice command:', lowerTranscript);
        
        // Helper to trigger messages without circular dependency
        const triggerMessage = (text: string) => {
            updateInteractionTime();
            setMessages(prev => [...prev, { role: 'assistant', content: text }]);
            // Call playAudioResponse directly if it exists
            if (typeof playAudioResponse === 'function') {
                playAudioResponse(text);
            }
        };

        // Helper for sending regular messages  
        const sendMessage = (text: string) => {
            setInput(text);
            // Call handleSend directly if it exists
            if (typeof handleSend === 'function') {
                handleSend(text);
            }
        };
        
        // Navigation commands
        const navigationCommands = [
            // Home/Main page
            { 
                keywords: ['inicio', 'página principal', 'home', 'principal', 'ir al inicio', 'volver al inicio'],
                action: () => {
                    router.push('/');
                    triggerMessage('Te llevo al inicio, chango.');
                }
            },
            // Explore/Map
            {
                keywords: ['mapa', 'explorar', 'ver mapa', 'mostrar mapa', 'ir al mapa', 'exploración'],
                action: () => {
                    router.push('/explorar');
                    triggerMessage('Te llevo al mapa para explorar, chango.');
                }
            },
            // Profile
            {
                keywords: ['perfil', 'mi perfil', 'ver perfil', 'ir al perfil', 'configuración'],
                action: () => {
                    router.push('/profile');
                    triggerMessage('Te llevo a tu perfil, chango.');
                }
            },
            // Dashboard (for admins)
            {
                keywords: ['dashboard', 'panel', 'administración', 'admin', 'ir al dashboard'],
                action: () => {
                    router.push('/dashboard');
                    triggerMessage('Te llevo al panel de administración, chango.');
                }
            },
            // Go back
            {
                keywords: ['atrás', 'volver', 'regresar', 'ir atrás', 'página anterior'],
                action: () => {
                    router.back();
                    triggerMessage('Volvemos atrás, chango.');
                }
            },
            // Refresh
            {
                keywords: ['actualizar', 'refrescar', 'recargar', 'actualizar página'],
                action: () => {
                    window.location.reload();
                    triggerMessage('Actualizando la página, chango.');
                }
            },
            // Audio control commands
            {
                keywords: ['silencio', 'cállate', 'para', 'detener', 'basta', 'stop'],
                action: () => {
                    // Stop current narration
                    if (audioRef.current && !audioRef.current.paused) {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                        setIsSpeaking(false);
                    }
                    // Also trigger global stop
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narration:end'));
                    }
                    triggerMessage('Me quedo callado, chango.');
                }
            },
            {
                keywords: ['repetir', 'repite', 'otra vez', 'de nuevo'],
                action: () => {
                    // Get last assistant message and repeat it
                    const lastAssistantMessage = messages.findLast(m => m.role === 'assistant');
                    if (lastAssistantMessage && typeof playAudioResponse === 'function') {
                        playAudioResponse(lastAssistantMessage.content);
                        triggerMessage('Te repito lo último, chango.');
                    }
                }
            }
        ];

        // Check for navigation commands
        for (const command of navigationCommands) {
            if (command.keywords.some(keyword => lowerTranscript.includes(keyword))) {
                console.log('🎯 Voice navigation command detected:', command.keywords[0]);
                command.action();
                return true; // Command processed
            }
        }

        // Check for search commands
        const searchPatterns = [
            /^buscar (.+)$/i,
            /^busca (.+)$/i,
            /^búsqueda de (.+)$/i,
            /^encuentra (.+)$/i,
            /^encontrar (.+)$/i
        ];

        for (const pattern of searchPatterns) {
            const match = lowerTranscript.match(pattern);
            if (match && match[1]) {
                console.log('🔍 Voice search command detected:', match[1]);
                sendMessage(match[1]);
                triggerMessage(`Buscando ${match[1]}, chango.`);
                return true; // Command processed
            }
        }

        return false; // No navigation command found
    }, [router, setInput, audioRef, setIsSpeaking, messages, playAudioResponse, handleSend]);

    const playUserStory = useCallback(async (url: string, name: string) => {
        updateInteractionTime();
        const intro = `¡Epa! Mirá lo que grabó un viajero sobre ${name}. Prestá atención...`;

        // Add intro message
        setMessages(prev => [...prev, { role: 'assistant', content: intro }]);

        try {
            // First, Santi says the intro
            const response = await fetch('/api/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: intro }),
            });
            const blob = await response.blob();
            const introUrl = URL.createObjectURL(blob);

            if (audioRef.current) {
                audioRef.current.src = introUrl;
                audioRef.current.play();

                // When intro finishes, play the actual story
                audioRef.current.onended = () => {
                    if (audioRef.current) {
                        audioRef.current.src = url;
                        audioRef.current.play();
                        audioRef.current.onended = null; // Reset
                    }
                };
            }
        } catch (error) {
            console.error("Story Playback Error:", error);
        }
    }, []);

    // Helper: detect if a message is a business registration prompt
    const isBusinessPromptText = (text?: string | null) => {
        if (!text) return false;
        const pattern = /(Mi Negocio|registrar un negocio|aparezca en la app|destacad|Comercio Certificado|registrarlo|Mi Negocio)/i;
        return pattern.test(text) || promotionalMessages.some(p => (text || '').includes(p));
    };

    // Handler for 'Llevame' button - redirect depending on auth state
    const handleLlevameClick = async () => {
        try {
            // supabase.auth.getUser() returns { data: { user } }
            const { data } = await supabase.auth.getUser();
            const user = (data as { user?: unknown })?.user;
            if (user) {
                window.location.href = '/mi-negocio';
            } else {
                window.location.href = '/login?next=/mi-negocio';
            }
        } catch (err) {
            console.error('Redirect error:', err);
            window.location.href = '/login?next=/mi-negocio';
        }
    };


    // External triggers effects
    useEffect(() => {
        if (externalTrigger) {
            triggerAssistantMessage(externalTrigger);
        }
    }, [externalTrigger, triggerAssistantMessage]);

    useEffect(() => {
        if (externalStory) {
            playUserStory(externalStory.url, externalStory.name);
        }
    }, [externalStory, playUserStory]);

    // Idle / Auto-hide logic
    useEffect(() => {
        const checkInterval = setInterval(() => {
            const timeSinceLast = Date.now() - lastInteractionRef.current;
            const idleTime = 30000; // 30 seconds

            if (timeSinceLast >= idleTime && !isSpeaking && !isThinking && !isListening && !input.trim()) {
                setIsIdle(true);
                setShowHistory(false);
            } else {
                setIsIdle(false);
            }

            // Proactive Engagement (includes occasional promotional messages from DB)
            if (timeSinceLast >= 120000 && !isSpeaking && !isThinking && !isListening && !input.trim()) {
                // 25% chance to show a promotional message (if available)
                const pickPromotion = Math.random() < 0.25 && promotionalMessages.length > 0;
                const prompt = pickPromotion
                    ? promotionalMessages[Math.floor(Math.random() * promotionalMessages.length)]
                    : engagementPrompts[Math.floor(Math.random() * engagementPrompts.length)];
                console.log('🎯 Proactive engagement:', pickPromotion ? 'PROMOTIONAL' : 'regular', prompt.substring(0, 50));
                triggerAssistantMessage(prompt);
                updateInteractionTime();
            }
        }, 5000);

        return () => clearInterval(checkInterval);
    }, [isSpeaking, isThinking, isListening, input, engagementPrompts, promotionalMessages, triggerAssistantMessage]);

    // Global access for triggers
    useEffect(() => {
        console.log('🎯 ChatInterface: Setting up event listeners');
        
        // Turn off thinking modal when narration starts (even on other pages)
        const handleNarrationStart = () => {
            console.log('🎯 ChatInterface: Narration START - hiding thinking modal and setting isSpeaking to true');
            console.log('🎭 Before: isSpeaking was', isSpeaking);
            setIsThinking(false);
            setIsSpeaking(true);
            console.log('🎭 After: isSpeaking set to true');
        };

        const handleNarrationEnd = () => {
            console.log('🎯 ChatInterface: Narration END - setting isSpeaking to false');
            setIsSpeaking(false);
        };
        
        // Listen for narration events from other components (like PlaceDetailClient)
        const handleNarrate = (event: Event) => {
            const customEvent = event as CustomEvent<{ text: string; source?: string; force?: boolean }>;
            const { text, source, force } = customEvent.detail;
            
            console.log('🎯 ChatInterface: Received narration event from', source, 'with force:', force, 'text preview:', text?.substring(0, 30));
            
            // Para intro-welcome: agregar al chat pero no reproducir audio adicional (ya se reproduce en santiSpeak)
            if (source === 'intro-welcome') {
                console.log('ChatInterface: Adding intro message to chat without additional audio');
                setMessages(prev => [...prev, { role: 'assistant', content: text }]);
                return;
            }
            
            // Si es una narración de ruta con force=true, interrumpir audio actual y reproducir
            if (source === 'map-route' && force) {
                console.log('🚨 ChatInterface: High priority route narration - interrupting current audio');
                // Reproducir la narración de ruta con force=true
                playAudioResponse(text, true);
                // Agregar al chat
                setMessages(prev => [...prev, { role: 'assistant', content: text }]);
                return;
            }
            
            // Ignorar otras narraciones del mapa si no tienen force=true
            if (source && source.startsWith('map') && !force) {
                console.log('ChatInterface: Ignoring map narration without force flag');
                return;
            }
            
            // Manejar narraciones de place-detail (siempre reproducir)
            if (source === 'place-detail') {
                console.log('🔄 ChatInterface: Playing narration from place-detail, force:', force);
                playAudioResponse(text, force || false);
                setMessages(prev => [...prev, { role: 'assistant', content: text }]);
                return;
            }
            
            if (text && source !== 'chat') {
                console.log('ChatInterface: Received narration from', source, '- adding to chat and playing audio');
                // Agregar el mensaje al chat y reproducir audio
                setMessages(prev => [...prev, { role: 'assistant', content: text }]);
                playAudioResponse(text);
            }
        };
        
        window.addEventListener('santi:narration:start', handleNarrationStart);
        window.addEventListener('santi:narration:end', handleNarrationEnd);
        window.addEventListener('santi:narrate', handleNarrate);
        
        // Global voice navigation activation
        const activateVoiceNav = () => {
            if (!isListening && typeof window !== 'undefined') {
                toggleListening();
            }
        };
        
        // Add keyboard shortcut for voice activation (Ctrl+Shift+V)
        const handleKeyboard = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
                e.preventDefault();
                activateVoiceNav();
            }
        };
        
        window.addEventListener('activate-voice-nav', activateVoiceNav);
        window.addEventListener('keydown', handleKeyboard);
        
        console.log('🎯 ChatInterface: Event listeners registered successfully');
        
        window.santiNarrate = (text: string) => {
            handleSend(text);
        };
        window.santiSpeak = (text: string) => {
            triggerAssistantMessage(text, true); // Skip focus to avoid loops
        };
        
        // Debug functions for testing animation
        window.testSantiAnimation = () => {
            console.log('🧪 Testing Santi animation...');
            setIsSpeaking(prev => {
                console.log('Current isSpeaking state:', prev);
                console.log('Toggled to:', !prev);
                return !prev;
            });
        };
        
        window.forceSantiSpeaking = (speaking: boolean) => {
            console.log('🎯 Force setting Santi speaking to:', speaking);
            setIsSpeaking(speaking);
        };
        return () => {
            window.removeEventListener('santi:narration:start', handleNarrationStart);
            window.removeEventListener('santi:narration:end', handleNarrationEnd);
            window.removeEventListener('santi:narrate', handleNarrate);
            window.removeEventListener('activate-voice-nav', activateVoiceNav);
            window.removeEventListener('keydown', handleKeyboard);
            if (window.santiNarrate) delete window.santiNarrate;
            if (window.santiSpeak) delete window.santiSpeak;
            if (window.testSantiAnimation) delete window.testSantiAnimation;
            if (window.forceSantiSpeaking) delete window.forceSantiSpeaking;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleSend, triggerAssistantMessage, playAudioResponse, isSpeaking, isListening]);

    // Cleanup mic hover timeout on unmount
    useEffect(() => {
        return () => {
            if (micHoverTimeoutRef.current) {
                clearTimeout(micHoverTimeoutRef.current);
                micHoverTimeoutRef.current = null;
            }
        };
    }, []);

    // Typewriter Effect Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isSpeaking) {
            const fullText = getLastAssistantMessage() || "";
            setDisplayedText("");
            let currentIndex = 0;
            const typingSpeed = 40;

            interval = setInterval(() => {
                if (currentIndex <= fullText.length) {
                    setDisplayedText(fullText.slice(0, currentIndex));
                    currentIndex++;
                } else {
                    clearInterval(interval);
                }
            }, typingSpeed);
        } else {
            setDisplayedText("");
        }

        return () => clearInterval(interval);
    }, [isSpeaking, getLastAssistantMessage, messages]);

    // Voice Recognition (Speech-to-Text)
    interface ISpeechRecognition {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onstart: (() => void) | null;
        onerror: ((event: { error?: string }) => void) | null;
        onend: (() => void) | null;
        onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
        start: () => void;
    }

    const toggleListening = () => {
        updateInteractionTime();
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Tu navegador no soporta entrada de voz. Intenta usar Chrome.");
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        // Initialize
        const SR: unknown = (window as Window & typeof globalThis).SpeechRecognition || (window as Window & typeof globalThis).webkitSpeechRecognition;
        if (typeof SR !== 'function') {
            alert("El motor de reconocimiento no está disponible.");
            return;
        }

        const recognition = new (SR as new () => ISpeechRecognition)();
        recognition.lang = 'es-AR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            console.log("Voice recognition started");
            setIsListening(true);
        };

        recognition.onerror = (event: { error?: string }) => {
            setIsListening(false);
            if (event.error === 'no-speech') {
                console.log("Speech recognition info: no-speech detected (user was silent)");
            } else {
                console.error("Speech recognition error", event.error);
                if (event.error === 'not-allowed') {
                    alert("Permiso denegado. Asegurate de usar HTTPS o localhost para que el micrófono funcione.");
                } else {
                    alert("Error de voz: " + event.error);
                }
            }
        };

        recognition.onend = () => {
            console.log("Voice recognition ended");
            setIsListening(false);
            updateInteractionTime();
        };

        recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
            const transcript = event.results?.[0]?.[0]?.transcript;
            console.log("Result received:", transcript);
            if (transcript) {
                // First, check if it's a voice navigation command
                const isNavigationCommand = processVoiceNavigationCommand(transcript);
                
                // If not a navigation command, process as normal chat
                if (!isNavigationCommand) {
                    handleSend(transcript);
                }
            }
        };

        try {
            recognition.start();
        } catch (e: unknown) {
            console.error("Start error:", e);
            setIsListening(false);
        }
    };

    return (
        <div
            onClick={() => { if (isIdle) { setIsIdle(false); updateInteractionTime(); } }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#333', position: 'relative' }}
        >
            <audio
                ref={audioRef}
                style={{ display: 'none' }}
                onPlay={() => {
                    console.log('🎵 ChatInterface: Audio started playing - setting isSpeaking to true');
                    setIsSpeaking(true);
                }}
                onEnded={() => {
                    console.log('🔇 ChatInterface: Audio ended - setting isSpeaking to false');
                    setIsSpeaking(false);
                }}
                onPause={() => {
                    console.log('⏸️ ChatInterface: Audio paused - setting isSpeaking to false');
                    setIsSpeaking(false);
                }}
                onLoadStart={() => {
                    console.log('📋 ChatInterface: Audio load started');
                }}
                onCanPlay={() => {
                    console.log('✅ ChatInterface: Audio can play');
                }}
                onError={(e) => {
                    console.error('❌ ChatInterface: Audio error', e);
                    setIsSpeaking(false);
                }}
            />

            {/* THINKING MODAL */}
            {isThinking && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(8px)',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: 24,
                        padding: '40px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 20,
                        maxWidth: '90%',
                        animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <Image
                            src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768537502/bombo_alpha_ud09ok.webp"
                            alt="Santi pensando"
                            width={120}
                            height={120}
                            unoptimized
                            style={{
                                width: 120,
                                height: 120,
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))'
                            }}
                        />
                        <div style={{
                            textAlign: 'center'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '1.4rem',
                                fontWeight: 900,
                                color: COLOR_BLUE,
                                marginBottom: 8
                            }}>
                                Santi está pensando...
                            </h3>
                            <p style={{
                                margin: 0,
                                fontSize: '1rem',
                                color: '#64748b',
                                fontWeight: 500
                            }}>
                                Esperá un momento, estoy buscando la mejor respuesta para vos
                            </p>
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: 8
                        }}>
                            <div style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: COLOR_GOLD,
                                animation: 'bounce 1.4s infinite ease-in-out'
                            }} />
                            <div style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: COLOR_RED,
                                animation: 'bounce 1.4s infinite ease-in-out 0.2s'
                            }} />
                            <div style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: COLOR_BLUE,
                                animation: 'bounce 1.4s infinite ease-in-out 0.4s'
                            }} />
                        </div>
                    </div>
                </div>
            )}

            {/* VIDEO MODAL */}
            {showVideoModal && currentVideo && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 30000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(10px)',
                    animation: 'fadeIn 0.3s ease-out',
                    padding: window.innerWidth < 768 ? '10px' : '20px'
                }}
                onClick={() => {
                    setShowVideoModal(false);
                    setCurrentVideo(null);
                    setShowVideoList(false);
                }}
                >
                    <div style={{
                        background: 'white',
                        borderRadius: window.innerWidth < 768 ? 12 : 20,
                        padding: window.innerWidth < 768 ? '15px' : '30px',
                        boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: window.innerWidth < 768 ? 12 : 20,
                        maxWidth: window.innerWidth < 768 ? '98%' : '90%',
                        maxHeight: window.innerWidth < 768 ? '95%' : '90%',
                        width: window.innerWidth < 768 ? '100%' : (showVideoList ? '900px' : '800px'),
                        animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        position: 'relative',
                        overflowY: showVideoList ? 'auto' : 'visible'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    >
                        {/* Botón cerrar */}
                        <button
                            onClick={() => {
                                setShowVideoModal(false);
                                setCurrentVideo(null);
                            }}
                            style={{
                                position: 'absolute',
                                top: window.innerWidth < 768 ? 8 : 15,
                                right: window.innerWidth < 768 ? 8 : 15,
                                background: COLOR_RED,
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: window.innerWidth < 768 ? 35 : 40,
                                height: window.innerWidth < 768 ? 35 : 40,
                                fontSize: window.innerWidth < 768 ? '18px' : '20px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                transition: 'all 0.2s ease',
                                zIndex: 1
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                            }}
                        >
                            ✕
                        </button>

                        {/* Título */}
                        <div style={{ paddingRight: window.innerWidth < 768 ? '40px' : '50px' }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: window.innerWidth < 768 ? '1.1rem' : '1.5rem',
                                fontWeight: 900,
                                color: COLOR_BLUE,
                                marginBottom: 8
                            }}>
                                {showVideoList ? 'Videos de YouTube' : currentVideo.title}
                            </h3>
                            <p style={{
                                margin: 0,
                                fontSize: window.innerWidth < 768 ? '0.85rem' : '0.95rem',
                                color: '#64748b',
                                fontWeight: 500
                            }}>
                                {showVideoList ? 'Elegí el video que más te guste' : 'Mirá este video que encontré para vos'}
                            </p>
                        </div>

                        {/* Lista de videos de YouTube o video único */}
                        {showVideoList && currentVideo.videos ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: window.innerWidth < 768 ? 10 : 15,
                                maxHeight: window.innerWidth < 768 ? '60vh' : '500px',
                                overflowY: 'auto',
                                paddingRight: '10px'
                            }}>
                                {currentVideo.videos.map((video: { id: string; title: string; url: string; thumbnail: string; channelTitle: string; description: string }) => (
                                    <div
                                        key={video.id}
                                        onClick={() => {
                                            setCurrentVideo({ title: video.title, url: video.url });
                                            setShowVideoList(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: window.innerWidth < 768 ? 'column' : 'row',
                                            gap: window.innerWidth < 768 ? 10 : 15,
                                            padding: window.innerWidth < 768 ? 12 : 15,
                                            background: '#f8fafc',
                                            borderRadius: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            border: '2px solid transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#e0f2fe';
                                            e.currentTarget.style.borderColor = COLOR_BLUE;
                                            e.currentTarget.style.transform = 'scale(1.02)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f8fafc';
                                            e.currentTarget.style.borderColor = 'transparent';
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                    >
                                        <Image
                                            src={video.thumbnail}
                                            alt={video.title}
                                            width={window.innerWidth < 768 ? 320 : 160}
                                            height={window.innerWidth < 768 ? 180 : 90}
                                            style={{
                                                width: window.innerWidth < 768 ? '100%' : 160,
                                                height: window.innerWidth < 768 ? 'auto' : 90,
                                                aspectRatio: window.innerWidth < 768 ? '16/9' : 'auto',
                                                objectFit: 'cover',
                                                borderRadius: 8,
                                                flexShrink: 0
                                            }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{
                                                margin: 0,
                                                fontSize: window.innerWidth < 768 ? '0.95rem' : '1rem',
                                                fontWeight: 700,
                                                color: COLOR_BLUE,
                                                marginBottom: 6,
                                                lineHeight: 1.3,
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word'
                                            }}>
                                                {video.title}
                                            </h4>
                                            <p style={{
                                                margin: 0,
                                                fontSize: window.innerWidth < 768 ? '0.8rem' : '0.85rem',
                                                color: '#64748b',
                                                marginBottom: 4
                                            }}>
                                                {video.channelTitle}
                                            </p>
                                            <p style={{
                                                margin: 0,
                                                fontSize: window.innerWidth < 768 ? '0.75rem' : '0.8rem',
                                                color: '#94a3b8',
                                                lineHeight: 1.4,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word'
                                            }}>
                                                {video.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                position: 'relative',
                                paddingBottom: '56.25%', // 16:9 aspect ratio
                                height: 0,
                                overflow: 'hidden',
                                borderRadius: 12,
                                background: '#000',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                            }}>
                                <iframe
                                    src={`${currentVideo.url.replace('watch?v=', 'embed/')}${currentVideo.url.includes('?') ? '&' : '?'}autoplay=1&mute=0&controls=1`}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        borderRadius: 12
                                    }}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        )}

                        {/* Info adicional */}
                        <p style={{
                            margin: 0,
                            fontSize: window.innerWidth < 768 ? '0.8rem' : '0.85rem',
                            color: '#94a3b8',
                            textAlign: 'center',
                            fontStyle: 'italic'
                        }}>
                            {showVideoList ? 'Hacé clic en un video para verlo' : 'Podés cerrar este video cuando quieras y seguir charlando conmigo'}
                        </p>
                    </div>
                </div>
            )}

            {/* MAIN ROBOT DISPLAY & FLOATING BUBBLE */}
            <div className="robot-container" style={{
                position: 'fixed',
                bottom: isModalOpen ? '-120px' : '20px',
                left: '20px',
                zIndex: isSpeaking || isThinking || audioBlocked || displayedText || isHovering || showBubbleManual ? 40000 : 100,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-end' }} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
                    {/* The Robot (HOST POSITION - Always fixed and visible) */}
                    <Image
                        className={`robot-avatar ${isSpeaking ? 'active' : 'idle'}`}
                        src={isSpeaking
                            ? "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.webp"
                            : "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                        }
                        alt="Robot Guia Santi"
                        width={200}
                        height={200}
                        unoptimized
                        onClick={() => { setShowBubbleManual(prev => !prev); setIsIdle(false); updateInteractionTime(); }}
                        style={{
                            height: isSpeaking ? 'clamp(250px, 40vh, 450px)' : 'clamp(120px, 20vh, 200px)',
                            width: 'auto',
                            objectFit: 'contain',
                            opacity: 1,
                            pointerEvents: 'auto',
                            cursor: 'pointer'
                        }}
                    />

                    {/* The Floating Thought Bubble: only show when active, speaking, thinking, audioBlocked, hovered or manually toggled */}
                    {!showHistory && (isThinking || isSpeaking || audioBlocked || displayedText || isHovering || showBubbleManual) && (
                        <div className="thought-bubble-popup" style={{
                            position: 'absolute',
                            left: '50px',
                            bottom: '100%',
                            minWidth: '220px',
                            maxWidth: '300px',
                            pointerEvents: 'auto',
                            animation: 'popInBubble 0.3s ease-out forwards',
                            transition: 'all 0.5s ease',
                            cursor: audioBlocked ? 'pointer' : 'default',
                            borderBottomLeftRadius: '2px',
                            borderTopLeftRadius: '30px',
                            zIndex: 40001
                        }} onClick={() => {
                            if (audioBlocked && audioRef.current) {
                                setAudioBlocked(false);
                                audioRef.current.play();
                            }
                            // clicking the bubble counts as interaction and opens it
                            setShowBubbleManual(true);
                            updateInteractionTime();
                        }}>
                            {audioBlocked ? (
                                <div style={{ color: '#D2691E', fontWeight: 'bold' }}>
                                    🔇 Clic para activar sonido
                                </div>
                            ) : (
                                <div 
                                    style={{ 
                                        maxHeight: '150px', 
                                        overflowY: 'auto', 
                                        fontSize: '0.94rem', 
                                        color: 'white', 
                                        opacity: (isThinking || displayedText || isHovering || showBubbleManual) ? 1 : 0, 
                                        transition: 'opacity 0.3s ease' 
                                    }} 
                                    className="chat-hover-text"
                                >
                                    {isThinking
                                        ? <span className="thinking-dots">🧠 Pensando...</span>
                                        : (
                                            <div>
                                                <span style={{ whiteSpace: 'pre-wrap' }}>{displayedText || "¿En qué te ayudo?"}</span>
                                                {isBusinessPromptText(getLastAssistantMessage()) && (
                                                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                                                        <button
                                                            onClick={handleLlevameClick}
                                                            style={{ background: COLOR_GOLD, color: '#0e1f1d', border: 'none', padding: '8px 12px', borderRadius: 8, fontWeight: '800', cursor: 'pointer' }}
                                                        >
                                                            Llevame
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

           

            {/* INPUT AREA (Floating at bottom-right of footer) */}
            <div style={{
                position: 'fixed',
                bottom: '10px',
                right: '20px',
                left: 'auto',
                width: 'min(90%, 400px)',
                zIndex: 30005,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.5s ease'
            }}>
                {/* Instruction Legend (Aligned Right) - only visible on mic hover/focus */}
                {isMicHover && (
                  <div style={{
                      textAlign: 'right',
                      fontSize: '0.8rem',
                      color: COLOR_BLUE,
                      fontWeight: '600',
                      marginRight: '30px',
                      animation: 'pulseText 2s infinite'
                    }}>
                      ¡Presioná el mic y hablá! 👉
                  </div>
                )}

                <div style={{
                    display: 'flex',
                    gap: '8px',
                    background: 'rgba(255,255,255,1)',
                    padding: '8px',
                    borderRadius: '50px',
                    boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
                    border: `1px solid ${COLOR_BLUE}22`
                }}>
                    <button
                        onClick={() => handleSend()}
                        disabled={isLoading || (!input.trim() && !isListening)}
                        style={{
                            background: (isLoading || !input.trim()) ? '#f1f5f9' : COLOR_BLUE,
                            color: (isLoading || !input.trim()) ? '#94a3b8' : 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ➤
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={isListening ? "Te escucho..." : "Tu pregunta..."}
                        disabled={isLoading || isListening}
                        style={{
                            flex: 1,
                            padding: '0 30px',
                            borderRadius: '40px',
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.95rem',
                            background: 'transparent',
                            color: '#1e293b'
                        }}
                    />

                    <button
                        onClick={toggleListening}
                        onMouseEnter={() => setIsMicHover(true)}
                        onMouseLeave={() => setIsMicHover(false)}
                        onFocus={() => setIsMicHover(true)}
                        onBlur={() => setIsMicHover(false)}
                        onTouchStart={() => {
                            // Show the legend briefly on touch devices
                            setIsMicHover(true);
                            if (micHoverTimeoutRef.current) clearTimeout(micHoverTimeoutRef.current);
                            micHoverTimeoutRef.current = setTimeout(() => {
                                setIsMicHover(false);
                                micHoverTimeoutRef.current = null;
                            }, 2500);
                        }}
                        className={isListening ? 'listening-pulse' : ''}
                        style={{
                            background: isListening ? COLOR_RED : COLOR_GOLD,
                            color: isListening ? 'white' : '#000',
                            border: `none`,
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            flexShrink: 0,
                            marginRight: '8px'
                        }}
                    >
                        {isListening ? '⏹️' : '🎙️'}
                    </button>
                    
                    {/* Voice Commands Help Button */}
                    <button
                        onClick={() => setShowVoiceHelp(true)}
                        style={{
                            background: COLOR_BLUE,
                            color: 'white',
                            border: `none`,
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            flexShrink: 0
                        }}
                        title="Comandos de voz disponibles"
                    >
                        ❓
                    </button>
                </div>
            </div>

            {/* Voice Commands Help Modal */}
            {showVoiceHelp && (
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
                        borderRadius: '15px',
                        maxWidth: '90%',
                        width: '400px',
                        maxHeight: '80%',
                        overflow: 'auto',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <h3 style={{ margin: 0, color: COLOR_BLUE }}>🎙️ Comandos de Voz</h3>
                            <button
                                onClick={() => setShowVoiceHelp(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    padding: '5px'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                            <h4 style={{ color: COLOR_BLUE, marginBottom: '10px' }}>📍 Navegación</h4>
                            <ul style={{ marginBottom: '20px', paddingLeft: '20px' }}>
                                <li><strong>&quot;Inicio&quot;</strong> - Ir a la página principal</li>
                                <li><strong>&quot;Mapa&quot;</strong> - Explorar lugares</li>
                                <li><strong>&quot;Perfil&quot;</strong> - Ver mi perfil</li>
                                <li><strong>&quot;Atrás&quot;</strong> - Página anterior</li>
                                <li><strong>&quot;Actualizar&quot;</strong> - Recargar página</li>
                            </ul>
                            
                            <h4 style={{ color: COLOR_BLUE, marginBottom: '10px' }}>🔍 Búsqueda</h4>
                            <ul style={{ marginBottom: '20px', paddingLeft: '20px' }}>
                                <li><strong>&quot;Buscar restaurantes&quot;</strong></li>
                                <li><strong>&quot;Encuentra hoteles&quot;</strong></li>
                                <li><strong>&quot;¿Dónde puedo comer?&quot;</strong></li>
                            </ul>
                            
                            <h4 style={{ color: COLOR_BLUE, marginBottom: '10px' }}>🔊 Control de Audio</h4>
                            <ul style={{ marginBottom: '20px', paddingLeft: '20px' }}>
                                <li><strong>&quot;Silencio&quot;</strong> / <strong>&quot;Para&quot;</strong> - Detener narración</li>
                                <li><strong>&quot;Repetir&quot;</strong> - Repetir último mensaje</li>
                            </ul>
                            
                            <div style={{ 
                                background: '#f8f9fa', 
                                padding: '15px', 
                                borderRadius: '8px',
                                border: `2px solid ${COLOR_GOLD}`,
                                marginTop: '15px'
                            }}>
                                <strong style={{ color: COLOR_BLUE }}>💡 Tips:</strong> 
                                <br />• Habla con claridad y espera a que aparezca el micrófono antes de dar el siguiente comando
                                <br />• Los comandos de navegación funcionan incluso mientras Santi está hablando
                                <br />• Usa <strong>Ctrl+Shift+V</strong> para activar comandos de voz desde el teclado
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes floatSanti {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                    100% { transform: translateY(0); }
                }

                /* Show text on hover */
                .robot-container:hover .chat-hover-text {
                    opacity: 1 !important;
                }

                .thought-bubble-popup {
                    background: ${COLOR_BLUE};
                    padding: 20px;
                    border-radius: 30px;
                    border-bottom-left-radius: 8px;
                    box-shadow: 0 15px 45px rgba(0,0,0,0.4);
                    color: white;
                    position: relative;
                    border: 2px solid ${COLOR_GOLD}66;
                }

                .thought-bubble-popup::before {
                    content: '';
                    position: absolute;
                    bottom: -12px;
                    left: 20px;
                    width: 25px;
                    height: 25px;
                    background: ${COLOR_BLUE};
                    border-radius: 50%;
                    border: 2px solid ${COLOR_GOLD}33;
                }
                 .thought-bubble-popup::after {
                    content: '';
                    position: absolute;
                    bottom: -22px;
                    left: 5px;
                    width: 12px;
                    height: 12px;
                    background: ${COLOR_BLUE};
                    border-radius: 50%;
                    border: 1px solid ${COLOR_GOLD}22;
                }

                @keyframes popIn {
                    0% { transform: scale(0.95) translateY(-10px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }

                @media (max-width: 768px) {
                    .robot-container {
                        bottom: 80px !important; /* Move avatar up on mobile */
                    }
                }

                @keyframes popInBubble {
                    0% { transform: scale(0.8) translateY(20px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }

                .message-container { display: flex; width: 100%; }
                .message-container.user { justify-content: flex-end; }
                .message-container.assistant { justify-content: flex-start; }

                .bubble {
                    padding: 12px 18px;
                    max-width: 85%;
                    border-radius: 18px;
                    margin-bottom: 12px;
                    font-size: 0.95rem;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                .speech-bubble {
                    background: ${COLOR_RED};
                    color: white;
                    border-bottom-right-radius: 4px;
                    box-shadow: 0 4px 15px ${COLOR_RED}33;
                }
                .thought-bubble-list {
                    background: ${COLOR_BLUE};
                    color: white;
                    border: 1px solid ${COLOR_BLUE}55;
                    border-bottom-left-radius: 4px;
                    box-shadow: 0 4px 15px ${COLOR_BLUE}33;
                }
                
                .thinking-dots {
                    color: #888;
                    animation: pulseText 1.5s infinite;
                }

                @keyframes pulseText {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }

                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 12px rgba(255, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
                }
                .listening-pulse {
                    animation: pulse 1.5s infinite;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                
                @keyframes scaleIn {
                    from {
                        transform: scale(0.8);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes bounce {
                    0%, 80%, 100% {
                        transform: translateY(0);
                    }
                    40% {
                        transform: translateY(-12px);
                    }
                }

                /* Santi Animation Styles */
                .robot-avatar {
                    transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                .robot-avatar.idle {
                    filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.4));
                    animation: idlePulse 3s ease-in-out infinite;
                }
                
                .robot-avatar.active {
                    filter: drop-shadow(0 0 40px rgba(241, 196, 15, 0.8)) drop-shadow(0 0 60px rgba(241, 196, 15, 0.4));
                    animation: speakingBounce 0.8s ease-in-out infinite alternate;
                }
                
                @keyframes idlePulse {
                    0%, 100% { 
                        transform: scale(0.9);
                        filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.4));
                    }
                    50% { 
                        transform: scale(0.92);
                        filter: drop-shadow(0 0 35px rgba(255, 255, 255, 0.6));
                    }
                }
                
                @keyframes speakingBounce {
                    0% { 
                        transform: scale(1) rotate(-1deg);
                        filter: drop-shadow(0 0 40px rgba(241, 196, 15, 0.8)) drop-shadow(0 0 60px rgba(241, 196, 15, 0.4));
                    }
                    100% { 
                        transform: scale(1.05) rotate(1deg);
                        filter: drop-shadow(0 0 50px rgba(241, 196, 15, 1)) drop-shadow(0 0 80px rgba(241, 196, 15, 0.6));
                    }
                }
            `}} />
        </div>
    );
};

export default ChatInterface;
