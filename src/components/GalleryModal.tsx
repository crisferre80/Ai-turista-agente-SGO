"use client";
import React, { useState } from 'react';

const COLOR_BLUE = "#1A3A6C";

const GalleryModal = ({ urls, name, onClose }: { urls: string[], name: string, onClose: () => void }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const next = () => setCurrentIndex((currentIndex + 1) % urls.length);
    const prev = () => setCurrentIndex((currentIndex - 1 + urls.length) % urls.length);

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}
            onClick={onClose}
        >
            <div style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '90vh',
                background: 'white',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '70vh',
                    background: '#000'
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={urls[currentIndex]}
                        alt={`${name} ${currentIndex + 1}`}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                        }}
                    />
                    {urls.length > 1 && (
                        <>
                            <button
                                onClick={prev}
                                style={{
                                    position: 'absolute',
                                    left: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.8)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ‹
                            </button>
                            <button
                                onClick={next}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.8)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ›
                            </button>
                        </>
                    )}
                </div>
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: 'white'
                }}>
                    <h3 style={{ margin: 0, color: COLOR_BLUE }}>{name}</h3>
                    <p style={{ margin: '10px 0 0 0', color: '#666' }}>
                        {currentIndex + 1} de {urls.length}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(255,255,255,0.8)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ×
                </button>
            </div>
        </div>
    );
};

export default GalleryModal;