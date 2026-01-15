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

            // Proactive Engagement (keep existing logic but higher threshold)
            if (timeSinceLast >= 120000 && !isSpeaking && !isThinking && !isListening && !input.trim()) {
                const randomPrompt = engagementPrompts[Math.floor(Math.random() * engagementPrompts.length)];
                triggerAssistantMessage(randomPrompt);
                updateInteractionTime();
            }
        }, 5000);

        return () => clearInterval(checkInterval);
    }, [isSpeaking, isThinking, isListening, input, engagementPrompts]);

    // Global access for cards
    useEffect(() => {
        (window as any).santiNarrate = (text: string) => {
            handleSend(text);
        };
        return () => { delete (window as any).santiNarrate; };
    }, [messages]);

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
                audioRef.current.src = url;
                audioRef.current.play().catch(err => {
                    console.warn("Autoplay blocked:", err);
                    setAudioBlocked(true);
                });
            }
        } catch (error: any) {
            console.error("TTS Error:", error);
            if (error.message === "API_KEY_MISSING") {
                alert("Santi no puede hablar porque falta la OPENAI_API_KEY en el archivo .env.local");
            }
        }
    };

    const triggerAssistantMessage = (text: string) => {
        updateInteractionTime();
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        playAudioResponse(text);

        // Trigger map focus if a place is mentioned
        if (typeof window !== 'undefined' && (window as any).focusPlaceOnMap) {
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

            // Detect place in reply and focus map
            if (typeof window !== 'undefined' && (window as any).focusPlaceOnMap) {
                (window as any).focusPlaceOnMap(botReply);
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
                bottom: isModalOpen ? '-80px' : '10px',
                left: '10px',
                zIndex: 40000,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'flex-end',
                transition: 'bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
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

                {/* The Floating Thought Bubble (Above Head) */}
                {!showHistory && (isThinking || isSpeaking || messages.length === 0 || audioBlocked) && (
                    <div className="thought-bubble-popup" style={{
                        marginBottom: isSpeaking ? 'clamp(200px, 35vh, 400px)' : 'clamp(100px, 18vh, 180px)',
                        marginLeft: '-40px',
                        maxWidth: 'min(300px, 65vw)',
                        pointerEvents: 'auto',
                        animation: 'popIn 0.3s ease-out forwards',
                        transition: 'all 0.5s ease',
                        cursor: audioBlocked ? 'pointer' : 'default',
                        borderBottomLeftRadius: '8px',
                        borderTopLeftRadius: '30px'
                    }} onClick={() => {
                        if (audioBlocked && audioRef.current) {
                            setAudioBlocked(false);
                            audioRef.current.play();
                        }
                    }}>
                        {audioBlocked ? (
                            <div style={{ color: '#D2691E', fontWeight: 'bold' }}>
                                🔇 Santi está silenciado.<br />
                                <span style={{ fontSize: '0.8rem' }}>Hacé clic aquí para oírlo.</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>
                                <strong>¡Hola! Soy Santi.</strong><br />
                                ¿En qué te ayudo?
                            </div>
                        ) : (
                            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.95rem' }}>
                                {isThinking
                                    ? <span className="thinking-dots">🧠 Pensando...</span>
                                    : <span style={{ whiteSpace: 'pre-wrap' }}>{displayedText}</span>
                                }
                            </div>
                        )}
                    </div>
                )}
            </div>


            {/* OPTIONAL HISTORY VIEW (Toggable Floating Panel) */}
            {showHistory && (
                <div style={{
                    position: 'fixed',
                    top: '180px', // Below the robot
                    left: '20px',
                    width: 'min(90%, 400px)',
                    maxHeight: '60vh',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    zIndex: 29999, // Just behind robot
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${COLOR_BLUE}44`,
                    borderRadius: '24px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    padding: '20px',
                    overflowY: 'auto'
                }}>
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

            {!showHistory && <div style={{ flex: 1 }} /* Spacer */ onClick={() => setShowHistory(false)} />}


            {/* INPUT AREA (Floating at bottom center) */}
            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                left: 'auto',
                transform: isIdle ? 'translateY(150%)' : 'translateY(0)',
                width: 'min(90%, 400px)',
                zIndex: 30005,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: isIdle ? 0 : 1,
                pointerEvents: isIdle ? 'none' : 'auto'
            }}>

                {/* Actions Row */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        style={{
                            background: 'rgba(255,255,255,0.92)',
                            border: 'none',
                            borderRadius: '20px',
                            padding: '6px 14px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            color: '#444',
                            fontWeight: '500'
                        }}
                    >
                        {showHistory ? '⬇️ Ocultar Chat' : '⬆️ Ver Chat'}
                    </button>

                    <button
                        onClick={() => window.location.href = '/login'}
                        style={{
                            background: 'rgba(32, 178, 170, 0.95)',
                            border: 'none',
                            borderRadius: '20px',
                            padding: '6px 14px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            color: 'white',
                            fontWeight: 'bold'
                        }}
                    >
                        🏢 Login Negocios
                    </button>
                </div>

                {/* Instruction Legend */}
                <div style={{
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: COLOR_GOLD,
                    fontWeight: 'bold',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    marginBottom: '5px',
                    animation: 'pulseText 2s infinite'
                }}>
                    🎤 ¡Presioná el mic y preguntame lo que quieras!
                </div>

                <div style={{
                    display: 'flex',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.95)',
                    padding: '8px',
                    borderRadius: '50px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <button
                        onClick={toggleListening}
                        className={isListening ? 'listening-pulse' : ''}
                        style={{
                            background: isListening ? COLOR_RED : 'white',
                            color: isListening ? 'white' : COLOR_BLUE,
                            border: `2px solid ${isListening ? COLOR_GOLD : '#eee'}`,
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

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={isListening ? "Te escucho..." : "Tu pregunta..."}
                        disabled={isLoading || isListening}
                        style={{
                            flex: 1,
                            padding: '0 10px',
                            borderRadius: '30px',
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.95rem',
                            background: 'transparent'
                        }}
                    />

                    <button
                        onClick={() => handleSend()}
                        disabled={isLoading || (!input.trim() && !isListening)}
                        style={{
                            background: (isLoading || !input.trim()) ? 'rgba(255,255,255,0.1)' : COLOR_GOLD,
                            color: (isLoading || !input.trim()) ? 'rgba(255,255,255,0.3)' : '#000',
                            border: 'none',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: (isLoading || !input.trim()) ? 0.6 : 1,
                            flexShrink: 0
                        }}
                    >
                        ➤
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
