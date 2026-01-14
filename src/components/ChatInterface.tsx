"use client";
import React, { useState, useRef, useEffect } from 'react';

const ChatInterface = () => {
    // Initial State: Introduction
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: 'user' as const, content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '¡Excelente elección! Santiago tiene rincones maravillosos. ¿Te gustaría saber horarios o precios?'
            }]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#333' }}>

            {/* Chat Content Area */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>

                {/* Robot Welcome Hero (Always visible or just at start? Let's keep it at start or scroll up) */}
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
                            position: 'relative'
                        }}>
                            <p>¡Hola! ¿En qué puedo ayudarte hoy?</p>
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

                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', color: '#999', fontSize: '0.8rem', paddingLeft: '10px' }}>
                        Escribiendo...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '15px', background: 'rgba(255,255,255,0.5)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escribe tu pregunta a Santi aquí..."
                        style={{
                            flex: 1,
                            padding: '12px 15px',
                            borderRadius: '25px',
                            border: '1px solid #ddd',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleSend}
                        style={{
                            background: '#20B2AA',
                            color: 'white',
                            border: 'none',
                            borderRadius: '25px',
                            padding: '10px 20px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        ENVIAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
