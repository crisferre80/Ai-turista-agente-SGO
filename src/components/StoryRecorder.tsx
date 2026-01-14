"use client";
import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface StoryRecorderProps {
    attractionId: string;
    onClose: () => void;
}

const StoryRecorder = ({ attractionId, onClose }: StoryRecorderProps) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [uploading, setUploading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            alert('Necesitamos permiso para usar el micrófono, chango.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleUpload = async () => {
        if (!audioBlob) return;
        setUploading(true);

        const fileName = `${Date.now()}.webm`;
        const filePath = `stories/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('audios')
            .upload(filePath, audioBlob);

        if (uploadError) {
            alert('Error subiendo el audio: ' + uploadError.message);
        } else {
            const { data: { publicUrl } } = supabase.storage.from('audios').getPublicUrl(filePath);

            // Save to narrations table
            const { data: { user } } = await supabase.auth.getUser();
            const { error: dbError } = await supabase.from('narrations').insert([{
                attraction_id: attractionId,
                user_id: user?.id || null,
                audio_url: publicUrl,
                text_content: 'Historia grabada por un visitante'
            }]);

            if (dbError) alert(dbError.message);
            else {
                alert('¡Tu historia se guardó en el viento de Santiago! Gracias por compartir.');
                onClose();
            }
        }
        setUploading(false);
    };

    return (
        <div style={containerStyle}>
            <h3 style={{ margin: '0 0 10px 0' }}>🎙️ Contá tu historia</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
                ¿Qué sentiste en este lugar? Grabá un audio corto para que otros turistas lo escuchen.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                {!audioBlob ? (
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        style={{ ...recordBtn, background: isRecording ? '#ff4444' : '#20B2AA' }}
                    >
                        {isRecording ? '⏹️ Detener' : '🎤 Empezar a graba'}
                    </button>
                ) : (
                    <div style={{ width: '100%', textAlign: 'center' }}>
                        <audio src={URL.createObjectURL(audioBlob)} controls style={{ width: '100%', marginBottom: '15px' }} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleUpload} disabled={uploading} style={uploadBtn}>
                                {uploading ? 'Guardando...' : '✅ Enviar historia'}
                            </button>
                            <button onClick={() => setAudioBlob(null)} style={retryBtn}>🔄 Reintentar</button>
                        </div>
                    </div>
                )}

                {isRecording && <div className="pulse" style={pulseIndicator}>Grabando...</div>}

                <button onClick={onClose} style={closeBtn}>Quizás más tarde</button>
            </div>

            <style jsx>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .pulse { animation: pulse 1.5s infinite; }
            `}</style>
        </div>
    );
};

const containerStyle = { background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center' as const };
const recordBtn = { width: '80px', height: '80px', borderRadius: '50%', border: 'none', color: 'white', fontWeight: 'bold' as const, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' };
const uploadBtn = { flex: 1, background: '#D2691E', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold' as const, cursor: 'pointer' };
const retryBtn = { background: '#f0f0f0', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer' };
const closeBtn = { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' };
const pulseIndicator = { color: '#ff4444', fontWeight: 'bold' as const, fontSize: '14px' };

export default StoryRecorder;
