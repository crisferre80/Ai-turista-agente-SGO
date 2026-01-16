"use client";
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';


const COLOR_RED = "#9E1B1B";
const COLOR_BLUE = "#1A3A6C";
const COLOR_GOLD = "#F1C40F";

const ChatInterface = ({ externalTrigger, externalStory, isModalOpen }: {
    externalTrigger?: string,
    externalStory?: { url: string, name: string },
    isModalOpen?: boolean
}) => {
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

    useEffect(() => {
        if (externalTrigger) {
            triggerAssistantMessage(externalTrigger);
        }
    }, [externalTrigger]);

    useEffect(() => {
        if (externalStory) {
            playUserStory(externalStory.url, externalStory.name);
        }
    }, [externalStory]);


    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastInteractionRef = useRef(Date.now()); // Track inactivity

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
    const getApiMessages = () => {
        return messages.map(m => ({ role: m.role, content: m.content }));
    };

    // Helper to get the content to show
    const getLastAssistantMessage = () => {
        const assistantMsgs = messages.filter(m => m.role === 'assistant');
        if (assistantMsgs.length === 0) return null;
        return assistantMsgs[assistantMsgs.length - 1].content;
    };

    // Intro Logic is now handled by IntroOverlay in page.tsx

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

            // Proactive Engagement
            if (timeSinceLast >= 120000 && !isSpeaking && !isThinking && !isListening && !input.trim()) {
                const randomPrompt = engagementPrompts[Math.floor(Math.random() * engagementPrompts.length)];
                triggerAssistantMessage(randomPrompt);
                updateInteractionTime();
            }
        }, 5000);

        return () => clearInterval(checkInterval);
    }, [isSpeaking, isThinking, isListening, input, engagementPrompts]);

    // Global access for triggers
    useEffect(() => {
        (window as any).santiNarrate = (text: string) => {
            handleSend(text);
        };
        (window as any).santiSpeak = (text: string) => {
            triggerAssistantMessage(text, true); // Skip focus to avoid loops
        };
        return () => {
            delete (window as any).santiNarrate;
            delete (window as any).santiSpeak;
        };
    }, []); // Only register once

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
    }, [isSpeaking, messages]);


    // Text-to-Speech Helper
    const playAudioResponse = async (text: string) => {
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
                // Clear state and pause to avoid AbortError
                audioRef.current.onended = null;
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.src = url;

                audioRef.current.play().catch(err => {
                    if (err.name !== 'AbortError') {
                        console.warn("Autoplay blocked:", err);
                        setAudioBlocked(true);
                    }
                });
            }
        } catch (error: any) {
            console.error("TTS Error:", error);
            if (error.message === "API_KEY_MISSING") {
                alert("Santi no puede hablar porque falta la OPENAI_API_KEY");
            }
        }
    };

    const triggerAssistantMessage = (text: string, skipMapFocus = false) => {
        updateInteractionTime();
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        playAudioResponse(text);

        // Trigger map focus if a place is mentioned and not explicitly skipped
        if (!skipMapFocus && typeof window !== 'undefined' && (window as any).focusPlaceOnMap) {
            (window as any).focusPlaceOnMap(text);
        }
    };

    const playUserStory = async (url: string, name: string) => {

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
    };



    // Send Message Logic
    const handleSend = async (overrideText?: string) => {
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

            // Add Assistant Message
            setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);

            // Speak the response
            playAudioResponse(botReply);

            // Detect if user asked for directions and extract destination from user message
            const isDirectionQuery = /(?:cómo|como) (?:llegar|voy|llego)|indicame|direcciones?|ruta|camino/i.test(textToSend);
            console.log('Direction query detected:', isDirectionQuery, 'for message:', textToSend);
            if (isDirectionQuery && typeof window !== 'undefined' && (window as any).focusPlaceOnMap) {
                // Extract potential place names from user message
                const placeMatch = textToSend.match(/(?:a\s+|al\s+|hacia\s+|para\s+|voy a\s+|ir a\s+)(.+?)(?:\?|$|\.|\s+y\s+)/i);
                console.log('Place match:', placeMatch);
                if (placeMatch) {
                    const destination = placeMatch[1].trim();
                    (window as any).focusPlaceOnMap(destination);
                }
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Ocurrió un error al contactar a mi cerebro digital. Intenta más tarde." }]);
        } finally {
            setIsLoading(false);
            setIsThinking(false);
            updateInteractionTime(); // Reset timer again after response
        }
    };

    // Voice Recognition (Speech-to-Text)
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
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("El motor de reconocimiento no está disponible.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            console.log("Voice recognition started");
            setIsListening(true);
        };

        recognition.onerror = (event: any) => {
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

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            console.log("Result received:", transcript);
            if (transcript) {
                handleSend(transcript);
            }
        };

        try {
            recognition.start();
        } catch (e) {
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



                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    {/* The Robot (HOST POSITION - Always fixed and visible) */}
                    <img
                        className={`robot-avatar ${isSpeaking ? 'active' : 'idle'}`}
                        src={isSpeaking
                            ? "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.webp"
                            : "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                        }
                        alt="Robot Guia Santi"
                        style={{
                            height: isSpeaking ? 'clamp(250px, 40vh, 450px)' : 'clamp(120px, 20vh, 200px)',
                            width: 'auto',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.4))',
                            transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            opacity: 1,
                            transform: isSpeaking ? 'scale(1)' : 'scale(0.9)',
                            pointerEvents: 'auto'
                        }}
                    />

                    {/* The Floating Thought Bubble */}
                    {!showHistory && (isThinking || isSpeaking || messages.length === 0 || audioBlocked) && (
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
                        }}>
                            {audioBlocked ? (
                                <div style={{ color: '#D2691E', fontWeight: 'bold' }}>
                                    🔇 Clic para activar sonido
                                </div>
                            ) : (
                                <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.94rem', color: 'white' }}>
                                    {isThinking
                                        ? <span className="thinking-dots">🧠 Pensando...</span>
                                        : <span style={{ whiteSpace: 'pre-wrap' }}>{displayedText || "¿En qué te ayudo?"}</span>
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
                        <img
                            src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                            alt="Santi Logo"
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
                                onClick={() => window.location.href = '/explorar'}
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
                                <span>🗺️</span> Explorar Lugares
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
                {/* Instruction Legend (Aligned Right) */}
                <div style={{
                    textAlign: 'right',
                    fontSize: '0.8rem',
                    color: COLOR_BLUE,
                    fontWeight: '900',
                    marginRight: '15px',
                    animation: 'pulseText 2s infinite'
                }}>
                    ¡Presioná el mic y hablá! 👉
                </div>



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
            `}</style>
        </div>
    );
};

export default ChatInterface;
