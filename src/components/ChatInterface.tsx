"use client";
import React, { useState, useRef, useEffect } from 'react';

const ChatInterface = () => {
    // State
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showHistory, setShowHistory] = useState(false); // Toggle for full chat history
    const [displayedText, setDisplayedText] = useState(''); // Typewriter effect text

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastInteractionRef = useRef(Date.now()); // Track inactivity

    const engagementPrompts = [
        "¿Hay algo en que pueda ayudarte?",
        "¿De dónde nos visitas?",
        "¿Cómo te llamas?",
        "¿Cuál es tu edad?",
        "Cuanto más sepa de vos, mejor podré guiarte.",
        "¿Te gustaría conocer algún lugar histórico?",
        "¿Sabías que Santiago es la Madre de Ciudades?",
        "Si buscas comida rica, puedo recomendarte lugares."
    ];

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

    // Proactive Engagement Timer
    useEffect(() => {
        const checkInterval = setInterval(() => {
            const timeSinceLast = Date.now() - lastInteractionRef.current;
            const isIdle = !isSpeaking && !isThinking && !isListening && !input.trim();

            // 60 seconds = 60000ms
            if (timeSinceLast >= 60000 && isIdle) {
                const randomPrompt = engagementPrompts[Math.floor(Math.random() * engagementPrompts.length)];
                triggerAssistantMessage(randomPrompt);
                updateInteractionTime();
            }
        }, 5000); // Check every 5 seconds

        return () => clearInterval(checkInterval);
    }, [isSpeaking, isThinking, isListening, input]);

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
    }, [isSpeaking, messages]); // Added messages dependency to ensure text updates if message changes while speaking


    // Text-to-Speech Helper
    const playAudioResponse = async (text: string) => {
        try {
            const response = await fetch('/api/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) throw new Error("Audio generation failed");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play();
            }
        } catch (error) {
            console.error("TTS Error:", error);
        }
    };

    const triggerAssistantMessage = (text: string) => {
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        playAudioResponse(text);
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
        const recognition = new SpeechRecognition();

        recognition.lang = 'es-AR'; // Argentine Spanish
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            updateInteractionTime();
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                handleSend(transcript);
            }
        };

        recognition.start();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#333', position: 'relative' }}>
            <audio
                ref={audioRef}
                style={{ display: 'none' }}
                onPlay={() => setIsSpeaking(true)}
                onEnded={() => setIsSpeaking(false)}
                onPause={() => setIsSpeaking(false)}
            />

            {/* MAIN ROBOT DISPLAY & FLOATING BUBBLE */}
            <div style={{
                position: 'fixed',
                bottom: '0',
                left: '20px',
                zIndex: 9999,
                pointerEvents: 'none', // Allow clicks pass through
                display: 'flex',
                alignItems: 'flex-end',
            }}>
                {/* The Robot */}
                <img
                    src={isSpeaking
                        ? "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.webp"
                        : "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"
                    }
                    alt="Robot Guia Santi"
                    style={{
                        height: '420px',
                        width: 'auto',
                        objectFit: 'contain',
                        marginBottom: '-20px',
                        filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.6))'
                    }}
                />

                {/* The Floating Thought Bubble (Only visible if Speaking, Thinking, or Welcome) */}
                {!showHistory && (isThinking || isSpeaking || messages.length === 0) && (
                    <div className="thought-bubble-popup" style={{
                        marginBottom: '250px', // Lift it up near the head
                        marginLeft: '-50px',
                        maxWidth: '300px',
                        pointerEvents: 'auto', // Allow copy text
                        animation: 'popIn 0.3s ease-out forwards'
                    }}>
                        {messages.length === 0 ? (
                            <p style={{ margin: 0, textAlign: 'center' }}>
                                <strong>¡Hola! Soy Santi.</strong><br />
                                ¿En qué te ayudo?
                            </p>
                        ) : (
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {isThinking
                                    ? <span className="thinking-dots">🧠 Pensando...</span>
                                    : <span style={{ whiteSpace: 'pre-wrap' }}>{displayedText}</span>
                                }
                            </div>
                        )}
                    </div>
                )}
            </div>


            {/* OPTIONAL HISTORY VIEW (Toggable) */}
            {showHistory && (
                <div style={{
                    flex: 1,
                    padding: '20px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '25px',
                    zIndex: 10,
                    marginBottom: '100px', // Space for input
                    background: 'rgba(255,255,255,0.7)', // Slightly visible background
                    backdropFilter: 'blur(5px)'
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
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                maxWidth: '600px',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>

                {/* History Toggle Button */}
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    style={{
                        alignSelf: 'center',
                        background: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '5px 15px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                        color: '#666',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    {showHistory ? '⬇️ Ocultar Chat' : '⬆️ Ver Historial'}
                </button>

                <div style={{
                    display: 'flex',
                    gap: '10px',
                    background: 'rgba(255,255,255,0.95)',
                    padding: '10px',
                    borderRadius: '50px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    backdropFilter: 'blur(10px)'
                }}>
                    {/* Mic Button */}
                    <button
                        onClick={toggleListening}
                        className={isListening ? 'listening-pulse' : ''}
                        style={{
                            background: isListening ? '#ff4444' : 'white',
                            color: isListening ? 'white' : '#555',
                            border: '1px solid #eee',
                            borderRadius: '50%',
                            width: '50px',
                            height: '50px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem',
                            transition: 'all 0.2s',
                            flexShrink: 0
                        }}
                        title="Hablar"
                    >
                        {isListening ? '⏹️' : '🎙️'}
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={isListening ? "Te escucho..." : "Pregúntale a Santi..."}
                        disabled={isLoading || isListening}
                        style={{
                            flex: 1,
                            padding: '0 20px',
                            borderRadius: '30px',
                            border: 'none',
                            outline: 'none',
                            fontSize: '1rem',
                            background: 'transparent'
                        }}
                    />

                    <button
                        onClick={() => handleSend()}
                        disabled={isLoading || (!input.trim() && !isListening)}
                        style={{
                            background: '#20B2AA',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '50px',
                            height: '50px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
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
                /* Floating Thought Popup */
                .thought-bubble-popup {
                    background: #fff;
                    padding: 20px;
                    border-radius: 30px;
                    border-bottom-left-radius: 5px; /* Connector feel */
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                    font-size: 1.1rem;
                    line-height: 1.5;
                    color: #333;
                    position: relative;
                    border: 2px solid #fff;
                }

                /* Dots connector */
                .thought-bubble-popup::before {
                    content: '';
                    position: absolute;
                    bottom: -15px;
                    left: -15px;
                    width: 25px;
                    height: 25px;
                    background: white;
                    border-radius: 50%;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                 .thought-bubble-popup::after {
                    content: '';
                    position: absolute;
                    bottom: -25px;
                    left: -35px;
                    width: 15px;
                    height: 15px;
                    background: white;
                    border-radius: 50%;
                }

                @keyframes popIn {
                    0% { transform: scale(0.8) translateY(20px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }

                /* History List Styles */
                .message-container { display: flex; width: 100%; }
                .message-container.user { justify-content: flex-end; }
                .message-container.assistant { justify-content: flex-start; }

                .bubble {
                    padding: 15px 20px;
                    max-width: 80%;
                    border-radius: 20px;
                    margin-bottom: 15px;
                    font-size: 1rem;
                }
                .speech-bubble {
                    background: #D2691E;
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .thought-bubble-list {
                    background: white;
                    color: #333;
                    border: 1px solid #eee;
                    border-bottom-left-radius: 4px;
                }
                
                .thinking-dots {
                    color: #888;
                    font-style: italic;
                    animation: pulseText 1.5s infinite;
                }

                @keyframes pulseText {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }

                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(255, 68, 68, 0); }
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
