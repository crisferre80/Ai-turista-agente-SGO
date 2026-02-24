"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';
import GalleryModal from '@/components/GalleryModal';
import Header from '@/components/Header';
import UserReviewModal from '@/components/UserReviewModal';
import UserReviewsGallery from '@/components/UserReviewsGallery';
import { mergeWithDefaultCategories, normalizeCategoryName, type CategoryItem } from '@/lib/categories';

// Palette adapted from PlaceDetailClient
const COLOR_PRIMARY = "#1A3A6C"; // Azul oscuro principal
const COLOR_ACCENT = "#C5A065"; // Dorado suave
const COLOR_SECONDARY = "#555555"; // Texto secundario neutro
const COLOR_TEXT = "#333333"; // Gris oscuro legible
const COLOR_BACKGROUND = "#ffffff"; // Blanco base

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
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const router = useRouter();

    useEffect(() => {
        fetchData();
        fetchCategories();
        testCategoriesQuery();
    }, []);

    useEffect(() => {
        console.log('🔄 Categories state changed:', categories.length, 'categories');
    }, [categories]);

    useEffect(() => {
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
                supabase.from('business_profiles').select('id,name,description,website_url,contact_info,category,payment_status,gallery_images,lat,lng,is_active,phone,address')
            ]);

            if (attrsRes.error) console.warn('Attractions fetch error', attrsRes.error);
            if (bizRes.error) {
                console.error('Businesses fetch error', bizRes.error);
                console.error('⚠️ ERROR: Falta agregar columnas a business_profiles');
                console.error('📝 SOLUCIÓN: Ejecuta add_missing_columns_only.sql en Supabase SQL Editor');
                console.error('📄 O ejecuta: add_coordinates_to_business_profiles.sql');
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

    const fetchCategories = async () => {
        console.log('🔍 Fetching all categories from database...');
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('name, icon, type')
                .order('type', { ascending: false })
                .order('name');

            if (error) {
                console.error('❌ Error fetching categories:', error);
                setCategories(mergeWithDefaultCategories());
            } else {
                console.log('✅ Categories fetched:', data);
                setCategories(mergeWithDefaultCategories(data || []));
            }
        } catch (err) {
            console.error('❌ Exception fetching categories:', err);
            setCategories(mergeWithDefaultCategories());
        }
    };

    const testCategoriesQuery = async () => {
        console.log('🧪 Testing categories query...');
        try {
            const { data, error, count } = await supabase
                .from('categories')
                .select('*', { count: 'exact' });

            console.log('🧪 Query result:', { data, error, count });
            return { data, error, count };
        } catch (err) {
            console.error('🧪 Query exception:', err);
            return { data: null, error: err, count: null };
        }
    };

    const allPlaces = [
        ...attractions.map(a => ({ ...a, isBusiness: false })),
        ...businesses
    ];

    const availableCategories = [...new Map(
        categories.map(cat => [cat.name, cat])
    ).values()];

    console.log('📊 Available categories:', availableCategories.length, availableCategories);

    const filteredPlaces = allPlaces.filter(place => {
        const matchesFilter = filter === 'all' ||
            (filter === 'attractions' && !place.isBusiness) ||
            (filter === 'businesses' && place.isBusiness);

        const matchesSearch = place.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            place.description?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory =
            selectedCategory === 'all' ||
            normalizeCategoryName(place.category || '', place.isBusiness ? 'business' : 'attraction') ===
                normalizeCategoryName(selectedCategory, place.isBusiness ? 'business' : 'attraction');

        return matchesFilter && matchesSearch && matchesCategory;
    });

    const PlaceCard = ({ place }: { place: PlaceType }) => (
        <Link
            href={`/explorar/${place.id}`}
            id={`place-${place.id}`}
            data-place-id={place.id}
            className="group bg-white rounded-2xl overflow-hidden shadow-xl transition-all duration-300 transform h-full flex flex-col hover:scale-105 hover:shadow-2xl"
        >
            <div className="h-48 overflow-hidden relative">
                <Image
                    src={place.image_url || "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768455560/istockphoto-1063378272-612x612_vby7gq.jpg"}
                    alt={place.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
                {place.category && (
                    <span className="absolute top-2 right-2 bg-white bg-opacity-90 text-gray-800 px-2 py-1 rounded text-xs font-semibold">
                        {place.category}
                    </span>
                )}
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{place.name}</h3>
                <p className="text-gray-600 text-sm flex-1 mb-4">
                    {place.description?.substring(0, 120)}
                    {place.description && place.description.length > 120 ? '...' : ''}
                </p>
                <div className="mt-auto flex gap-2 flex-wrap">
                    <button
                        className="flex-1 min-w-[80px] bg-[#C5A065] text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-[#b08d55] transition"
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/explorar/${place.id}`);
                        }}
                    >
                        Ver detalles
                    </button>
                    {place.gallery_urls && place.gallery_urls.length > 0 && (
                        <button
                            className="bg-gray-100 text-gray-800 border border-gray-300 py-2 px-3 rounded-md text-sm hover:bg-gray-200 transition"
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
        <div className="relative">
            <div className="side-pattern"></div>
            <div className="min-h-screen bg-gray-100 pt-[90px] px-4 font-sans">
                {/* Header compartido */}
                <Header />

                {/* Espacio para el header fijo */}
                <div className="h-[70px]" />

                {/* Page title */}
                <h1 className="text-4xl font-bold text-center text-[#1A3A6C] mb-6">
                    Explorar Santiago
                </h1>

                {/* Search Header (mismo diseño que PlaceDetailClient) */}
                <section className="flex flex-col items-center justify-center pt-8 pb-6" data-purpose="hero-search">
                <div className="bg-white rounded-lg w-full max-w-5xl flex flex-col md:flex-row p-1 gap-2 items-center shadow-lg">
                    <div className="relative flex-grow w-full md:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fas fa-search text-gray-400" />
                        </div>
                        <input
                            className="block w-full pl-10 pr-3 py-3 border-none rounded-lg focus:ring-0 text-gray-700 text-lg placeholder-gray-600"
                            placeholder="Buscar lugares..."
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="hidden md:block w-px h-8 bg-gray-200" />
                    <div className="relative min-w-[180px] w-full md:w-auto">
                        <select
                            className="block w-full pl-3 pr-8 py-3 border-none rounded-lg bg-transparent focus:ring-0 text-gray-600 cursor-pointer appearance-none"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as 'all' | 'attractions' | 'businesses')}
                        >
                            <option value="all">Todos los lugares</option>
                            <option value="attractions">Atractivos turísticos</option>
                            <option value="businesses">Negocios</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                            <i className="fas fa-chevron-down text-xs" />
                        </div>
                    </div>
                    <div className="hidden md:block w-px h-8 bg-gray-200" />
                    <div className="relative min-w-[180px] w-full md:w-auto">
                        <select
                            className="block w-full pl-3 pr-8 py-3 border-none rounded-lg bg-transparent focus:ring-0 text-gray-600 cursor-pointer appearance-none"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="all">Todas las categorías</option>
                            {availableCategories.map(cat => (
                                <option key={`${cat.name}-${cat.type}`} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                            <i className="fas fa-chevron-down text-xs" />
                        </div>
                    </div>
                    <button className="w-full md:w-auto bg-[#C5A065] hover:bg-[#b08d55] text-white font-medium py-2 px-8 rounded-md shadow-sm transition-colors duration-200 text-base">
                        Buscar
                    </button>
                </div>
            </section>

            {/* Stats Section */}
            <section className="flex flex-wrap justify-center gap-6 mt-4 mb-10" data-purpose="statistics">
                <div className="bg-white border border-[#C5A065] rounded-lg px-10 py-4 flex flex-col items-center gap-1 shadow-sm min-w-[180px]">
                    <div className="text-[#C5A065] text-2xl mb-1">
                        <i className="fas fa-landmark" />
                    </div>
                    <span className="block text-3xl font-bold text-gray-800 leading-none">{attractions.length}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-medium mt-1">Atractivos</span>
                </div>
                <div className="bg-white border border-[#C5A065] rounded-lg px-10 py-4 flex flex-col items-center gap-1 shadow-sm min-w-[180px]">
                    <div className="text-[#C5A065] text-2xl mb-1">
                        <i className="fas fa-store" />
                    </div>
                    <span className="block text-3xl font-bold text-gray-800 leading-none">{businesses.length}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-medium mt-1">Negocios</span>
                </div>
            </section>

            {/* Quick Categories with dynamic styling (tailwind layout, inline colour) */}
            <section className="text-center mb-8" data-purpose="category-filters">
                <h2 className="text-3xl font-serif text-gray-800 mb-6 relative inline-block">
                    Categorías Destacadas
                </h2>
                <div className="flex flex-wrap justify-center gap-2">
                    {availableCategories.slice(0, 4).map(cat => (
                        <button
                            key={`${cat.name}-${cat.type}`}
                            onClick={() => setSelectedCategory(cat.name)}
                            className="px-3 py-1 rounded-full font-bold text-sm transition duration-200 whitespace-nowrap"
                            style={{
                                background: 'rgba(255,255,255,0.8)',
                                color: COLOR_PRIMARY,
                                border: `2px solid ${COLOR_PRIMARY}22`
                            }}
                        >
                            {cat.name}
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedCategory('all')}
                            className="px-4 py-1 rounded-full font-bold text-sm transition duration-200 whitespace-nowrap"
                            style={{
                                background: 'rgba(255,255,255,0.8)',
                                color: COLOR_PRIMARY,
                                border: `2px solid ${COLOR_PRIMARY}22`
                            }}
                        >
                            Todas
                        </button>
                </div>
            </section>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8 relative z-10">
                {loading ? (
                    <div className="text-center py-24 text-gray-800">
                        <div className="w-14 h-14 border-8 border-[#1A3A6C]22 border-t-8 border-t-[#C5A065] rounded-full animate-spin mx-auto mb-5" />
                        <p className="text-xl font-bold">Cargando lugares increíbles...</p>
                    </div>
                ) : filteredPlaces.length === 0 ? (
                    <div className="text-center py-24 bg-white bg-opacity-90 rounded-2xl shadow-lg">
                        <div className="text-4xl mb-5">🔍</div>
                        <h2 className="text-[#1A3A6C] mb-2">No se encontraron resultados</h2>
                        <p className="text-gray-600">Intenta con otros términos de búsqueda o filtros</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-8 mb-12">
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
                    /* background gradient and side pattern from interface.htm */
                    body {
                        background: linear-gradient(90deg, #FDF5E6 0%, #F0F8FF 50%, #E0F7FA 100%);
                        min-height: 100vh;
                        position: relative;
                    }
                    .side-pattern {
                        position: absolute;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        width: 10%;
                        background-image: repeating-linear-gradient(45deg, #d2b48c 0, #d2b48c 1px, transparent 0, transparent 50%);
                        background-size: 20px 20px;
                        opacity: 0.15;
                        pointer-events: none;
                        z-index: -1;
                        mask-image: linear-gradient(to right, black, transparent);
                    }
                    /* custom scrollbar */
                    ::-webkit-scrollbar {
                        width: 8px;
                    }
                    ::-webkit-scrollbar-track {
                        background: #f1f1f1;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #C5A065;
                        border-radius: 4px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #a88650;
                    }
                `
            }} />
        </div>
    </div>
    );
}
