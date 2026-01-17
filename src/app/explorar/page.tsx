"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import ChatInterface from '@/components/ChatInterface';
import GalleryModal from '@/components/GalleryModal';
import UserReviewModal from '@/components/UserReviewModal';
import UserReviewsGallery from '@/components/UserReviewsGallery';

const COLOR_RED = "#9E1B1B";
const COLOR_BLUE = "#1A3A6C";
const COLOR_GOLD = "#F1C40F";

type PlaceType = {
    id: string;
    name: string;
    description: string;
    image_url?: string;
    category?: string;
    lat: number;
    lng: number;
    isBusiness?: boolean;
    contact_info?: string;
    website_url?: string;
    info_extra?: string;
    gallery_urls?: string[];
};


export default function ExplorePage() {
    const [attractions, setAttractions] = useState<PlaceType[]>([]);
    const [businesses, setBusinesses] = useState<PlaceType[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'attractions' | 'businesses'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [galleryModal, setGalleryModal] = useState<{urls: string[], name: string} | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [reviewModal, setReviewModal] = useState<{isOpen: boolean, attractionId?: string, businessId?: string, locationName: string} | null>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();

        // Check if a place was requested via marker 'Más info' button
        const openPlaceId = typeof window !== 'undefined' ? localStorage.getItem('openPlaceId') : null;
        if (openPlaceId) {
            localStorage.removeItem('openPlaceId');
            // Wait for DOM to render the list, then scroll and highlight
            setTimeout(() => {
                const el = document.getElementById(`place-${openPlaceId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setHighlightId(openPlaceId);
                    setTimeout(() => setHighlightId(null), 4000);
                }
            }, 300);
        }

    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [{ data: attrs }, { data: biz }] = await Promise.all([
                supabase.from('attractions').select('*'),
                supabase.from('businesses').select('*')
            ]);

            setAttractions(attrs || []);
            setBusinesses((biz || []).map(b => ({ ...b, isBusiness: true })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const allPlaces = [
        ...attractions.map(a => ({ ...a, isBusiness: false })),
        ...businesses
    ];

    const categories = Array.from(new Set(allPlaces.map(p => p.category).filter(Boolean)));

    const filteredPlaces = allPlaces.filter(place => {
        const matchesFilter = filter === 'all' ||
            (filter === 'attractions' && !place.isBusiness) ||
            (filter === 'businesses' && place.isBusiness);

        const matchesSearch = place.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            place.description?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === 'all' || place.category === selectedCategory;

        return matchesFilter && matchesSearch && matchesCategory;
    });

    const PlaceCard = ({ place }: { place: PlaceType }) => (
        <div id={`place-${place.id}`} data-place-id={place.id} className="card-hover" style={{
            background: highlightId === place.id ? 'linear-gradient(135deg,#fffde6,#fff)' : 'white',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: highlightId === place.id ? '0 25px 60px rgba(241,196,15,0.18)' : '0 10px 30px rgba(0,0,0,0.12)',
            border: `2px solid ${place.isBusiness ? COLOR_BLUE : COLOR_GOLD}22`,
            cursor: 'pointer',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'box-shadow .3s ease, transform .3s ease, background .3s ease'
        }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = `0 20px 40px ${place.isBusiness ? COLOR_BLUE : COLOR_RED}44`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
            }}
            onClick={() => {
                // Navigate to main page and focus on this place
                if (typeof window !== 'undefined') {
                    localStorage.setItem('focusPlace', place.name);
                    window.location.href = '/';
                }
            }}
        >
            <div style={{
                position: 'relative',
                height: '220px',
                overflow: 'hidden'
            }}>
                <Image
                    src={place.image_url || "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg"}
                    alt={place.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    style={{
                        objectFit: 'cover'
                    }}
                />
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: place.isBusiness ? COLOR_BLUE : COLOR_RED,
                    color: 'white',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}>
                    {place.isBusiness ? '🏢 Negocio' : '⭐ Atractivo'}
                </div>
                {place.gallery_urls && place.gallery_urls.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                    }}>
                        📸 +{place.gallery_urls.length} fotos
                    </div>
                )}
            </div>
            <div style={{
                padding: '20px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '1.3rem',
                    fontWeight: '900',
                    color: COLOR_BLUE,
                    lineHeight: '1.3'
                }}>
                    {place.name}
                </h3>
                {place.category && (
                    <span style={{
                        alignSelf: 'flex-start',
                        background: `${COLOR_GOLD}22`,
                        color: COLOR_BLUE,
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                    }}>
                        {place.category}
                    </span>
                )}
                <p style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    color: '#555',
                    lineHeight: '1.6',
                    flex: 1
                }}>
                    {place.description?.substring(0, 120)}
                    {place.description && place.description.length > 120 ? '...' : ''}
                </p>
                <button style={{
                    background: `linear-gradient(135deg, ${place.isBusiness ? COLOR_BLUE : COLOR_RED}, ${place.isBusiness ? '#0d2442' : '#7a1515'})`,
                    color: 'white',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    marginTop: 'auto',
                    transition: 'all 0.2s ease'
                }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    Ver en el Mapa 🗺️
                </button>
                {place.gallery_urls && place.gallery_urls.length > 0 && (
                    <button style={{
                        background: `linear-gradient(135deg, ${COLOR_GOLD}, #f39c12)`,
                        color: COLOR_BLUE,
                        border: 'none',
                        padding: '12px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        marginTop: '8px',
                        transition: 'all 0.2s ease'
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setGalleryModal({ urls: place.gallery_urls!, name: place.name });
                        }}
                    >
                        Ver Galería 📸
                    </button>
                )}
                <button style={{
                    background: 'white',
                    color: COLOR_BLUE,
                    border: `2px solid ${COLOR_GOLD}`,
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    marginTop: '8px',
                    transition: 'all 0.2s ease'
                }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.background = COLOR_GOLD;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.background = 'white';
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setReviewModal({
                            isOpen: true,
                            attractionId: place.isBusiness ? undefined : place.id,
                            businessId: place.isBusiness ? place.id : undefined,
                            locationName: place.name
                        });
                    }}
                >
                    📸 Compartir Mi Experiencia
                </button>
            </div>
        </div>
    );


    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)',
            padding: '20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Header REDISEÑO REFERENCIA.PNG */}
            <header style={{
                background: 'white',
                padding: '35px',
                borderRadius: '32px',
                marginBottom: '30px',
                boxShadow: '0 15px 50px rgba(0,0,0,0.12)',
                border: `2px solid ${COLOR_GOLD}22`
            }}>
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '15px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <Link href="/" style={{
                                textDecoration: 'none',
                                background: COLOR_GOLD,
                                color: COLOR_BLUE,
                                padding: '10px 20px',
                                borderRadius: '50px',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s ease',
                                display: 'inline-block'
                            }}>
                                ← Volver al Panel
                            </Link>
                        </div>
                        <h1 style={{
                            margin: 0,
                            fontSize: 'clamp(1.8rem, 5vw, 3rem)',
                            fontWeight: '950',
                            color: COLOR_BLUE,
                            letterSpacing: '-1px'
                        }}>
                            🗺️ Explorar Santiago
                        </h1>
                    </div>

                    {/* Search and Filters */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '15px',
                        alignItems: 'center'
                    }}>
                        <input
                            type="text"
                            placeholder="🔍 Buscar lugares..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                padding: '16px 22px',
                                borderRadius: '50px',
                                border: `2px solid ${COLOR_BLUE}22`,
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />

                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as 'all' | 'attractions' | 'businesses')}
                            style={{
                                padding: '14px 20px',
                                borderRadius: '50px',
                                border: `2px solid ${COLOR_BLUE}22`,
                                fontSize: '1rem',
                                outline: 'none',
                                background: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">📍 Todos</option>
                            <option value="attractions">⭐ Atractivos</option>
                            <option value="businesses">🏢 Negocios</option>
                        </select>

                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            style={{
                                padding: '14px 20px',
                                borderRadius: '50px',
                                border: `2px solid ${COLOR_BLUE}22`,
                                fontSize: '1rem',
                                outline: 'none',
                                background: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">🏷️ Todas las categorías</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'flex',
                        gap: '20px',
                        flexWrap: 'wrap',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            background: `${COLOR_GOLD}22`,
                            padding: '18px 30px',
                            borderRadius: '20px',
                            textAlign: 'center',
                            border: `2px solid ${COLOR_GOLD}44`
                        }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: COLOR_BLUE }}>
                                {attractions.length}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>
                                Atractivos
                            </div>
                        </div>
                        <div style={{
                            background: `${COLOR_BLUE}11`,
                            padding: '15px 25px',
                            borderRadius: '20px',
                            textAlign: 'center',
                            border: `2px solid ${COLOR_BLUE}22`
                        }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: COLOR_BLUE }}>
                                {businesses.length}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>
                                Negocios Certificados
                            </div>
                        </div>
                        <div style={{
                            background: 'white',
                            padding: '18px 30px',
                            borderRadius: '20px',
                            textAlign: 'center',
                            border: `2px solid ${COLOR_GOLD}`
                        }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: COLOR_GOLD }}>
                                {filteredPlaces.length}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>
                                Resultados
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quick Categories */}
            <div style={{
                background: 'rgba(255,255,255,0.95)',
                padding: '20px',
                borderRadius: '24px',
                marginBottom: '30px',
                boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
                border: `2px solid ${COLOR_BLUE}11`
            }}>
                <h2 style={{ textAlign: 'center', color: COLOR_BLUE, marginBottom: '20px' }}>Categorías Destacadas</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                    {['Hoteles', 'Gastronomía', 'Cultura', 'Entretenimiento'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(categories.includes(cat) ? cat : 'all')}
                            style={{
                                background: 'rgba(255,255,255,0.8)',
                                color: COLOR_BLUE,
                                border: `2px solid ${COLOR_BLUE}22`,
                                padding: '10px 20px',
                                borderRadius: '50px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedCategory('all')}
                        style={{
                            background: 'rgba(255,255,255,0.8)',
                            color: COLOR_BLUE,
                            border: `2px solid ${COLOR_BLUE}22`,
                            padding: '10px 20px',
                            borderRadius: '50px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Todas
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main style={{
                maxWidth: '1400px',
                margin: '0 auto'
            }}>
                {loading ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '100px 20px',
                        color: COLOR_BLUE
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            border: `6px solid ${COLOR_BLUE}22`,
                            borderTop: `6px solid ${COLOR_GOLD}`,
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 20px'
                        }} />
                        <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                            Cargando lugares increíbles...
                        </p>
                    </div>
                ) : filteredPlaces.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '100px 20px',
                        background: 'rgba(255,255,255,0.9)',
                        borderRadius: '32px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔍</div>
                        <h2 style={{ color: COLOR_BLUE, marginBottom: '10px' }}>
                            No se encontraron resultados
                        </h2>
                        <p style={{ color: '#666' }}>
                            Intenta con otros términos de búsqueda o filtros
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '30px',
                        marginBottom: '50px'
                    }}>
                        {filteredPlaces.map(place => (
                            <PlaceCard key={place.id} place={place} />
                        ))}
                    </div>
                )}
            </main>

            {/* Galería de Experiencias de Usuarios */}
            <section style={{
                maxWidth: '1400px',
                margin: '60px auto',
                padding: '40px 20px',
                background: 'white',
                borderRadius: '32px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                border: `2px solid ${COLOR_GOLD}33`
            }}>
                <h2 style={{
                    fontSize: '2rem',
                    fontWeight: '950',
                    color: COLOR_BLUE,
                    letterSpacing: '-0.5px',
                    marginBottom: '30px',
                    textAlign: 'center'
                }}>
                    🌟 Experiencias Compartidas por Viajeros
                </h2>
                <UserReviewsGallery />
            </section>

            {/* Gallery Modal */}
            {galleryModal && (
                <GalleryModal
                    urls={galleryModal.urls}
                    name={galleryModal.name}
                    onClose={() => setGalleryModal(null)}
                />
            )}

            {/* Review Modal */}
            {reviewModal && reviewModal.isOpen && (
                <UserReviewModal
                    isOpen={reviewModal.isOpen}
                    onClose={() => setReviewModal(null)}
                    attractionId={reviewModal.attractionId}
                    businessId={reviewModal.businessId}
                    locationName={reviewModal.locationName}
                />
            )}

            <ChatInterface />

            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `
            }} />
        </div>
    );
}
