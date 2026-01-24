"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';
import GalleryModal from '@/components/GalleryModal';
import UserReviewModal from '@/components/UserReviewModal';
import UserReviewsGallery from '@/components/UserReviewsGallery';

const COLOR_PRIMARY = "#2563eb"; // Azul profesional
const COLOR_SECONDARY = "#64748b"; // Gris azulado
const COLOR_ACCENT = "#f1f5f9"; // Gris muy claro
const COLOR_TEXT = "#1e293b"; // Gris oscuro
const COLOR_BACKGROUND = "#ffffff"; // Blanco

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
    const [isMobile, setIsMobile] = useState(false);
    const router = useRouter();

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

        // Detect mobile screen
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        if (typeof window !== 'undefined') {
            checkMobile();
            window.addEventListener('resize', checkMobile);
            return () => window.removeEventListener('resize', checkMobile);
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [attrsRes, bizRes] = await Promise.all([
                supabase.from('attractions').select('id,name,description,image_url,category,lat,lng,info_extra,gallery_urls'),
                supabase.from('businesses').select('id,name,description,website_url,contact_info,category,payment_status,gallery_images,lat,lng,is_active,phone,address')
            ]);

            if (attrsRes.error) console.warn('Attractions fetch error', attrsRes.error);
            if (bizRes.error) {
                console.warn('Businesses fetch error', bizRes.error);
                console.log('⚠️ Si ves error 400, ejecuta add_missing_columns_only.sql en Supabase');
            }

            const attrs = attrsRes.data;
            const biz = bizRes.data;

            setAttractions(attrs || []);
            setBusinesses((biz || []).map(b => ({ 
                ...b, 
                isBusiness: true,
                image_url: b.gallery_images && b.gallery_images.length > 0 ? b.gallery_images[0] : null
            })));
        } catch (e) {
            console.error('fetchData error', e);
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
        <Link 
            href={`/explorar/${place.id}`}
            id={`place-${place.id}`} 
            data-place-id={place.id} 
            className="card-hover" 
            style={{
                background: highlightId === place.id ? '#fef3c7' : 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: highlightId === place.id ? '0 10px 25px rgba(37, 99, 235, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                textDecoration: 'none',
                color: 'inherit'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            }}
        >
            <div style={{
                position: 'relative',
                height: '180px',
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
                {place.category && (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        color: COLOR_TEXT,
                        padding: '4px 4px',
                        borderRadius: '2px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(231, 23, 23, 0.2)'
                    }}>
                        {place.category}
                    </span>
                )}
            </div>
            <div style={{
                padding: '12px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column'
            }}>
                <h3 style={{
                    margin: '0 0 4px 0',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: COLOR_TEXT,
                    lineHeight: '1.4'
                }}>
                    {place.name}
                </h3>
                {place.category && (
                    <span style={{
                        alignSelf: 'flex-start',
                        background: COLOR_ACCENT,
                        color: COLOR_SECONDARY,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        marginBottom: '8px'
                    }}>
                        {place.category}
                    </span>
                )}
                <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    color: COLOR_SECONDARY,
                    lineHeight: '1.5',
                    flex: 1,
                    marginBottom: '12px'
                }}>
                    {place.description?.substring(0, 120)}
                    {place.description && place.description.length > 120 ? '...' : ''}
                </p>
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap'
                }}>
                    <button style={{
                        background: COLOR_PRIMARY,
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        flex: 1,
                        minWidth: '80px'
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#1d4ed8';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = COLOR_PRIMARY;
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/explorar/${place.id}`);
                        }}
                    >
                        Ver detalles
                    </button>
                    {place.gallery_urls && place.gallery_urls.length > 0 && (
                        <button style={{
                            background: COLOR_ACCENT,
                            color: COLOR_TEXT,
                            border: '1px solid #e2e8f0',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontWeight: '500',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f1f5f9';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = COLOR_ACCENT;
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setGalleryModal({ urls: place.gallery_urls!, name: place.name });
                            }}
                        >
                            📷
                        </button>
                    )}
                </div>
            </div>
        </Link>
    );


    return (
        <div style={{
            minHeight: '100vh',
            background: '#f8fafc',
            padding: '90px 16px 16px 16px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Header - Rediseño Profesional */}
            <header style={{
                background: COLOR_BACKGROUND,
                padding: '24px',
                borderRadius: '16px',
                marginBottom: '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e2e8f0'
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    {/* Header Top */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '20px',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <Link href="/" style={{
                            textDecoration: 'none',
                            background: COLOR_ACCENT,
                            color: COLOR_TEXT,
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: '1px solid #e2e8f0'
                        }}>
                            ← Volver
                        </Link>

                        <h1 style={{
                            margin: 0,
                            fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                            fontWeight: '700',
                            color: COLOR_TEXT,
                            letterSpacing: '-0.025em'
                        }}>
                            Explorar Santiago
                        </h1>

                        <div style={{ width: '100px' }}></div> {/* Spacer for mobile balance */}
                    </div>

                    {/* Search and Filters */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        alignItems: 'center'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Buscar lugares..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    paddingLeft: '40px',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                    background: COLOR_BACKGROUND,
                                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = COLOR_PRIMARY;
                                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#d1d5db';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: COLOR_SECONDARY,
                                fontSize: '0.875rem'
                            }}>
                                🔍
                            </div>
                        </div>

                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as 'all' | 'attractions' | 'businesses')}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: '0.875rem',
                                outline: 'none',
                                background: COLOR_BACKGROUND,
                                cursor: 'pointer',
                                color: COLOR_TEXT,
                                transition: 'border-color 0.2s ease'
                            }}
                        >
                            <option value="all">Todos los lugares</option>
                            <option value="attractions">Atractivos turísticos</option>
                            <option value="businesses">Negocios</option>
                        </select>

                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: '0.875rem',
                                outline: 'none',
                                background: COLOR_BACKGROUND,
                                cursor: 'pointer',
                                color: COLOR_TEXT,
                                transition: 'border-color 0.2s ease'
                            }}
                        >
                            <option value="all">Todas las categorías</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Stats - Más discretos y responsive */}
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        marginTop: '8px'
                    }}>
                        <div style={{
                            background: COLOR_ACCENT,
                            padding: isMobile ? '8px 12px' : '12px 10px',
                            borderRadius: '8px',
                            textAlign: 'center',
                            border: '1px solid #e2e8f0',
                            minWidth: isMobile ? '70px' : '120px',
                            flex: isMobile ? 1 : 'none'
                        }}>
                            <div style={{
                                fontSize: isMobile ? '1.2rem' : '1.5rem',
                                fontWeight: '600',
                                color: COLOR_PRIMARY
                            }}>
                                {attractions.length}
                            </div>
                            <div style={{
                                fontSize: isMobile ? '0.65rem' : '0.75rem',
                                color: COLOR_SECONDARY,
                                fontWeight: '500'
                            }}>
                                Atractivos
                            </div>
                        </div>
                        <div style={{
                            background: COLOR_ACCENT,
                            padding: isMobile ? '8px 12px' : '12px 20px',
                            borderRadius: '8px',
                            textAlign: 'center',
                            border: '1px solid #e2e8f0',
                            minWidth: isMobile ? '90px' : '120px',
                            flex: isMobile ? 1 : 'none'
                        }}>
                            <div style={{
                                fontSize: isMobile ? '1.2rem' : '1.5rem',
                                fontWeight: '600',
                                color: COLOR_PRIMARY
                            }}>
                                {businesses.length}
                            </div>
                            <div style={{
                                fontSize: isMobile ? '0.65rem' : '0.75rem',
                                color: COLOR_SECONDARY,
                                fontWeight: '500'
                            }}>
                                Negocios
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quick Categories */}
            <div style={{
                background: 'rgba(255,255,255,0.95)',
                padding: isMobile ? '8px' : '10px',
                borderRadius: '24px',
                marginBottom: isMobile ? '8px' : '10px',
                boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
                border: `2px solid ${COLOR_PRIMARY}11`
            }}>
                <h2 style={{
                    textAlign: 'center',
                    color: COLOR_PRIMARY,
                    marginBottom: isMobile ? '8px' : '10px',
                    fontSize: isMobile ? '1.1rem' : '1.25rem'
                }}>
                    Categorías Destacadas
                </h2>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: isMobile ? '2px' : '6px',
                    justifyContent: 'center'
                }}>
                    {['Hoteles', 'Gastronomía', 'Cultura', 'Entretenimiento'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(categories.includes(cat) ? cat : 'all')}
                            style={{
                                background: 'rgba(255,255,255,0.8)',
                                color: COLOR_PRIMARY,
                                border: `2px solid ${COLOR_PRIMARY}22`,
                                padding: isMobile ? '1px 8px' : '2px 8px',
                                borderRadius: isMobile ? '8px' : '30px',
                                fontWeight: 'bold',
                                fontSize: isMobile ? '0.8rem' : '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                lineHeight: '1.2'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedCategory('all')}
                        style={{
                            background: 'rgba(255,255,255,0.8)',
                            color: COLOR_PRIMARY,
                            border: `2px solid ${COLOR_PRIMARY}22`,
                            padding: isMobile ? '6px 16px' : '8px 20px',
                            borderRadius: isMobile ? '16px' : '40px',
                            fontWeight: 'bold',
                            fontSize: isMobile ? '0.8rem' : '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.2'
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
                        color: COLOR_PRIMARY
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            border: `6px solid ${COLOR_PRIMARY}22`,
                            borderTop: `6px solid ${COLOR_ACCENT}`,
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
                        <h2 style={{ color: COLOR_PRIMARY, marginBottom: '10px' }}>
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
                border: `2px solid ${COLOR_ACCENT}33`
            }}>
                <h2 style={{
                    fontSize: '2rem',
                    fontWeight: '950',
                    color: COLOR_PRIMARY,
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
