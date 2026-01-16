"use client";
import React, { useState, useEffect } from 'react';

const SANTI_AVATAR = "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png";

// Curated high-quality images of Santiago del Estero
// Local project images from public/fotos
const INTRO_IMAGES = [
    "/fotos/estadio.jpg",
    "/fotos/termas costanera.jpg",
    "/fotos/parqueencuentro1-1.jpeg",
    "/fotos/ccb.jpg",
    "/fotos/municapi_plazasarmiento.jpg",
    "/fotos/pergola.jpg",
    "/fotos/dique.jfif"
];

const FALLBACK_IMAGES = [
    "/fotos/unnamed (1).jpg",
    "/fotos/unnamed (2).jpg"
];

const IntroOverlay = ({ onComplete }: { onComplete: () => void }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);
    const [images, setImages] = useState(INTRO_IMAGES);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    // Play welcome audio on mount
    useEffect(() => {
        const playWelcomeAudio = async () => {
            try {
                const welcomeText = "¡Hola chango! Bienvenido a Santiago del Estero, la Madre de Ciudades. Soy Santi, tu guía turístico virtual. Toca el botón de recorrer para comenzar esta aventura inolvidable.";
                const response = await fetch('/api/speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: welcomeText }),
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    if (audioRef.current) {
                        audioRef.current.src = url;
                        audioRef.current.play().catch(() => {
                            console.log("Autoplay blocked - waiting for user interaction");
                        });
                    }
                }
            } catch (error) {
                console.error("Welcome audio error:", error);
            }
        };

        playWelcomeAudio();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }, 4500);
        return () => clearInterval(interval);
    }, [images.length]);

    const handleStart = () => {
        // Stop audio if playing
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsVisible(false);
        setTimeout(onComplete, 800);
    };

    if (!isVisible) return null;

    return (
        <>
            <audio ref={audioRef} style={{ display: 'none' }} />
            <div style={{
                position: 'fixed',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 200000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: '#000'
            }}>
                {/* Background Slideshow */}
                {images.map((img, idx) => (
                    <div
                        key={idx}
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, width: '100%', height: '100%',
                            backgroundImage: `url(${img})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            opacity: idx === currentImageIndex ? 1 : 0,
                            transition: 'opacity 2s ease-in-out',
                            zIndex: 1,
                            filter: 'brightness(0.5) saturate(1.2)'
                        }}
                    />
                ))}

                {/* Colorful Floating Elements */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    zIndex: 2,
                    pointerEvents: 'none'
                }}>
                    <div className="confetti" style={{ backgroundColor: '#9E1B1B', top: '10%', left: '20%' }}></div>
                    <div className="confetti" style={{ backgroundColor: '#F1C40F', top: '30%', left: '80%' }}></div>
                    <div className="confetti" style={{ backgroundColor: '#1A3A6C', top: '70%', left: '15%' }}></div>
                    <div className="confetti" style={{ backgroundColor: '#F1C40F', top: '80%', left: '75%' }}></div>
                </div>

                {/* Content Overlay */}
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    maxWidth: '800px',
                    color: 'white',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    animation: 'fadeInUp 1s ease-out'
                }}>
                    {/* Animated Santi */}
                    <div style={{
                        animation: 'floatSantiIntro 4s ease-in-out infinite',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            position: 'relative'
                        }}>
                            <img
                                src={SANTI_AVATAR}
                                alt="Santi"
                                style={{
                                    height: 'clamp(200px, 30vh, 320px)',
                                    filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.4))'
                                }}
                            />
                            {/* Greeting Bubble */}
                            <div style={{
                                position: 'absolute',
                                top: '-20px',
                                right: '-40px',
                                backgroundColor: 'white',
                                color: '#1A3A6C',
                                padding: '10px 20px',
                                borderRadius: '20px 20px 20px 0',
                                fontWeight: 'bold',
                                fontSize: '1.2rem',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                                animation: 'popInGreeting 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                                animationDelay: '0.8s',
                                opacity: 0,
                                transform: 'scale(0.5)'
                            }}>
                                ¡HOLA! 👋
                            </div>
                        </div>
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                        fontWeight: '950',
                        margin: '0 0 10px 0',
                        textShadow: '0 10px 30px rgba(0,0,0,0.8)',
                        background: 'linear-gradient(to bottom, #FFFFFF 50%, #F1C40F)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-2px'
                    }}>
                        SANTIAGO DEL ESTERO
                    </h1>

                    <h2 style={{
                        fontSize: '1.5rem',
                        color: '#F1C40F',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '4px',
                        marginBottom: '30px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}>
                        Madre de Ciudades
                    </h2>

                    <p style={{
                        fontSize: 'clamp(1.1rem, 4vw, 1.4rem)',
                        lineHeight: '1.6',
                        marginBottom: '50px',
                        textShadow: '0 2px 10px rgba(0,0,0,1)',
                        maxWidth: '500px'
                    }}>
                        ¡Epa chango! Te doy la bienvenida a mi tierra. Soy <strong>Santi</strong> y hoy voy a ser tu guía virtual en este viaje inolvidable.
                    </p>

                    <button
                        onClick={handleStart}
                        className="start-button"
                        style={{
                            padding: '20px 60px',
                            fontSize: '1.4rem',
                            fontWeight: '900',
                            background: 'linear-gradient(to bottom, #9E1B1B, #7a1515)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '100px',
                            cursor: 'pointer',
                            boxShadow: '0 20px 40px rgba(158,27,27,0.4), inset 0 2px 2px rgba(255,255,255,0.3)',
                            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            borderBottom: '6px solid #F1C40F',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        ¡VAMOS A RECORRER! 🧉
                    </button>
                </div>

                <style jsx>{`
        .confetti {
            position: absolute;
            width: 100px;
            height: 100px;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.6;
            animation: pulseBg 10s infinite alternate;
        }

        @keyframes pulseBg {
            0% { transform: scale(1) translate(0, 0); }
            100% { transform: scale(1.5) translate(50px, 50px); }
        }

        @keyframes floatSantiIntro {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(3deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes popInGreeting {
            0% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        .start-button:hover {
            transform: scale(1.1) translateY(-5px);
            box-shadow: 0 30px 60px rgba(158,27,27,0.6);
        }

        .start-button:active {
            transform: scale(0.95);
        }
      `}</style>
            </div>
        </>
    );
};

export default IntroOverlay;
