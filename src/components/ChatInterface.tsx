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
    }
}

const COLOR_RED = "#9E1B1B";
const COLOR_BLUE = "#1A3A6C";
const COLOR_GOLD = "#F1C40F";

// Business registration prompts that Santi may propose occasionally
const BUSINESS_PROMPTS = [
    "¿Tenés un negocio que te gustaría que aparezca en la app como destacado? Te explico cómo registrarlo: 1) Entrá a 'Mi Negocio' y completá la ficha con nombre, dirección, horario y contacto. 2) Subí varias fotos y el logo de tu establecimiento. 3) Adjuntá la documentación necesaria y solicitá la acreditación. 4) Nuestro equipo revisará la solicitud y, una vez aprobada, tu negocio podrá aparecer como 'Comercio Certificado' y ser destacado en la app. ¿Querés que te lleve ahora al formulario?",
    "Si querés aparecer destacado en la app: abrí 'Mi Negocio' → Crear ficha → subí fotos y un texto breve sobre lo que los hace únicos. En 48-72h el equipo revisa y te avisa. ¿Deseás que te muestre cómo?"
];

const ChatInterface = ({ externalTrigger, externalStory, isModalOpen }: {
    externalTrigger?: string,
    externalStory?: { url: string, name: string },
    isModalOpen?: boolean
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
    const [isMenuOpen, setIsMenuOpen] = useState(false); // Mobile menu toggle
    const [audioBlocked, setAudioBlocked] = useState(false); // Handle autoplay block
    const [displayedText, setDisplayedText] = useState(''); // Typewriter effect text
    const [isIdle, setIsIdle] = useState(false); // For auto-hide
    const [isHovering, setIsHovering] = useState(false); // Hover state for bubble
    const [showBubbleManual, setShowBubbleManual] = useState(false); // Manual click toggle for bubble
    const [isMicHover, setIsMicHover] = useState(false); // Hover/focus state for mic legend

    // External triggers effects will be registered after callbacks are defined

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastInteractionRef = useRef(Date.now()); // Track inactivity
    const micHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout to auto-hide mic legend on touch

    const [engagementPrompts, setEngagementPrompts] = useState([
        "¿Hay algo en que pueda ayudarte?",
        "¿De dónde nos visitas?",
        "¿Cómo te llamas?",
        "¿Cuál es tu edad?",
        "Cuanto más sepa de vos, mejor podré guiarte.",
        "¿Te gustaría conocer algún lugar histórico?",
        "¿Sabías que Santiago es la Madre de Ciudades?",
        "Si buscas comida rica, puedo recomendarte lugares."
    ]);

    useEffect(() => {
        fetchCloudPhrases();
    }, []);

    const fetchCloudPhrases = async () => {
        const { data } = await supabase.from('santis_phrases').select('phrase');
        if (data && data.length > 0) {
            const cloudPhrases = data.map((d: { phrase: string }) => d.phrase);
            setEngagementPrompts(prev => [...prev, ...cloudPhrases]);
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

    // Global access for triggers will be registered after callbacks are defined

    // Typewriter Effect Logic will be registered after callbacks are defined

    // Text-to-Speech Helper
    const playAudioResponse = useCallback(async (text: string) => {
        try {
            const response = await fetch('/api/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (response.status === 401) throw new Error("API_KEY_MISSING");
            if (!response.ok) throw new Error("Audio generation failed");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (audioRef.current) {
                // Clear previous handlers
                audioRef.current.onended = null;
                audioRef.current.onerror = null;
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.src = url;
                
                // Set up end handler to emit event
                audioRef.current.onended = () => {
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narration:end'));
                    }
                    URL.revokeObjectURL(url);
                };
                
                audioRef.current.onerror = () => {
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narration:end'));
                    }
                };

                // Play and emit start event ONLY after successful play
                audioRef.current.play().then(() => {
                    // Emit start event for other components AFTER audio starts
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text } }));
                    }
                }).catch(err => {
                    if (err.name !== 'AbortError') {
                        console.warn("Autoplay blocked:", err);
                        setAudioBlocked(true);
                        // Still emit start for UI purposes
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('santi:narration:start', { detail: { text } }));
                        }
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
            }
        }
    }, []);

    const triggerAssistantMessage = useCallback((text: string, skipMapFocus = false) => {
        updateInteractionTime();
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        playAudioResponse(text);

        // Trigger map focus if a place is mentioned and not explicitly skipped
        if (!skipMapFocus && typeof window !== 'undefined' && 'focusPlaceOnMap' in window && typeof (window as Window & typeof globalThis).focusPlaceOnMap === 'function') {
            (window as Window & typeof globalThis).focusPlaceOnMap!(text);
        }
    }, [playAudioResponse]);

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
        return pattern.test(text) || BUSINESS_PROMPTS.some(p => (text || '').includes(p));
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
            // Call Chat API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...getApiMessages(), { role: 'user', content: textToSend }]
                }),
            });

            if (!response.ok) throw new Error("Chat request failed");

            const data = await response.json();
            const botReply = data.reply || "Lo siento, tuve un problema al pensar. ¿Podrías repetir?";
            const placeId = data.placeId;
            const placeName = data.placeName;

            // Add Assistant Message
            setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);

            // If navigating to a place, keep thinking state until narration starts there
            // Otherwise turn off thinking after a short delay
            if (!placeId) {
                setTimeout(() => {
                    setIsThinking(false);
                }, 600);
            }
            // If there's a placeId, isThinking will be turned off by the narration:start event

            // Speak the response
            playAudioResponse(botReply);
            
            // If a place was mentioned, navigate to its detail page automatically
            if (placeId && typeof window !== 'undefined') {
                // Store that we're narrating about this place
                // Use sessionStorage as fallback if localStorage is blocked
                const setStorage = (key: string, value: string) => {
                    try {
                        localStorage.setItem(key, value);
                    } catch (e) {
                        try {
                            sessionStorage.setItem(key, value);
                        } catch (e2) {
                            console.warn('Storage blocked, narration may not show on detail page');
                        }
                    }
                };
                
                try {
                    setStorage('santi:narratingPlace', placeId);
                    setStorage('santi:narratingText', botReply);
                    // Navigate after a short delay to let audio start - use Next.js router for SPA navigation
                    setTimeout(() => {
                        router.push(`/explorar/${placeId}`);
                    }, 800);
                } catch (err) {
                    console.error('Navigation error:', err);
                }
            }

            // Detect if user asked for directions and extract destination from user message
            const isDirectionQuery = /(?:cómo|como) (?:llegar|voy|llego)|indicame|direcciones?|ruta|camino/i.test(textToSend);
            console.log('Direction query detected:', isDirectionQuery, 'for message:', textToSend);
            if (isDirectionQuery && typeof window !== 'undefined' && 'focusPlaceOnMap' in window && typeof (window as Window & typeof globalThis).focusPlaceOnMap === 'function') {
                // Extract potential place names from user message
                const placeMatch = textToSend.match(/(?:a\s+|al\s+|hacia\s+|para\s+|voy a\s+|ir a\s+)(.+?)(?:\?|$|\.|\s+y\s+)/i);
                console.log('Place match:', placeMatch);
                if (placeMatch) {
                    const destination = placeMatch[1].trim();
                    (window as Window & typeof globalThis).focusPlaceOnMap!(destination);
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
    }, [input, getApiMessages, playAudioResponse]);

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

            // Proactive Engagement (includes occasional business registration suggestions)
            if (timeSinceLast >= 120000 && !isSpeaking && !isThinking && !isListening && !input.trim()) {
                // 25% chance to propose registering a business
                const pickBusiness = Math.random() < 0.25;
                const prompt = pickBusiness
                    ? BUSINESS_PROMPTS[Math.floor(Math.random() * BUSINESS_PROMPTS.length)]
                    : engagementPrompts[Math.floor(Math.random() * engagementPrompts.length)];
                triggerAssistantMessage(prompt);
                updateInteractionTime();
            }
        }, 5000);

        return () => clearInterval(checkInterval);
    }, [isSpeaking, isThinking, isListening, input, engagementPrompts, triggerAssistantMessage]);

    // Global access for triggers
    useEffect(() => {
        // Turn off thinking modal when narration starts (even on other pages)
        const handleNarrationStart = () => {
            console.log('ChatInterface: Narration started, hiding thinking modal');
            setIsThinking(false);
        };
        
        window.addEventListener('santi:narration:start', handleNarrationStart);
        
        (window as Window & typeof globalThis).santiNarrate = (text: string) => {
            handleSend(text);
        };
        (window as Window & typeof globalThis).santiSpeak = (text: string) => {
            triggerAssistantMessage(text, true); // Skip focus to avoid loops
        };
        return () => {
            window.removeEventListener('santi:narration:start', handleNarrationStart);
            if ((window as Window & typeof globalThis).santiNarrate) delete (window as Window & typeof globalThis).santiNarrate;
            if ((window as Window & typeof globalThis).santiSpeak) delete (window as Window & typeof globalThis).santiSpeak;
        };
    }, [handleSend, triggerAssistantMessage]);

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
                handleSend(transcript);
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
                onPlay={() => setIsSpeaking(true)}
                onEnded={() => setIsSpeaking(false)}
                onPause={() => setIsSpeaking(false)}
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

            {/* MAIN ROBOT DISPLAY & FLOATING BUBBLE */}
            <div className="robot-container" style={{
                position: 'fixed',
                bottom: isModalOpen ? '-120px' : '20px',
                left: '20px',
                zIndex: 40000,
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
                            filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.4))',
                            transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            opacity: 1,
                            transform: isSpeaking ? 'scale(1)' : 'scale(0.9)',
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

            {/* NEW TOP HEADER WITH HAMBURGER MENU */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(20px)',
                borderBottom: `1px solid ${COLOR_BLUE}11`,
                zIndex: 50000,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'white',
                        borderRadius: '50%',
                        border: `2px solid ${COLOR_BLUE}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        <Image
                            src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                            alt="Santi Logo"
                            width={40}
                            height={40}
                            unoptimized
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                transform: 'scale(1.2) translateY(2px)'
                            }}
                        />
                    </div>
                    <h1 style={{
                        fontSize: '1.2rem',
                        fontWeight: '900',
                        color: COLOR_BLUE,
                        margin: 0,
                        letterSpacing: '-0.5px'
                    }}> IA Santi Guía </h1>
                </div>
            </div>

            {/* NEW TOP HEADER WITH HAMBURGER MENU */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(20px)',
                borderBottom: `1px solid ${COLOR_BLUE}11`,
                zIndex: 50000,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'white',
                        borderRadius: '50%',
                        border: `2px solid ${COLOR_BLUE}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        <Image
                            src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                            alt="Santi Logo"
                            width={40}
                            height={40}
                            unoptimized
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                transform: 'scale(1.2) translateY(2px)'
                            }}
                        />
                    </div>
                    <h1 style={{
                        fontSize: '1.2rem',
                        fontWeight: '900',
                        color: COLOR_BLUE,
                        margin: 0,
                        letterSpacing: '-0.5px'
                    }}> IA Santi Guía </h1>
                </div>

                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: COLOR_BLUE,
                            padding: '5px'
                        }}
                    >
                        {isMenuOpen ? '✕' : '☰'}
                    </button>

                    {isMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '50px',
                            right: 0,
                            background: 'white',
                            borderRadius: '15px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                            padding: '10px',
                            minWidth: '180px',
                            zIndex: 50001,
                            border: `1px solid ${COLOR_BLUE}11`,
                            animation: 'popIn 0.2s ease-out'
                        }}>
                            <button
                                onClick={() => { setShowHistory(!showHistory); setIsMenuOpen(false); }}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '12px 15px',
                                    background: 'none',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    color: COLOR_BLUE,
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <span>{showHistory ? '📖' : '📘'}</span> {showHistory ? 'Cerrar Chat' : 'Ver Historial'}
                            </button>
                            <button
                                onClick={() => window.location.href = '/login'}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '12px 15px',
                                    background: 'none',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    color: COLOR_BLUE,
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <span>🏢</span> Mi Negocio
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* OPTIONAL HISTORY VIEW (Toggable Floating Panel) */}
            {showHistory && (
                <div style={{
                    position: 'fixed',
                    top: '70px', // Below the NEW header
                    right: '20px',
                    width: 'min(90%, 400px)',
                    maxHeight: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    zIndex: 29999,
                    background: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(25px)',
                    border: `1px solid ${COLOR_BLUE}11`,
                    borderRadius: '24px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                    padding: '20px',
                    overflowY: 'auto',
                    animation: 'popIn 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: `1px solid ${COLOR_BLUE}08`, paddingBottom: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: COLOR_BLUE }}>Historial de Chat</span>
                        <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                    </div>
                    {messages.map((m, i) => (
                        <div key={i} className={`message-container ${m.role}`}>
                            <div className={`bubble ${m.role === 'assistant' ? 'thought-bubble-list' : 'speech-bubble'}`}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="message-container assistant">
                            <div className="bubble thought-bubble-list thinking">...</div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            )}

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
                            flexShrink: 0
                        }}
                    >
                        {isListening ? '⏹️' : '🎙️'}
                    </button>
                </div>
            </div>

            <style jsx>{`
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
            `}</style>
        </div>
    );
};

export default ChatInterface;
