"use client";
import React, { useState, useRef, useEffect } from 'react';

const ChatInterface = () => {
    // State
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    // Format messages for API
    const getApiMessages = () => {
        return messages.map(m => ({ role: m.role, content: m.content }));
    };

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

    // Send Message Logic
    const handleSend = async (overrideText?: string) => {
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
        }
    };

    // Voice Recognition (Speech-to-Text)
    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Tu navegador no soporta entrada de voz. Intenta usar Chrome.");
            return;
        }

        if (isListening) {
            // Stop logic handles automatically if single utterance, but we can force stop here ideally.
            // For simplicity, we assume the user clicks to START and it stops automatically on silence.
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

        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                handleSend(transcript);
            }
        };

        recognition.start();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#333' }}>
            <audio ref={audioRef} style={{ display: 'none' }} />

            {/* Chat Content Area */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>

                {/* Robot Welcome Hero */}
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '40px' }}>
                        <div style={{ fontSize: '80px', lineHeight: 1 }}>🤖</div>
                        <h3 style={{ margin: '10px 0', color: '#D2691E' }}>Santi</h3>
                        <div style={{
                            background: 'white',
                            padding: '15px',
                            borderRadius: '16px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            display: 'inline-block',
                            maxWidth: '80%'
                        }}>
                            <p>¡Hola! Soy tu guía con IA. Hablemos de Santiago del Estero.</p>
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                        borderBottomLeftRadius: m.role === 'assistant' ? '4px' : '16px',
                        background: m.role === 'user' ? '#D2691E' : 'white',
                        color: m.role === 'user' ? 'white' : '#333',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                        {m.content}
                    </div>
                ))}

                {isThinking && (
                    <div style={{ alignSelf: 'flex-start', color: '#666', fontSize: '0.9rem', paddingLeft: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>🧠</span> Pensando...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '15px', background: 'rgba(255,255,255,0.5)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>

                    {/* Mic Button */}
                    <button
                        onClick={toggleListening}
                        className={isListening ? 'listening-pulse' : ''}
                        style={{
                            background: isListening ? '#ff4444' : 'white',
                            color: isListening ? 'white' : '#555',
                            border: '1px solid #ddd',
                            borderRadius: '50%',
                            width: '46px',
                            height: '46px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            transition: 'all 0.2s'
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
                        placeholder={isListening ? "Te escucho..." : "Escribe o habla..."}
                        disabled={isLoading || isListening}
                        style={{
                            flex: 1,
                            padding: '12px 15px',
                            borderRadius: '25px',
                            border: '1px solid #ddd',
                            outline: 'none',
                        }}
                    />

                    <button
                        onClick={() => handleSend()}
                        disabled={isLoading || (!input.trim() && !isListening)}
                        style={{
                            background: '#20B2AA',
                            color: 'white',
                            border: 'none',
                            borderRadius: '25px',
                            padding: '10px 20px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            opacity: (isLoading || !input.trim()) ? 0.6 : 1
                        }}
                    >
                        ➤
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
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
