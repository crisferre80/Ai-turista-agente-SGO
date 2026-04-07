"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminMap from '@/components/AdminMap';
import AdminAISettings from '@/components/AdminAISettings';
import { takePhoto } from '@/lib/photoService';
import { getDefaultCategories, mergeWithDefaultCategories, normalizeCategoryName } from '@/lib/categories';
import { generateUniqueFileName } from '@/lib/sanitize-filename';
import { getErrorMessage, logError } from '@/lib/error-handler';
import VisionAnalysisPanel from '@/components/admin/VisionAnalysisPanel';

// Tipos básicos usados en este panel

// lista de URLs estáticas que se usan como último recurso en la app pública
const DEFAULT_CAROUSEL_IMAGES = [
    '/fotos/ciudadsgo.jpg',
    '/fotos/dique.jfif',
    '/fotos/estadio.jpg',
    '/fotos/pergola.jpg',
    '/fotos/termas costanera.jpg',
    '/fotos/parqueencuentro1-1.jpeg',
    '/fotos/municapi_plazasarmiento.jpg',
    '/fotos/ccb.jpg',
    '/fotos/faap.jpg',
    '/fotos/puente.jpg',
    '/fotos/central.jpg',
    '/fotos/catedral.jpg'
];

interface PlaceRecord {
    id?: string;
    name: string;
    description?: string;
    description_en?: string;
    description_pt?: string;
    description_fr?: string;
    lat: number;
    lng: number;
    image_url?: string;
    info_extra?: string;
    category: string;
    gallery_urls?: string[];
    video_urls?: string[];
}

interface VideoRecord { id: string; title: string; video_url: string }
interface BusinessRecord {
    id?: string;
    name: string;
    category: string;
    description?: string;
    description_en?: string;
    description_pt?: string;
    description_fr?: string;
    contact_info?: string;
    website_url?: string;
    image_url?: string;
    lat: number;
    lng: number;
}

interface UserRecord {
    id: string;
    name: string;
    email: string;
    role: 'tourist' | 'business' | 'admin';
    avatar_url: string | null;
    created_at: string;
    bio?: string;
    country?: string;
    city?: string;
    age?: number;
    phone?: string;
}

interface CarouselPhoto {
    id: string;
    image_url: string;
    title?: string;
    description?: string;
    order_position?: number;
    is_active?: boolean;
}

type GalleryTarget = 'place-main' | 'place-gallery' | 'business-main';

interface BucketImageItem {
    name: string;
    path: string;
    url: string;
    updatedAt?: string;
}

type StorageEntry = {
    id?: string | null;
    name: string;
    updated_at?: string | null;
    metadata?: Record<string, unknown> | null;
};

export default function AdminDashboard() {
    const COLOR_GOLD = '#F1C40F';
    const COLOR_BLUE = '#1A3A6C';
    const COLOR_DARK = '#0e1f1d';
    
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('lugares');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Data State
    const [places, setPlaces] = useState<PlaceRecord[]>([]);
    const [videos, setVideos] = useState<VideoRecord[]>([]);
    const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
    const [carouselPhotos, setCarouselPhotos] = useState<CarouselPhoto[]>([]);
    const [carouselDuration, setCarouselDuration] = useState<number>(25); // segundos por bucle completo
    const [phrases, setPhrases] = useState<Array<{id: string, phrase: string, category: string}>>([]);
    const [promotionalMessages, setPromotionalMessages] = useState<Array<{id: string, business_name: string, message: string, message_en?: string, message_pt?: string, message_fr?: string, is_active: boolean, category: string, priority: number, show_probability: number, image_url?: string, video_url?: string}>>([]);
    const [attractionCategories, setAttractionCategories] = useState<Array<{name: string, icon: string, type: string}>>([]);
    const [businessCategories, setBusinessCategories] = useState<Array<{name: string, icon: string, type: string}>>([]);
    // Usuarios
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'tourist' | 'business' | 'admin'>('all');
    const [selectedUserDetail, setSelectedUserDetail] = useState<UserRecord | null>(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUserRole, setEditingUserRole] = useState<'tourist' | 'business' | 'admin' | null>(null);

    // Form States
    const [editingId, setEditingId] = useState<string | null>(null);
    const defaultAttractionCategory = getDefaultCategories('attraction')[0]?.name || 'histórico';
    const [newPlace, setNewPlace] = useState({
        name: '', lat: -27.7834, lng: -64.2599,
        // description fields, spanish is stored in `desc` for backwards compatibility
        desc: '', desc_en: '', desc_pt: '', desc_fr: '',
        img: '', info: '', category: defaultAttractionCategory, gallery: [] as string[], videoUrls: [''] as string[]
    });
    const [placeDescLang, setPlaceDescLang] = useState<'es'|'en'|'pt'|'fr'>('es');
    const [newPhrase, setNewPhrase] = useState({ text: '', category: 'general' });

    // estado para traducciones automáticas
    const [translateItem, setTranslateItem] = useState<PlaceRecord | null>(null);
    const [translateLang, setTranslateLang] = useState<'en'|'pt'|'fr'>('en');
    const [translateField, setTranslateField] = useState<'name'|'description'>('description');
    const [translateResult, setTranslateResult] = useState<string>('');
    const [translating, setTranslating] = useState(false);

    const closeTranslator = () => setTranslateItem(null);
    const doTranslate = async () => {
        if (!translateItem) return;
        setTranslating(true);
        const original = translateItem[translateField] || '';
        const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: original, target: translateLang })
        });
        const json = await res.json();
        setTranslating(false);
        if (json.translatedText) setTranslateResult(json.translatedText);
        else alert('Error traduciendo: ' + (json.error||''));
    };
    const saveTranslation = async () => {
        if (!translateItem) return;
        const col = `${translateField}_${translateLang}`;
        await supabase.from('attractions').update({ [col]: translateResult }).eq('id', translateItem.id);
        fetchData();
        closeTranslator();
    };

    const TranslateModal = () => {
        if (!translateItem) return null;
        return (
            <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000 }}>
                <div style={{ background:'white',padding:20,borderRadius:12,width:'90%',maxWidth:500 }}>
                    <h3>Traducir {translateField} a {translateLang.toUpperCase()}</h3>
                    <textarea readOnly rows={3} style={{ width:'100%' }} value={translateItem[translateField] || ''} />
                    <div style={{ margin:'10px 0' }}>
                        <select value={translateLang} onChange={e=>setTranslateLang(e.target.value as 'en'|'pt'|'fr')}>
                            <option value="en">English</option>
                            <option value="pt">Português</option>
                            <option value="fr">Français</option>
                        </select>
                        <select value={translateField} onChange={e=>setTranslateField(e.target.value as 'name'|'description')} style={{ marginLeft:8 }}>
                            <option value="name">Nombre</option>
                            <option value="description">Descripción</option>
                        </select>
                        <button onClick={doTranslate} disabled={translating} style={{ marginLeft:8 }}>{translating?'⏳':'Traducir'}</button>
                    </div>
                    {translateResult && (
                        <>
                            <textarea rows={3} style={{ width:'100%' }} value={translateResult} onChange={e=>setTranslateResult(e.target.value)} />
                            <button onClick={saveTranslation} style={{ marginTop:8 }}>Guardar</button>
                        </>
                    )}
                    <button onClick={closeTranslator} style={{ marginTop:12 }}>Cerrar</button>
                </div>
            </div>
        );
    };

    const [newPromotionalMessage, setNewPromotionalMessage] = useState({ business_name: '', message: '', message_en: '', message_pt: '', message_fr: '', category: 'general', priority: 5, show_probability: 25, image_url: '', video_url: '' });
    const [editingPromotionalMessageId, setEditingPromotionalMessageId] = useState<string | null>(null);
    const [newVideo, setNewVideo] = useState({ title: '', url: '' });
    // gallery states restored
    const [, setGalleryFolders] = useState<string[]>([]);
    const [, setGalleryTarget] = useState<GalleryTarget>('place-main');
    const [, setGalleryLoading] = useState(false);
    const [, setGalleryError] = useState('');
    const [includeSubfolders] = useState(true);
    const [newBusiness, setNewBusiness] = useState({
        id: '', name: '', category: 'restaurante',
        // multilingual description
        description: '', description_en: '', description_pt: '', description_fr: '',
        contact: '', website: '', image_url: '', lat: -27.7834, lng: -64.2599
    });
    const [bizDescLang, setBizDescLang] = useState<'es'|'en'|'pt'|'fr'>('es');

    // helpers to get/set the appropriate description field based on selected language
    const getPlaceDesc = (lang: string) => {
        switch (lang) {
            case 'en': return newPlace.desc_en;
            case 'pt': return newPlace.desc_pt;
            case 'fr': return newPlace.desc_fr;
            case 'es':
            default:
                return newPlace.desc;
        }
    };
    const setPlaceDesc = (lang: string, val: string) => {
        setNewPlace(prev => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const copy = { ...prev } as any;
            if (lang === 'en') copy.desc_en = val;
            else if (lang === 'pt') copy.desc_pt = val;
            else if (lang === 'fr') copy.desc_fr = val;
            else copy.desc = val;
            return copy;
        });
    };

    const getBizDesc = (lang: string) => {
        switch (lang) {
            case 'en': return newBusiness.description_en;
            case 'pt': return newBusiness.description_pt;
            case 'fr': return newBusiness.description_fr;
            case 'es':
            default:
                return newBusiness.description;
        }
    };
    const setBizDesc = (lang: string, val: string) => {
        setNewBusiness(prev => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const copy = { ...prev } as any;
            if (lang === 'en') copy.description_en = val;
            else if (lang === 'pt') copy.description_pt = val;
            else if (lang === 'fr') copy.description_fr = val;
            else copy.description = val;
            return copy;
        });
    };

    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
    const [businessFile, setBusinessFile] = useState<File | null>(null);
    const [newPlaceSelectedFileName, setNewPlaceSelectedFileName] = useState('');
    const [newBusinessSelectedFileName, setNewBusinessSelectedFileName] = useState('');
    const [carouselFile, setCarouselFile] = useState<File | null>(null);
    const placeFileInputRef = useRef<HTMLInputElement>(null);
    const galleryFileInputRef = useRef<HTMLInputElement>(null);
    const businessFileInputRef = useRef<HTMLInputElement>(null);
    const [newCarouselPhoto, setNewCarouselPhoto] = useState({ title: '', description: '' });
    const [generatingDesc, setGeneratingDesc] = useState(false);
    const [generatingPromo, setGeneratingPromo] = useState(false);

    // Filter States
    const [placeSearch, setPlaceSearch] = useState('');
    const [placeCategoryFilter, setPlaceCategoryFilter] = useState('');
    const [businessSearch, setBusinessSearch] = useState('');
    const [businessCategoryFilter, setBusinessCategoryFilter] = useState('');

    // Category States
    const [newCategory, setNewCategory] = useState({ name: '', icon: '', type: 'attraction' });

    // Storage gallery states
    const [storageBuckets, setStorageBuckets] = useState<Array<{ id: string; name: string; public: boolean }>>([]);
    const [selectedBucket, setSelectedBucket] = useState('');
    const [selectedFolderPath, setSelectedFolderPath] = useState('');
    
    // Plans States
    const [plans, setPlans] = useState<Array<{id: string, name: string, display_name: string, price_monthly: number, price_yearly: number, features: string[], mercadopago_id: string, max_images: number, priority: number, is_active: boolean}>>([]);
    const [newPlan, setNewPlan] = useState({ name: '', display_name: '', price_monthly: 0, price_yearly: 0, features: [] as string[], mercadopago_id: '', max_images: 5, priority: 0 });
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

    // Backup/Export states
    const [exporting, setExporting] = useState(false);
    const [selectedExportTable, setSelectedExportTable] = useState<string>('');

    // lista de tablas que queremos poder volcar (ajustar cuando se agreguen nuevas)
    // tablas reales usadas en la aplicación
    const EXPORT_TABLES = [
        'profiles',
        'categories',
        'business_profiles',
        'attractions',
        'narrations',
        'promotional_messages',
        'santis_phrases',      // la tabla de frases se llama santis_phrases
        'carousel_photos',
        'app_videos',          // videos se guardan en app_videos
        'business_plans',      // planes reales
        'businesses' // vista, pero los datos son los mismos que business_profiles
    ];

    // Función para asegurar autenticación antes de operaciones de escritura
    const ensureAuthenticated = useCallback(async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            // Intentar refrescar la sesión
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.user) {
                alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
                router.push('/login');
                return false;
            }
        }
        return true;
    }, [router]);

    // Al volver desde /admin/image-manager en modo "nuevo atractivo",
    // leer las imágenes seleccionadas desde localStorage y aplicarlas al formulario.
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mainImage = window.localStorage.getItem('pendingNewPlaceMainImage');
        const galleryImagesRaw = window.localStorage.getItem('pendingNewPlaceGalleryImages');

        if (mainImage) {
            setNewPlace(prev => ({ ...prev, img: mainImage }));
            window.localStorage.removeItem('pendingNewPlaceMainImage');
        }

        if (galleryImagesRaw) {
            try {
                const galleryImages = JSON.parse(galleryImagesRaw) as string[];
                if (Array.isArray(galleryImages) && galleryImages.length > 0) {
                    setNewPlace(prev => ({ ...prev, gallery: [...prev.gallery, ...galleryImages] }));
                }
            } catch {
                // Ignorar errores de parseo
            }
            window.localStorage.removeItem('pendingNewPlaceGalleryImages');
        }
    }, []);



    const fetchData = useCallback(async () => {
        setLoading(true);
        // ensure no corrupted carousel rows exist
        const { error: cleanupErr } = await supabase.from('carousel_photos').delete().is('image_url', null);
        if (cleanupErr) console.warn('Admin: error cleaning null carousel rows', cleanupErr);

        const { data: attData, error: attErr } = await supabase.from('attractions').select('id,name,description,description_en,description_pt,description_fr,lat,lng,image_url,info_extra,category,gallery_urls,video_urls').order('created_at', { ascending: false });
        const { data: bizData, error: bizErr } = await supabase.from('business_profiles').select('id,name,category,description,description_en,description_pt,description_fr,contact_info,website_url,gallery_images,is_active,payment_status,phone,address,lat,lng').order('created_at', { ascending: false });
        const { data: vidData, error: vidErr } = await supabase.from('app_videos').select('id,title,video_url,created_at').order('created_at', { ascending: false });
        let carouselData;
        const { data, error: carouselErr } = await supabase.from('carousel_photos').select('id,image_url,title,order_position,is_active').order('order_position', { ascending: true });
        carouselData = data;
        const { data: phraseData, error: phraseErr } = await supabase.from('santis_phrases').select('id,phrase,category').order('created_at', { ascending: false });
        const { data: promotionalData } = await supabase.from('promotional_messages').select('id,business_name,message,message_en,message_pt,message_fr,is_active,category,priority,show_probability,image_url,video_url').order('priority', { ascending: false });
        const { data: plansData, error: plansErr } = await supabase.from('business_plans').select('*').order('priority', { ascending: true });
        const { data: configData, error: configErr } = await supabase.from('carousel_settings').select('animation_duration').eq('key','global').maybeSingle();

        if (attErr) console.warn('Admin attractions fetch error', attErr);
        if (configErr) console.warn('Admin carousel settings fetch error', configErr);
        if (configData && configData.animation_duration != null) {
            setCarouselDuration(parseFloat(configData.animation_duration));
        }
        if (bizErr) console.warn('Admin businesses fetch error', bizErr);
        if (vidErr) console.warn('Admin videos fetch error', vidErr);
        if (carouselErr) console.warn('Admin carousel fetch error', carouselErr);
        if (phraseErr) console.warn('Admin phrases fetch error', phraseErr);
        if (plansErr) console.warn('Admin plans fetch error', plansErr);
        console.log('Admin: Plans error:', plansErr);

        // si no hay fotos en la base, sembrar las predeterminadas para que el panel las muestre
        if ((!carouselData || carouselData.length === 0) && DEFAULT_CAROUSEL_IMAGES.length > 0) {
            console.log('Admin: Sembrando carrusel con imágenes predeterminadas');
            const seeding = DEFAULT_CAROUSEL_IMAGES
                .filter(url => url) // omit empty/null entries
                .map((url, idx) => ({
                    image_url: url,
                    title: '',
                    description: '',
                    order_position: idx,
                    is_active: true
                }));
            if (seeding.length > 0) {
                const { error: seedErr } = await supabase.from('carousel_photos').insert(seeding);
                if (seedErr) {
                    console.error('Admin: error al sembrar carrusel', seedErr);
                } else {
                    const { data: newData } = await supabase.from('carousel_photos').select('id,image_url,title,order_position,is_active').order('order_position', { ascending: true });
                    carouselData = newData || [];
                }
            }
        }

        if (attData) setPlaces(attData as PlaceRecord[]);
        if (bizData) setBusinesses(bizData as BusinessRecord[]);
        if (vidData) setVideos(vidData as VideoRecord[]);
        if (carouselData) setCarouselPhotos(carouselData);
        if (phraseData) setPhrases(phraseData);
        if (promotionalData) {
            setPromotionalMessages(promotionalData as Array<{
                id: string;
                business_name: string;
                message: string;
                message_en?: string;
                message_pt?: string;
                message_fr?: string;
                is_active: boolean;
                category: string;
                priority: number;
                show_probability: number;
                image_url?: string;
                video_url?: string;
            }>);
        }
        if (plansData) setPlans(plansData.map(p => ({ ...p, features: Array.isArray(p.features) ? p.features : [] })));
        console.log('Admin: Loaded plans:', plansData);
        setLoading(false);
    }, []);

    const fetchCategories = useCallback(async () => {
        console.log('🔍 Admin: Fetching categories...');
        try {
            // Usar REST API directo para evitar problemas con Supabase-js
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
            
            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Supabase not configured');
            }
            
            const url = `${supabaseUrl}/rest/v1/categories?select=name,icon,type`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Admin: Categories fetched:', data);
            const mergedCategories = mergeWithDefaultCategories(data || []);
            const attractions = mergedCategories.filter(cat => cat.type === 'attraction');
            const businesses = mergedCategories.filter(cat => cat.type === 'business');
            setAttractionCategories(attractions);
            setBusinessCategories(businesses);
        } catch (error) {
            console.error('Admin categories fetch error', error);
            const fallback = getDefaultCategories();
            setAttractionCategories(fallback.filter(cat => cat.type === 'attraction'));
            setBusinessCategories(fallback.filter(cat => cat.type === 'business'));
        }
    }, []);

    // Fetch Users for Admin Panel
    const fetchUsers = useCallback(async () => {
        console.log('🔍 Fetching all users from API...');
        try {
            const response = await fetch('/api/admin/users');
            console.log('📡 API response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API error response:', errorText);
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Users fetched:', data.length || 0, data);
            setUsers(data as UserRecord[]);
        } catch (err) {
            console.error('❌ Exception fetching users:', err);
            logError('Cargar usuarios del admin', err);
            alert(getErrorMessage(err));
            setUsers([]);
        }
    }, []);

    // moved authentication check below data helpers
    const checkAuth = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const legacyAuth = localStorage.getItem('adminToken');

        if (!user && legacyAuth !== 'granted') {
            router.push('/login');
        } else {
            setIsAuthorized(true);
            fetchData();
            fetchCategories();
            fetchUsers();
        }
    }, [router, fetchData, fetchCategories, fetchUsers]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const loadStoragePath = useCallback(async (bucketName: string, folderPath: string, recursive = includeSubfolders) => {
        if (!bucketName) return;

        console.log(`🔍 loadStoragePath: Cargando ${bucketName}/${folderPath || 'raíz'} (recursive: ${recursive})`);
        setGalleryLoading(true);
        setGalleryError('');

        try {
            // Verificar y refrescar autenticación antes de acceder a Storage
            await ensureAuthenticated();

            const normalizedFolderPath = folderPath.replace(/^\/+|\/+$/g, '');
            const imageRegex = /\.(png|jpe?g|webp|gif|avif|jfif|bmp|svg)$/i;
            const isImageFile = (entry: StorageEntry) => !!entry.name && imageRegex.test(entry.name);
            const isFolder = (entry: StorageEntry) => !isImageFile(entry) && (!entry.id || !entry.metadata);

            const listAtPath = async (path: string) => {
                console.log(`🔍 listAtPath: Listando ${bucketName}/${path || 'raíz'}`);
                const { data, error } = await supabase.storage
                    .from(bucketName)
                    .list(path, {
                        limit: 200,
                        offset: 0,
                        sortBy: { column: 'name', order: 'asc' }
                    });

                if (error) {
                    console.error(`❌ listAtPath: Error listando ${bucketName}/${path}:`, error);
                    // Si es error de autenticación, intentar refrescar sesión
                    if (error.message.includes('JWT') || error.message.includes('auth') || error.message === 'Failed to fetch') {
                        console.log('Error de autenticación detectado, intentando refrescar sesión...');
                        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                        if (refreshError) {
                            throw new Error(`Sesión expirada: ${refreshError.message}`);
                        }
                        if (refreshData.user) {
                            // Reintentar la operación después de refrescar
                            const { data: retryData, error: retryError } = await supabase.storage
                                .from(bucketName)
                                .list(path, {
                                    limit: 200,
                                    offset: 0,
                                    sortBy: { column: 'name', order: 'asc' }
                                });
                            if (retryError) throw retryError;
                            return (retryData || []) as StorageEntry[];
                        }
                    }
                    throw error;
                }
                console.log(`✅ listAtPath: Encontrados ${data?.length || 0} elementos en ${bucketName}/${path}`);
                return (data || []) as StorageEntry[];
            };

            const entries = await listAtPath(normalizedFolderPath);
            const prefix = normalizedFolderPath ? `${normalizedFolderPath}/` : '';

            const folders = entries
                .filter(entry => isFolder(entry))
                .map(entry => entry.name)
                .filter(Boolean);

            console.log(`📁 loadStoragePath: Carpetas encontradas:`, folders);

            const fallbackImageFolders = ['avatars', 'carousel', 'uploads', 'user-reviews'];
            const normalizedFolders = normalizedFolderPath === '' && bucketName === 'images' && folders.length === 0
                ? fallbackImageFolders
                : folders;

            console.log(`📁 loadStoragePath: Carpetas normalizadas:`, normalizedFolders);

            let images: BucketImageItem[] = entries
                .filter(entry => !isFolder(entry) && isImageFile(entry))
                .map((entry) => {
                    const fullPath = `${prefix}${entry.name}`;
                    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fullPath);
                    return {
                        name: entry.name,
                        path: fullPath,
                        url: publicData.publicUrl,
                        updatedAt: entry.updated_at || undefined
                    };
                });

            console.log(`🖼️ loadStoragePath: Imágenes encontradas en raíz: ${images.length}`);

            if (recursive && normalizedFolders.length > 0) {
                console.log(`🔄 loadStoragePath: Explorando subcarpetas recursivamente...`);
                const queue = normalizedFolders.map(folder => (normalizedFolderPath ? `${normalizedFolderPath}/${folder}` : folder));
                let traversed = 0;

                while (queue.length > 0 && traversed < 50) {
                    const currentPath = queue.shift()!;
                    traversed += 1;
                    console.log(`🔄 Explorando: ${currentPath}`);
                    const nestedEntries = await listAtPath(currentPath);

                    for (const entry of nestedEntries) {
                        if (isFolder(entry)) {
                            queue.push(`${currentPath}/${entry.name}`);
                            continue;
                        }

                        if (isImageFile(entry)) {
                            const nestedFullPath = `${currentPath}/${entry.name}`;
                            const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(nestedFullPath);
                            images.push({
                                name: entry.name,
                                path: nestedFullPath,
                                url: publicData.publicUrl,
                                updatedAt: entry.updated_at || undefined
                            });
                        }
                    }
                }
                console.log(`🖼️ loadStoragePath: Total imágenes después de recursión: ${images.length}`);
            }

            images = images.filter((item, index, arr) => arr.findIndex(check => check.path === item.path) === index);

            console.log(`✅ loadStoragePath: Final - Carpetas: ${normalizedFolders.length}, Imágenes: ${images.length}`);

            setSelectedBucket(bucketName);
            setSelectedFolderPath(normalizedFolderPath);
            setGalleryFolders(normalizedFolders);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            console.error('❌ loadStoragePath: Error:', msg);
            setGalleryError(msg);
            setGalleryFolders([]);
        }

        setGalleryLoading(false);
    }, [includeSubfolders, ensureAuthenticated]);

    const loadStorageBuckets = useCallback(async () => {
        console.log('🔍 loadStorageBuckets: Iniciando carga de buckets...');
        setGalleryLoading(true);
        setGalleryError('');
        try {
            // Verificar y refrescar autenticación antes de acceder a Storage
            await ensureAuthenticated();

            console.log('🔍 loadStorageBuckets: Autenticación verificada, listando buckets...');
            const { data, error } = await supabase.storage.listBuckets();
            if (error) {
                // Si es error de autenticación, intentar refrescar sesión
                if (error.message.includes('JWT') || error.message.includes('auth') || error.message === 'Failed to fetch') {
                    console.log('Error de autenticación detectado en listBuckets, intentando refrescar sesión...');
                    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                    if (refreshError) {
                        throw new Error(`Sesión expirada: ${refreshError.message}`);
                    }
                    if (refreshData.user) {
                        // Reintentar la operación después de refrescar
                        const { data: retryData, error: retryError } = await supabase.storage.listBuckets();
                        if (retryError) throw retryError;
                        const buckets = (retryData || []).map(bucket => ({
                            id: bucket.id,
                            name: bucket.name,
                            public: !!bucket.public
                        }));
                        console.log('🔍 loadStorageBuckets: Buckets cargados (retry):', buckets);
                        setStorageBuckets(buckets);
                        if (buckets.length > 0) {
                            const initialBucket = selectedBucket || buckets[0].name;
                            setSelectedBucket(initialBucket);
                            await loadStoragePath(initialBucket, '');
                        }
                        setGalleryLoading(false);
                        return;
                    }
                }
                throw error;
            }

            const buckets = (data || []).map(bucket => ({
                id: bucket.id,
                name: bucket.name,
                public: !!bucket.public
            }));

            console.log('🔍 loadStorageBuckets: Buckets cargados:', buckets);

            // Si no se cargaron buckets (posible problema de permisos), usar buckets conocidos
            if (buckets.length === 0) {
                console.log('🔍 loadStorageBuckets: No se cargaron buckets, usando fallback conocidos...');
                const knownBuckets = [
                    { id: 'images', name: 'images', public: true },
                    { id: 'audios', name: 'audios', public: true },
                    { id: 'email-images', name: 'email-images', public: true },
                    { id: 'ar-content', name: 'ar-content', public: true }
                ];
                setStorageBuckets(knownBuckets);
                setSelectedBucket('images');
                await loadStoragePath('images', '');
                setGalleryLoading(false);
                return;
            }

            setStorageBuckets(buckets);

            if (buckets.length > 0) {
                const initialBucket = selectedBucket || buckets[0].name;
                setSelectedBucket(initialBucket);
                await loadStoragePath(initialBucket, '');
            } else {
                setGalleryFolders([]);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            console.error('❌ loadStorageBuckets: Error:', msg);
            const fallbackBuckets = [
                { id: 'images', name: 'images', public: true },
                { id: 'audios', name: 'audios', public: true },
                { id: 'email-images', name: 'email-images', public: true },
                { id: 'ar-content', name: 'ar-content', public: true }
            ];

            setStorageBuckets(fallbackBuckets);
            setSelectedBucket('images');
            await loadStoragePath('images', '', includeSubfolders);
            setGalleryError(`No se pudieron listar buckets con el rol actual (${msg}). Se cargó fallback.`);
        }
        setGalleryLoading(false);
    }, [selectedBucket, includeSubfolders, ensureAuthenticated, loadStoragePath]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const openGalleryForTarget = (target: GalleryTarget, preferredBucket = 'images') => {
        setGalleryTarget(target);
        setActiveTab('galeria');

        const hasPreferredBucket = storageBuckets.some(bucket => bucket.name === preferredBucket);
        if (hasPreferredBucket) {
            setSelectedBucket(preferredBucket);
            loadStoragePath(preferredBucket, '', includeSubfolders);
            return;
        }

        if (selectedBucket) {
            loadStoragePath(selectedBucket, selectedFolderPath, includeSubfolders);
            return;
        }

        loadStorageBuckets();
    };

    useEffect(() => {
        if (activeTab === 'galeria') {
            console.log('🔍 useEffect: Pestaña galería activada, cargando buckets...');
            loadStorageBuckets();
        } else {
            console.log('🔍 useEffect: Pestaña activa:', activeTab);
        }
    }, [activeTab, loadStorageBuckets]);

    // Helper: Client-side Image Compression
    const compressImage = async (file: File): Promise<File> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg', lastModified: Date.now() }));
                        } else resolve(file);
                    }, 'image/jpeg', 0.82); // 82% quality is a good sweet spot
                };
            };
        });
    };

    const handleFileUpload = async (file: File, bucket: string) => {
        try {
            const compressed = await compressImage(file);
            const fileExt = "jpg";
            const fileName = generateUniqueFileName(`${Date.now()}.${fileExt}`);
            const filePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, compressed);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
            return publicUrl;
        } catch (e: unknown) {
            logError('Subir archivo', e);
            alert(getErrorMessage(e));
            return null;
        }
    };

    const captureImage = async (target: 'place' | 'business' | 'gallery') => {
        const photo = await takePhoto();
        if (photo) {
            // Convert Blob to File to keep compatibility with existing upload logic
            const file = new File([photo.blob], `camera-${Date.now()}.${photo.format}`, { type: `image/${photo.format}` });
            if (target === 'place') {
                setUploadFile(file);
                // Preview for user
                setNewPlace(prev => ({ ...prev, img: URL.createObjectURL(file) }));
            }
            else if (target === 'business') {
                setBusinessFile(file);
                setNewBusiness(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
            }
            else if (target === 'gallery') {
                setGalleryFiles(prev => [...prev, file]);
            }
        }
    };

    const updatePlaceVideoAt = (index: number, value: string) => {
        setNewPlace(prev => ({
            ...prev,
            videoUrls: prev.videoUrls.map((videoUrl, idx) => (idx === index ? value : videoUrl))
        }));
    };

    const addPlaceVideoField = () => {
        setNewPlace(prev => ({ ...prev, videoUrls: [...prev.videoUrls, ''] }));
    };

    const removePlaceVideoField = (index: number) => {
        setNewPlace(prev => {
            const nextVideoUrls = prev.videoUrls.filter((_, idx) => idx !== index);
            return { ...prev, videoUrls: nextVideoUrls.length > 0 ? nextVideoUrls : [''] };
        });
    };

    // ---------- Export / backup helpers ----------
    const downloadString = (content: string, filename: string, mimeType = 'text/plain') => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toSqlInserts = <T extends Record<string, unknown>>(table: string, data: T[]) => {
        if (!data || data.length === 0) return '';
        const cols = Object.keys(data[0]);
        const escapeVal = (v: unknown) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number' || typeof v === 'boolean') return v.toString();
            const s = String(v).replace(/'/g, "''");
            return `'${s}'`;
        };
        let sql = `-- tabla ${table}\n`;
        data.forEach(row => {
            const vals = cols.map(c => escapeVal(row[c]));
            sql += `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')});\n`;
        });
        sql += '\n';
        return sql;
    };

    const exportAllSql = async () => {
        setExporting(true);
        let output = '-- backup generado ' + new Date().toISOString() + '\n\n';
        for (const table of EXPORT_TABLES) {
            console.log('🗂️ Exportando SQL tabla', table);
            try {
                const { data, error } = await supabase.from(table).select('*');
                if (error) {
                    console.error('export error', table, error);
                    continue;
                }
                output += toSqlInserts(table, data || []);
            } catch (err) {
                console.error('exception exporting', table, err);
            }
        }
        const filename = `supabase-backup-${new Date().toISOString().slice(0,10)}.sql`;
        downloadString(output, filename, 'application/sql');
        setExporting(false);
    };

    const exportTableSql = async (table: string) => {
        if (!table) return;
        setExporting(true);
        try {
            const { data, error } = await supabase.from(table).select('*');
            if (error) throw error;
            const sql = toSqlInserts(table, data || []);
            const filename = `${table}-${new Date().toISOString().slice(0,10)}.sql`;
            downloadString(sql, filename, 'application/sql');
        } catch (err) {
            logError('Exportar categorías SQL', err);
            alert(getErrorMessage(err));
        }
        setExporting(false);
    };

    const toCsv = <T extends Record<string, unknown>>(data: T[]) => {
        if (!data || data.length === 0) return '';
        const keys = Object.keys(data[0]);
        const escape = (val: unknown) => {
            if (val == null) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };
        const lines = [keys.join(',')];
        data.forEach(row => {
            lines.push(keys.map(k => escape(row[k])).join(','));
        });
        return lines.join('\n');
    };

    const exportAllJson = async () => {
        setExporting(true);
        const result: Record<string, unknown[]> = {};
        for (const table of EXPORT_TABLES) {
            console.log('🗂️ Exportando tabla', table);
            try {
                const { data, error } = await supabase.from(table).select('*');
                if (error) {
                    console.error('export error', table, error);
                    result[table] = [];
                } else {
                    result[table] = data || [];
                }
            } catch (err) {
                console.error('exception exporting', table, err);
                result[table] = [];
            }
        }
        const filename = `supabase-backup-${new Date().toISOString().slice(0,10)}.json`;
        downloadString(JSON.stringify(result, null, 2), filename, 'application/json');
        setExporting(false);
    };

    const exportTableCsv = async (table: string) => {
        if (!table) return;
        setExporting(true);
        try {
            const { data, error } = await supabase.from(table).select('*');
            if (error) throw error;
            const csv = toCsv(data || []);
            const filename = `${table}-${new Date().toISOString().slice(0,10)}.csv`;
            downloadString(csv, filename, 'text/csv');
        } catch (err) {
            logError('Exportar categorías CSV', err);
            alert(getErrorMessage(err));
        }
        setExporting(false);
    };

    // export CSV for selected or all tables
    const exportCsv = async () => {
        if (!selectedExportTable) return;
        if (selectedExportTable === 'all') {
            setExporting(true);
            for (const t of EXPORT_TABLES) {
                try {
                    const { data, error } = await supabase.from(t).select('*');
                    if (error) {
                        console.error('csv export error', t, error);
                        continue;
                    }
                    const csv = toCsv(data || []);
                    const filename = `${t}-${new Date().toISOString().slice(0,10)}.csv`;
                    downloadString(csv, filename, 'text/csv');
                } catch (err) {
                    console.error('exception exporting', t, err);
                }
            }
            setExporting(false);
        } else {
            await exportTableCsv(selectedExportTable);
        }
    };

    const handleAddPlace = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validar que la categoría existe
            const normalizedCategory = normalizeCategoryName(newPlace.category, 'attraction');
            const validCategories = attractionCategories.map(cat => normalizeCategoryName(cat.name, 'attraction'));
            if (!validCategories.includes(normalizedCategory)) {
                alert(`Categoría inválida: ${newPlace.category}. Selecciona una categoría válida.`);
                setLoading(false);
                return;
            }
            let finalImgUrl = newPlace.img;
            if (uploadFile) {
                const uploadedUrl = await handleFileUpload(uploadFile, 'images');
                if (uploadedUrl) finalImgUrl = uploadedUrl;
            }

            const finalGallery = [...(newPlace.gallery || [])];
            if (galleryFiles.length > 0) {
                for (const file of galleryFiles) {
                    const url = await handleFileUpload(file, 'images');
                    if (url) finalGallery.push(url);
                }
            }

            const placeData = {
                name: newPlace.name,
                description: newPlace.desc,
                description_en: newPlace.desc_en,
                description_pt: newPlace.desc_pt,
                description_fr: newPlace.desc_fr,
                lat: newPlace.lat,
                lng: newPlace.lng,
                image_url: finalImgUrl,
                info_extra: newPlace.info,
                category: normalizedCategory,
                gallery_urls: finalGallery,
                video_urls: newPlace.videoUrls.map(videoUrl => videoUrl.trim()).filter(Boolean)
            };

            console.log('📝 Admin: Updating place with data:', placeData);

            let error;
            if (editingId) {
                console.log('🔄 Admin: Updating attraction ID:', editingId);
                // Use API endpoint to update and revalidate cache
                const res = await fetch('/api/admin/attractions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingId, ...placeData })
                });
                const result = await res.json();
                if (!res.ok) {
                    error = new Error(result.error || 'Update failed');
                    console.error('❌ Admin: Update error:', error);
                } else {
                    console.log('✅ Admin: Update successful with cache revalidation');
                }
            } else {
                // Use API endpoint to create and revalidate cache
                const res = await fetch('/api/admin/attractions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(placeData)
                });
                const result = await res.json();
                if (!res.ok) {
                    error = new Error(result.error || 'Create failed');
                } else {
                    console.log('✅ Admin: Create successful with cache revalidation');
                }
            }

            if (error) throw error;

            alert(editingId ? '¡Actualizado!' : '¡Publicado!');
            resetPlaceForm();
            fetchData();
        } catch (err: unknown) {
            logError('Guardar lugar', err);
            alert(getErrorMessage(err));
        }
        setLoading(false);
    };

    const resetPlaceForm = () => {
        setNewPlace({
            name: '', lat: -27.7834, lng: -64.2599,
            desc: '', desc_en: '', desc_pt: '', desc_fr: '',
            img: '', info: '', category: defaultAttractionCategory, gallery: [], videoUrls: ['']
        });
        setEditingId(null);
        setUploadFile(null);
        setGalleryFiles([]);
        setPlaceDescLang('es');
    };

    const generateDescription = async (type: 'place' | 'business') => {
        const name = type === 'place' ? newPlace.name : newBusiness.name;
        const category = type === 'place' ? newPlace.category : newBusiness.category;

        if (!name.trim()) {
            alert('Por favor ingresa un nombre primero');
            return;
        }

        setGeneratingDesc(true);
        try {
            const response = await fetch('/api/generate-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    category,
                    type: type === 'place' ? 'attraction' : 'business'
                })
            });

            if (!response.ok) {
                throw new Error('Error al generar descripción');
            }

            const data = await response.json();
            
            if (type === 'place') {
                // write into currently selected language field
                if (placeDescLang === 'es') setNewPlace({ ...newPlace, desc: data.description });
                else if (placeDescLang === 'en') setNewPlace({ ...newPlace, desc_en: data.description });
                else if (placeDescLang === 'pt') setNewPlace({ ...newPlace, desc_pt: data.description });
                else if (placeDescLang === 'fr') setNewPlace({ ...newPlace, desc_fr: data.description });
            } else {
                if (bizDescLang === 'es') setNewBusiness({ ...newBusiness, description: data.description });
                else if (bizDescLang === 'en') setNewBusiness({ ...newBusiness, description_en: data.description });
                else if (bizDescLang === 'pt') setNewBusiness({ ...newBusiness, description_pt: data.description });
                else if (bizDescLang === 'fr') setNewBusiness({ ...newBusiness, description_fr: data.description });
            }
        } catch (error) {
            logError('Generar descripción IA', error);
            alert(getErrorMessage(error));
        } finally {
            setGeneratingDesc(false);
        }
    };

    const generatePromotionalMessage = async () => {
        const businessName = newPromotionalMessage.business_name;
        const category = newPromotionalMessage.category;

        if (!businessName.trim()) {
            alert('Por favor ingresa el nombre del negocio primero');
            return;
        }

        setGeneratingPromo(true);
        try {
            const response = await fetch('/api/generate-promotional-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessName,
                    category
                })
            });

            if (!response.ok) {
                throw new Error('Error al generar mensaje promocional');
            }

            const data = await response.json();
            setNewPromotionalMessage({ ...newPromotionalMessage, message: data.message });
        } catch (error) {
            logError('Generar mensaje promocional IA', error);
            alert(getErrorMessage(error));
        } finally {
            setGeneratingPromo(false);
        }
    };

    const startEditing = useCallback((p: PlaceRecord) => {
        setEditingId(p.id ?? null);
        setNewPlace({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            desc: p.description || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            desc_en: (p as any).description_en || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            desc_pt: (p as any).description_pt || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            desc_fr: (p as any).description_fr || '',
            img: p.image_url || '',
            info: p.info_extra || '',
            category: normalizeCategoryName(p.category, 'attraction') || defaultAttractionCategory,
            gallery: p.gallery_urls || [],
            videoUrls: p.video_urls && p.video_urls.length > 0 ? p.video_urls : ['']
        });
        setPlaceDescLang('es');
        setActiveTab('lugares');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [defaultAttractionCategory]);

    // Effect to handle redirect from Image Manager with editId
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const sp = new URLSearchParams(window.location.search);
        const editId = sp.get('editAttractionId');
        if (!editId) return;

        (async () => {
            try {
                const { data: placeData, error: placeErr } = await supabase
                    .from('attractions')
                    .select('id,name,description,description_en,description_pt,description_fr,lat,lng,image_url,info_extra,category,gallery_urls,video_urls')
                    .eq('id', editId)
                    .single();

                if (placeErr) {
                    console.warn('No se pudo cargar el atractivo editado:', placeErr.message || placeErr);
                    return;
                }

                if (placeData) {
                    startEditing(placeData as PlaceRecord);
                    try { router.replace('/admin'); } catch { /* ignore */ }
                }
            } catch (e) {
                console.error('Error fetching edited attraction:', e);
            }
        })();
    }, [router, startEditing]);

    const handleAddBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalImgUrl = newBusiness.image_url;
            if (businessFile) {
                const url = await handleFileUpload(businessFile, 'images');
                if (url) finalImgUrl = url;
            }

            const bizData = {
                name: newBusiness.name,
                category: newBusiness.category,
                description: newBusiness.description,
                description_en: newBusiness.description_en,
                description_pt: newBusiness.description_pt,
                description_fr: newBusiness.description_fr,
                contact_info: newBusiness.contact,
                website_url: newBusiness.website,
                image_url: finalImgUrl,
                lat: newBusiness.lat,
                lng: newBusiness.lng
            };

            let error;
            if (newBusiness.id) {
                // Use API endpoint to update and revalidate cache
                const res = await fetch('/api/admin/businesses', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: newBusiness.id, ...bizData })
                });
                const result = await res.json();
                if (!res.ok) {
                    error = new Error(result.error || 'Update failed');
                }
            } else {
                // Use API endpoint to create and revalidate cache
                const res = await fetch('/api/admin/businesses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bizData)
                });
                const result = await res.json();
                if (!res.ok) {
                    error = new Error(result.error || 'Create failed');
                }
            }

            if (error) throw error;
            alert('¡Negocio guardado!');
            setNewBusiness({
                id: '', name: '', category: 'restaurante',
                description: '', description_en: '', description_pt: '', description_fr: '',
                contact: '', website: '', image_url: '', lat: -27.7834, lng: -64.2599
            });
            setBizDescLang('es');
            setBusinessFile(null);
            fetchData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            alert(msg);
        }
        setLoading(false);
    };

    const handleAddPhrase = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('santis_phrases').insert([{ phrase: newPhrase.text, category: newPhrase.category }]);
        if (error) {
            alert(getErrorMessage(error));
        } else {
            setNewPhrase({ text: '', category: 'general' });
            fetchData();
        }
    };

    const handleAddPromotionalMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPromotionalMessage.business_name.trim() || !newPromotionalMessage.message.trim()) {
            alert('Por favor completa el nombre del negocio y el mensaje en español');
            return;
        }
        
        // Verificar autenticación
        const isAuth = await ensureAuthenticated();
        if (!isAuth) return;
        
        if (editingPromotionalMessageId) {
            // Actualizar mensaje existente
            const { error } = await supabase.from('promotional_messages')
                .update({
                    business_name: newPromotionalMessage.business_name.trim(),
                    message: newPromotionalMessage.message.trim(),
                    message_en: newPromotionalMessage.message_en?.trim() || null,
                    message_pt: newPromotionalMessage.message_pt?.trim() || null,
                    message_fr: newPromotionalMessage.message_fr?.trim() || null,
                    category: newPromotionalMessage.category,
                    priority: newPromotionalMessage.priority,
                    show_probability: newPromotionalMessage.show_probability,
                    image_url: newPromotionalMessage.image_url || '',
                    video_url: newPromotionalMessage.video_url || ''
                })
                .eq('id', editingPromotionalMessageId);
            
            if (error) {
                alert(getErrorMessage(error));
            } else {
                setNewPromotionalMessage({ business_name: '', message: '', message_en: '', message_pt: '', message_fr: '', category: 'general', priority: 5, show_probability: 25, image_url: '', video_url: '' });
                setEditingPromotionalMessageId(null);
                fetchData();
            }
        } else {
            // Insertar nuevo mensaje
            const { error } = await supabase.from('promotional_messages').insert([{
                business_name: newPromotionalMessage.business_name.trim(),
                message: newPromotionalMessage.message.trim(),
                message_en: newPromotionalMessage.message_en?.trim() || null,
                message_pt: newPromotionalMessage.message_pt?.trim() || null,
                message_fr: newPromotionalMessage.message_fr?.trim() || null,
                category: newPromotionalMessage.category,
                priority: newPromotionalMessage.priority,
                show_probability: newPromotionalMessage.show_probability,
                is_active: true,
                image_url: newPromotionalMessage.image_url || '',
                video_url: newPromotionalMessage.video_url || ''
            }]);
            if (error) {
                alert(getErrorMessage(error));
            } else {
                setNewPromotionalMessage({ business_name: '', message: '', message_en: '', message_pt: '', message_fr: '', category: 'general', priority: 5, show_probability: 25, image_url: '', video_url: '' });
                fetchData();
            }
        }
    };

    const handleEditPromotionalMessage = (message: {id: string, business_name: string, message: string, message_en?: string, message_pt?: string, message_fr?: string, category: string, priority: number, show_probability: number, image_url?: string, video_url?: string}) => {
        setNewPromotionalMessage({
            business_name: message.business_name,
            message: message.message,
            message_en: message.message_en || '',
            message_pt: message.message_pt || '',
            message_fr: message.message_fr || '',
            category: message.category,
            priority: message.priority,
            show_probability: message.show_probability,
            image_url: message.image_url || '',
            video_url: message.video_url || ''
        });
        setEditingPromotionalMessageId(message.id);
        // Scroll al formulario
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditPromotionalMessage = () => {
        setNewPromotionalMessage({ business_name: '', message: '', message_en: '', message_pt: '', message_fr: '', category: 'general', priority: 5, show_probability: 25, image_url: '', video_url: '' });
        setEditingPromotionalMessageId(null);
    };

    const handleTogglePromotionalMessage = async (id: string, currentStatus: boolean) => {
        const isAuth = await ensureAuthenticated();
        if (!isAuth) return;
        
        const { error } = await supabase.from('promotional_messages').update({ is_active: !currentStatus }).eq('id', id);
        if (error) {
            alert(getErrorMessage(error));
        } else {
            fetchData();
        }
    };

    const handleDeletePromotionalMessage = async (id: string) => {
        if (!confirm('¿Eliminar este mensaje promocional?')) return;
        
        const isAuth = await ensureAuthenticated();
        if (!isAuth) return;
        
        const { error } = await supabase.from('promotional_messages').delete().eq('id', id);
        if (error) {
            alert(getErrorMessage(error));
        } else {
            fetchData();
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategory.name.trim() || !newCategory.icon.trim()) {
            alert('Por favor completa nombre e ícono');
            return;
        }
        try {
            const canonicalName = normalizeCategoryName(newCategory.name, newCategory.type as 'attraction' | 'business');
            const { error } = await supabase.from('categories').insert([{
                name: canonicalName,
                icon: newCategory.icon.trim(),
                type: newCategory.type
            }]);
            if (error) throw error;
            alert('¡Categoría creada!');
            setNewCategory({ name: '', icon: '', type: 'attraction' });
            fetchCategories();
        } catch (err: unknown) {
            logError('Agregar categoría', err);
            alert(getErrorMessage(err));
        }
    };

    const handleAddVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        let videoUrl = newVideo.url;
        if (videoUrl.includes('youtube.com/watch?v=')) {
            const id = videoUrl.split('v=')[1]?.split('&')[0];
            videoUrl = `https://www.youtube.com/embed/${id}`;
        } else if (videoUrl.includes('youtu.be/')) {
            const id = videoUrl.split('youtu.be/')[1];
            videoUrl = `https://www.youtube.com/embed/${id}`;
        }

        const { error } = await supabase.from('app_videos').insert([{ title: newVideo.title, video_url: videoUrl }]);
        if (error) {
            alert(getErrorMessage(error));
        } else {
            setNewVideo({ title: '', url: '' });
            fetchData();
        }
    };

    const deletePlace = async (id: string) => {
        if (!confirm('¿Borrar este lugar?')) return;
        const { error } = await supabase.from('attractions').delete().eq('id', id);
        if (error) {
            alert(getErrorMessage(error));
        } else {
            fetchData();
        }
    };

    const handleAddCarouselPhoto = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Verificar autenticación antes de proceder
            if (!(await ensureAuthenticated())) return;

            if (!carouselFile) {
                alert('Selecciona una foto');
                return;
            }

            const compressed = await compressImage(carouselFile);
            const fileExt = compressed.name.split('.').pop();
            const fileName = `carousel-${Date.now()}.${fileExt}`;
            const filePath = `carousel/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('images').upload(filePath, compressed);
            if (uploadError) throw uploadError;

            const { data: pubData } = supabase.storage.from('images').getPublicUrl(filePath);
            const publicUrl = pubData?.publicUrl;
            if (!publicUrl) {
                throw new Error('No se pudo obtener URL pública de la imagen');
            }

            const { error } = await supabase.from('carousel_photos').insert([{
                image_url: publicUrl,
                title: newCarouselPhoto.title,
                description: newCarouselPhoto.description,
                order_position: carouselPhotos.length,
                is_active: true
            }]);

            if (error) throw error;
            alert('¡Foto agregada al carrusel!');
            setNewCarouselPhoto({ title: '', description: '' });
            setCarouselFile(null);
            fetchData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            alert(msg);
        }
        setLoading(false);
    };

    const deleteCarouselPhoto = async (id: string) => {
        if (!(await ensureAuthenticated())) return;
        if (!confirm('¿Eliminar esta foto del carrusel?')) return;
        const { error } = await supabase.from('carousel_photos').delete().eq('id', id);
        if (error) {
            alert(getErrorMessage(error));
        } else {
            fetchData();
        }
    };

    const moveCarouselPhoto = async (id: string, delta: number) => {
        if (!(await ensureAuthenticated())) return;
        const photo = carouselPhotos.find(p => p.id === id);
        if (!photo) return;
        const current = photo.order_position || 0;
        const target = current + delta;
        if (target < 0 || target >= carouselPhotos.length) return;
        const other = carouselPhotos.find(p => (p.order_position || 0) === target);
        // update each row separately to avoid accidental nulling
        const { error: err1 } = await supabase.from('carousel_photos').update({ order_position: target }).eq('id', photo.id);
        if (err1) {
            alert(getErrorMessage(err1));
            return;
        }
        if (other) {
            const { error: err2 } = await supabase.from('carousel_photos').update({ order_position: current }).eq('id', other.id);
            if (err2) {
                alert(getErrorMessage(err2));
                return;
            }
        }
        fetchData();
    };

    const toggleCarouselPhotoStatus = async (id: string, currentStatus: boolean) => {
        if (!(await ensureAuthenticated())) return;
        const { error } = await supabase.from('carousel_photos').update({ is_active: !currentStatus }).eq('id', id);
        if (error) {
            alert(getErrorMessage(error));
        } else {
            fetchData();
        }
    };

    const saveCarouselSettings = async () => {
        setLoading(true);
        const { error } = await supabase.from('carousel_settings').upsert({ key: 'global', animation_duration: carouselDuration });
        if (error) {
            alert(getErrorMessage(error));
        } else {
            alert('Configuración guardada');
        }
        setLoading(false);
    };

    // Plans handlers
    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const planData = {
                name: newPlan.name,
                display_name: newPlan.display_name,
                price_monthly: newPlan.price_monthly,
                price_yearly: newPlan.price_yearly,
                features: newPlan.features,
                mercadopago_id: newPlan.mercadopago_id,
                max_images: newPlan.max_images,
                priority: newPlan.priority
            };

            console.log('Admin: Saving plan data:', planData, 'editingId:', editingPlanId);

            if (editingPlanId) {
                // Editar plan existente
                console.log('Admin: Updating plan', editingPlanId);
                const { error } = await supabase.from('business_plans').update(planData).eq('id', editingPlanId);
                console.log('Admin: Update result error:', error);
                if (error) throw error;
                alert('¡Plan actualizado!');
                setEditingPlanId(null);
            } else {
                // Crear nuevo plan
                console.log('Admin: Creating new plan');
                const { error } = await supabase.from('business_plans').insert([planData]);
                if (error) throw error;
                alert('¡Plan agregado!');
            }

            setNewPlan({ name: '', display_name: '', price_monthly: 0, price_yearly: 0, features: [], mercadopago_id: '', max_images: 5, priority: 0 });
            fetchData();
        } catch (err: unknown) {
            logError('Guardar plan de negocio', err);
            alert(getErrorMessage(err));
        }
        setLoading(false);
    };

    const startEditingPlan = (plan: {id: string, name: string, display_name: string, price_monthly: number, price_yearly: number, features: string[], mercadopago_id: string, max_images: number, priority: number}) => {
        setNewPlan({
            name: plan.name,
            display_name: plan.display_name,
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly,
            features: plan.features,
            mercadopago_id: plan.mercadopago_id || '',
            max_images: plan.max_images,
            priority: plan.priority
        });
        setEditingPlanId(plan.id);
    };

    const cancelEditing = () => {
        setNewPlan({ name: '', display_name: '', price_monthly: 0, price_yearly: 0, features: [], mercadopago_id: '', max_images: 5, priority: 0 });
        setEditingPlanId(null);
    };

    const handleUpdatePlan = async (id: string, updates: Partial<{name: string, display_name: string, price_monthly: number, price_yearly: number, features: string[], mercadopago_id: string, max_images: number, priority: number, is_active: boolean}>) => {
        try {
            const { error } = await supabase.from('business_plans').update(updates).eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) {
            logError('Actualizar plan de negocio', err);
            alert(getErrorMessage(err));
        }
    };

    const handleDeletePlan = async (id: string) => {
        if (!confirm('¿Eliminar plan?')) return;
        try {
            const { error } = await supabase.from('business_plans').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) {
            logError('Eliminar plan de negocio', err);
            alert(getErrorMessage(err));
        }
    };


    if (!isAuthorized) return null;

    return (
        <div className="admin-layout" style={{ 
            display: 'flex', 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #e8f4f8 0%, #fef3e0 100%)', 
            fontFamily: 'system-ui, -apple-system, sans-serif' 
        }}>
            <style>{`
                .admin-attraction-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 24px;
                    width: 100%;
                }
                
                @media (max-width: 1200px) {
                    .admin-attraction-grid {
                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                        gap: 20px;
                    }
                }
                
                @media (max-width: 768px) {
                    .admin-attraction-grid {
                        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                        gap: 16px;
                    }
                }
                
                @media (max-width: 480px) {
                    .admin-attraction-grid {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }
                }
                
                .admin-attraction-card {
                    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }
                
                .admin-attraction-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 28px rgba(0,0,0,0.15) !important;
                    border-color: rgba(241, 196, 15, 0.3) !important;
                }
                
                .admin-attraction-card-image {
                    width: 100%;
                    height: 160px;
                    object-fit: cover;
                    background-color: #f0f0f0;
                }
                
                @media (max-width: 480px) {
                    .admin-attraction-card-image {
                        height: 140px;
                    }
                }
            `}</style>

            {/* Mobile Header */}
            <div style={{ 
                position: 'fixed', 
                top: 0, 
                width: '100%', 
                height: '70px', 
                background: COLOR_DARK, 
                color: COLOR_GOLD, 
                alignItems: 'center', 
                padding: '0 25px', 
                zIndex: 1001, 
                justifyContent: 'space-between', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)' 
            }} className="mobile-only-header">
                <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Santi Admin</span>
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: COLOR_GOLD, 
                        fontSize: '28px',
                        cursor: 'pointer'
                    }}
                >{isMobileMenuOpen ? '✕' : '☰'}</button>
            </div>

            {/* Sidebar */}
            <div style={{ 
                width: '280px', 
                background: COLOR_DARK, 
                color: 'white', 
                padding: '40px 25px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '25px',
                boxShadow: '6px 0 30px rgba(0,0,0,0.15)'
            }} className={`sidebar admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '15px', 
                    marginBottom: '30px',
                    paddingBottom: '25px',
                    borderBottom: `2px solid ${COLOR_GOLD}44`
                }} className="sidebar-logo">
                    <NextImage 
                        src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png" 
                        width={50} 
                        height={50} 
                        style={{ 
                            width: '50px', 
                            height: '50px',
                            filter: `drop-shadow(0 4px 15px ${COLOR_GOLD}66)`
                        }} 
                        alt="Santi" 
                    />
                    <h2 style={{ fontSize: '22px', margin: 0, color: COLOR_GOLD, fontWeight: 'bold' }}>Santi Admin</h2>
                    <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)} style={{ display: 'none', background: 'transparent', border: 'none', color: 'white', fontSize: 22, marginLeft: 8 }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button 
                        onClick={() => router.push('/')} 
                        style={{ 
                            background: 'white', 
                            border: `2px solid ${COLOR_GOLD}`, 
                            color: COLOR_DARK,
                            padding: '14px 20px',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '15px',
                            marginBottom: '15px',
                            boxShadow: `0 6px 20px ${COLOR_GOLD}33`,
                            transition: 'all 0.2s ease',
                            textAlign: 'left' as const
                        }}
                    >🏠 Volver al Sitio</button>
                    <button onClick={() => { setActiveTab('lugares'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'lugares')}>📍 Atractivos</button>
                    <button onClick={() => { router.push('/admin/webxr-tools'); }} style={tabStyle(false)}>⚡ WebXR Tools</button>
                    <button onClick={() => { router.push('/admin/image-manager'); setIsMobileMenuOpen(false); }} style={tabStyle(false)}>🗂️ Galería</button>
                    <button onClick={() => { setActiveTab('carrusel'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'carrusel')}>📸 Carrusel</button>
                    <button onClick={() => { setActiveTab('videos'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'videos')}>🎥 Videos</button>
                    <button onClick={() => { setActiveTab('negocios'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'negocios')}>🏢 Negocios</button>
                    <button onClick={() => { setActiveTab('categorias'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'categorias')}>🏷️ Categorías</button>
                    <button onClick={() => { setActiveTab('frases'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'frases')}>💬 Frases</button>
                    <button onClick={() => { setActiveTab('promociones'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'promociones')}>💼 Mensajes Promocionales</button>
                    <button onClick={() => { setActiveTab('emails'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'emails')}>📧 Emails</button>
                    <button onClick={() => { setActiveTab('planes'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'planes')}>💳 Planes</button>
                    <button onClick={() => { setActiveTab('usuarios'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'usuarios')}>👥 Usuarios</button>
                    <button onClick={() => { setActiveTab('ai'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'ai')}>🤖 IA / TTS</button>
                    <button onClick={() => { setActiveTab('vision'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'vision')}>👁️ Visión IA</button>
                    <button onClick={() => { setActiveTab('backup'); setIsMobileMenuOpen(false); }} style={tabStyle(activeTab === 'backup')}>💾 Copia</button>
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <button onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem('adminToken'); router.push('/login'); }} style={logoutBtn}>Cerrar Sesión</button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto' 
            }} className="main-content admin-main">
                <header style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '10px',
                    padding: '10px',
                    background: 'white',
                    borderRadius: '15px',
                    boxShadow: '0 15px 50px rgba(0,0,0,0.12)',
                    border: `2px solid ${COLOR_GOLD}22`
                }}>
                    <h1 style={{ 
                        fontSize: 'clamp(1.8rem, 5vw, 3rem)', 
                        margin: 0,
                        color: COLOR_BLUE,
                        fontWeight: '950',
                        letterSpacing: '-1px'
                    }}>
                        {activeTab === 'lugares' ? (editingId ? 'Editando Lugar' : 'Atractivos') :
                            activeTab === 'negocios' ? 'Directorio de Negocios' :
                                activeTab === 'galeria' ? 'Galería de Buckets' :
                                activeTab === 'categorias' ? 'Gestión de Categorías' :
                                activeTab === 'frases' ? 'Frases de Santi' :
                                activeTab === 'promociones' ? 'Mensajes Promocionales' :
                                activeTab === 'videos' ? 'Multimedia' :
                                activeTab === 'emails' ? 'Emails' :
                                activeTab === 'planes' ? 'Planes de Pago' :
                                activeTab === 'usuarios' ? 'Gestión de Usuarios' :
                                activeTab === 'ai' ? 'IA y TTS' :
                                activeTab === 'vision' ? 'Visión IA y Detección' :
                                activeTab === 'backup' ? 'Copia de Seguridad' :
                                'Santi'}
                    </h1>
                    {loading && <span className="loading-spinner"></span>}
                </header>

                {/* Tab: LUGARES */}
                {activeTab === 'lugares' && (
                    <div style={cardStyle}>
                        <div className="form-grid">
                            <form onSubmit={handleAddPlace} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Input label="Nombre" value={newPlace.name} onChange={v => setNewPlace({ ...newPlace, name: v })} />
                                <div className="responsive-row" style={{ gap: '4px', marginBottom: '2px' }}>
                                    <div className="responsive-col" style={{ marginBottom: '0' }}>
                                        <label style={{ ...labelStyle, marginBottom: '3px' }}>Categoría</label>
                                        <select style={{ ...inputStyle, marginBottom: '0' }} value={newPlace.category} onChange={e => setNewPlace({ ...newPlace, category: e.target.value })}>
                                            {attractionCategories.map(cat => (
                                                <option key={cat.name} value={cat.name}>
                                                    {cat.icon} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '4px' }}>
                                    <label style={{ ...labelStyle, marginBottom: '6px', fontSize: '0.85rem' }}>Imagen Principal</label>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <input
                                            ref={placeFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={e => {
                                                const file = e.target.files?.[0] || null;
                                                setUploadFile(file);
                                                setNewPlaceSelectedFileName(file?.name || '');
                                                if (file) setNewPlace(prev => ({ ...prev, img: URL.createObjectURL(file) }));
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => placeFileInputRef.current?.click()}
                                            style={{ padding: '8px 12px', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                                            aria-label="Seleccionar imagen"
                                        >
                                            📁 <span className="icon-label">Seleccionar</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => captureImage('place')}
                                            style={{ width: '38px', height: '38px', padding: '0', background: '#20B2AA', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            aria-label="Cámara"
                                        >
                                            📸 <span className="icon-label">Cámara</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => router.push(editingId ? `/admin/image-manager?mode=place-main&attractionId=${editingId}` : '/admin/image-manager?mode=place-main-new')}
                                            style={{ width: '38px', height: '38px', padding: '0', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            aria-label="Galería"
                                        >
                                            🗂 <span className="icon-label">Galería</span>
                                        </button>
                                    </div>
                                    {newPlaceSelectedFileName && (
                                        <p style={{ margin: '4px 0 8px', fontSize: '12px', color: '#565656' }}>
                                            Archivo seleccionado: {newPlaceSelectedFileName}
                                        </p>
                                    )}
                                    {galleryFiles.length > 0 && (
                                        <p style={{ margin: '4px 0 8px', fontSize: '12px', color: '#565656' }}>
                                            Galería: {galleryFiles.map(f => f.name).join(', ')}
                                        </p>
                                    )}
                                    {newPlace.img && <NextImage src={newPlace.img} width={120} height={80} style={{ height: '80px', width: 'auto', borderRadius: '4px', border: '1px solid #ddd', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '6px', maxHeight: '90px' }} alt="Vista previa" />}
                                    <Input label="O URL" value={newPlace.img} onChange={v => setNewPlace({ ...newPlace, img: v })} />

                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <input
                                            ref={galleryFileInputRef}
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={e => setGalleryFiles(Array.from(e.target.files || []))}
                                        />
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => galleryFileInputRef.current?.click()}
                                            style={{ padding: '8px 12px', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            📁 <span className="icon-label">Seleccionar</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => captureImage('gallery')}
                                            style={{ padding: '8px 12px', background: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            📸 <span className="icon-label">Galería</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => router.push(editingId ? `/admin/image-manager?mode=place-gallery&attractionId=${editingId}` : '/admin/image-manager?mode=place-gallery-new')}
                                            style={{ padding: '8px 12px', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                                        >
                                            🗂️ <span className="icon-label">Buckets</span>
                                        </button>
                                    </div>
                                    {galleryFiles.length > 0 && (
                                        <p style={{ margin: '4px 0 8px', fontSize: '12px', color: '#565656' }}>
                                            Archivos seleccionados: {galleryFiles.map(f => f.name).join(', ')}
                                        </p>
                                    )}
                                    <p style={{ fontSize: '11px', color: '#888' }}>{newPlace.gallery.length} fotos existentes en galería.</p>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={labelStyle}>Descripción para Santi</label>
                                        <button 
                                            type="button"
                                            onClick={() => generateDescription('place')}
                                            disabled={generatingDesc || !newPlace.name.trim()}
                                            style={{
                                                padding: '6px 12px',
                                                background: generatingDesc ? '#ccc' : '#9333ea',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: generatingDesc || !newPlace.name.trim() ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {generatingDesc ? '⏳ Generando...' : '✨ Generar con IA'}
                                        </button>
                                    </div>
                                    {/* language tabs */}
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                                        {['es','en','pt','fr'].map(l => (
                                            <button
                                                key={l}
                                                type="button"
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                onClick={() => setPlaceDescLang(l as any)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: placeDescLang === l ? '#1A3A6C' : '#ccc',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                {l.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea 
                                        style={textareaStyle} 
                                        placeholder="Descripción para Santi... o genera una con IA" 
                                        value={getPlaceDesc(placeDescLang)} 
                                        onChange={e => setPlaceDesc(placeDescLang, e.target.value)} 
                                        rows={3} 
                                    />
                                </div>
                                <Input label="Info Extra (Horarios, tips)" value={newPlace.info} onChange={v => setNewPlace({ ...newPlace, info: v })} />
                                <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '10px', border: '1px solid #eee' }}>
                                    <label style={labelStyle}>URLs de Videos (lista)</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                        {newPlace.videoUrls.map((videoUrl, index) => (
                                            <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    style={{ ...inputStyle, marginBottom: 0 }}
                                                    placeholder="https://youtube.com/watch?v=... o https://...mp4"
                                                    value={videoUrl}
                                                    onChange={(e) => updatePlaceVideoAt(index, e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removePlaceVideoField(index)}
                                                    style={{ padding: '8px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addPlaceVideoField}
                                        style={{ marginTop: '10px', padding: '8px 12px', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                        + Agregar URL de video
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="submit" disabled={loading} style={btnPrimary}>{editingId ? 'Guardar Cambios' : 'Publicar Atractivo'}</button>
                                    {editingId && <button type="button" onClick={resetPlaceForm} style={{ ...btnPrimary, background: '#888' }}>Cancelar</button>}
                                </div>
                            </form>

                            <div>
                                <label style={labelStyle}>Ubicación (Arrastrá el pin)</label>
                                <AdminMap
                                    initialCoords={[newPlace.lng, newPlace.lat]}
                                    onLocationSelect={(lng, lat) => setNewPlace(prev => ({ ...prev, lat, lng }))}
                                />
                                <div style={{ background: '#eee', padding: '10px', borderRadius: '8px', fontSize: '11px', marginTop: '10px' }}>
                                    Coords: {newPlace.lat.toFixed(6)}, {newPlace.lng.toFixed(6)}
                                </div>
                            </div>
                        </div>

                        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #eee' }} />
                        <h3>Explorar y Editar Atractivos</h3>
                        
                        {/* Filtros para lugares */}
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={labelStyle}>Buscar por nombre</label>
                                <input 
                                    type="text" 
                                    placeholder="Buscar atractivos..." 
                                    value={placeSearch} 
                                    onChange={e => setPlaceSearch(e.target.value)} 
                                    style={inputStyle} 
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={labelStyle}>Filtrar por categoría</label>
                                <select 
                                    value={placeCategoryFilter} 
                                    onChange={e => setPlaceCategoryFilter(e.target.value)} 
                                    style={inputStyle}
                                >
                                    <option value="">Todas las categorías</option>
                                    {attractionCategories.map(cat => (
                                        <option key={cat.name} value={cat.name}>
                                            {cat.icon} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {/* modal de traducción */}
                        {translateItem && <TranslateModal />}
                        <div className="admin-attraction-grid">
                            {places
                                .filter(p => 
                                    p.name.toLowerCase().includes(placeSearch.toLowerCase()) &&
                                    (placeCategoryFilter === '' || p.category === placeCategoryFilter)
                                )
                                .map(p => (
                                <div key={p.id} style={placeCard} className="admin-attraction-card">
                                    {/* Imagen Principal */}
                                    <div style={{ position: 'relative', width: '100%', height: '160px', overflow: 'hidden', backgroundColor: '#f0f0f0', cursor: 'pointer' }} onClick={() => startEditing(p)}>
                                        <NextImage 
                                            src={p.image_url || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300"} 
                                            width={300} 
                                            height={160} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                            alt={p.name} 
                                        />
                                        {/* Badge de Categoría */}
                                        <span style={{ 
                                            position: 'absolute', 
                                            top: '12px', 
                                            right: '12px', 
                                            background: `${COLOR_BLUE}cc`, 
                                            color: 'white', 
                                            padding: '6px 12px', 
                                            borderRadius: '20px', 
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            backdropFilter: 'blur(4px)'
                                        }}>{p.category}</span>
                                    </div>

                                    {/* Contenido Principal */}
                                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        {/* Título y Meta */}
                                        <div style={{ cursor: 'pointer', marginBottom: '12px' }} onClick={() => startEditing(p)}>
                                            <h4 style={{ 
                                                margin: '0 0 6px 0', 
                                                fontSize: '15px',
                                                fontWeight: '700',
                                                color: COLOR_BLUE,
                                                lineHeight: '1.4',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2 as any,
                                                WebkitBoxOrient: 'vertical' as any
                                            }}>{p.name}</h4>
                                            <p style={{ 
                                                margin: '0', 
                                                fontSize: '12px', 
                                                color: '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                📸 {(p.gallery_urls || []).length} fotos
                                            </p>
                                        </div>
                                        
                                        {/* Indicadores de Traducciones */}
                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                background: '#e0e7ff',
                                                color: '#4338ca',
                                                fontWeight: '700',
                                                flex: 0
                                            }}>ES</span>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                background: p.description_en ? '#dcfce7' : '#fee2e2',
                                                color: p.description_en ? '#166534' : '#991b1b',
                                                fontWeight: '700',
                                                flex: 0
                                            }}>EN {p.description_en ? '✓' : '✗'}</span>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                background: p.description_pt ? '#dcfce7' : '#fee2e2',
                                                color: p.description_pt ? '#166534' : '#991b1b',
                                                fontWeight: '700',
                                                flex: 0
                                            }}>PT {p.description_pt ? '✓' : '✗'}</span>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                background: p.description_fr ? '#dcfce7' : '#fee2e2',
                                                color: p.description_fr ? '#166534' : '#991b1b',
                                                fontWeight: '700',
                                                flex: 0
                                            }}>FR {p.description_fr ? '✓' : '✗'}</span>
                                        </div>
                                        
                                        {/* Botones de Acción - Grid Responsivo */}
                                        <div style={{ 
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '8px',
                                            marginTop: 'auto'
                                        }}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); startEditing(p); }} 
                                                style={{ 
                                                    ...btnAction, 
                                                    color: '#20B2AA',
                                                    padding: '10px 12px',
                                                    fontSize: '13px',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button 
                                                onClick={(e)=>{ e.stopPropagation(); setTranslateItem(p); }} 
                                                style={{ 
                                                    ...btnAction, 
                                                    color:'#9333ea',
                                                    padding: '10px 12px',
                                                    fontSize: '13px',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                🈂️ Traducir
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/admin/image-manager?mode=place-gallery&attractionId=${p.id}`);
                                                }}
                                                style={{ 
                                                    ...btnAction, 
                                                    color: '#1A3A6C',
                                                    padding: '10px 12px',
                                                    fontSize: '13px',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                🗂️ Galería
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if (p.id) { deletePlace(p.id); } }} 
                                                style={{ 
                                                    ...btnAction, 
                                                    color: '#ff4444',
                                                    padding: '10px 12px',
                                                    fontSize: '13px',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                🗑️ Borrar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab: CARRUSEL */}
                {activeTab === 'carrusel' && (
                    <div style={cardStyle}>
                        <h3 style={{ 
                            fontSize: '1.5rem', 
                            color: COLOR_BLUE, 
                            marginBottom: '25px',
                            fontWeight: 'bold'
                        }}>📸 Gestión del Carrusel de Fotos</h3>
                        
                        {/* Carousel speed/duration control */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Duración total del bucle (segundos)</label>
                            <input
                                type="number"
                                step="0.1"
                                min="1"
                                value={carouselDuration}
                                onChange={e => setCarouselDuration(parseFloat(e.target.value) || 0)}
                                style={inputStyle}
                            />
                            <button
                                type="button"
                                onClick={saveCarouselSettings}
                                style={{ ...btnPrimary, marginTop: '10px', width: 'auto' }}
                                disabled={loading}
                            >
                                Guardar configuración
                            </button>
                        </div>

                        <form onSubmit={handleAddCarouselPhoto} style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '20px',
                            marginBottom: '40px',
                            padding: '30px',
                            background: '#f8fafc',
                            borderRadius: '24px',
                            border: `2px solid ${COLOR_GOLD}22`
                        }}>
                            <div>
                                <label style={labelStyle}>Foto para el Carrusel</label>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={e => setCarouselFile(e.target.files?.[0] || null)} 
                                        style={{ flex: 1 }} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={async () => {
                                            const photo = await takePhoto();
                                            if (photo) {
                                                const file = new File([photo.blob], `carousel-${Date.now()}.${photo.format}`, { type: `image/${photo.format}` });
                                                setCarouselFile(file);
                                            }
                                        }}
                                        style={{ 
                                            padding: '10px 16px', 
                                            background: COLOR_GOLD, 
                                            color: COLOR_DARK, 
                                            border: 'none', 
                                            borderRadius: '50px', 
                                            cursor: 'pointer', 
                                            fontSize: '14px',
                                            fontWeight: 'bold'
                                        }}
                                    >📷 Cámara</button>
                                </div>
                                {carouselFile && (
                                    <p style={{ 
                                        marginTop: '10px', 
                                        fontSize: '14px', 
                                        color: COLOR_BLUE,
                                        fontWeight: '600'
                                    }}>
                                        ✓ {carouselFile.name}
                                    </p>
                                )}
                            </div>
                            
                            <Input 
                                label="Título (opcional)" 
                                value={newCarouselPhoto.title} 
                                onChange={v => setNewCarouselPhoto({ ...newCarouselPhoto, title: v })} 
                            />
                            
                            <div>
                                <label style={labelStyle}>Descripción (opcional)</label>
                                <textarea 
                                    style={textareaStyle} 
                                    value={newCarouselPhoto.description} 
                                    onChange={e => setNewCarouselPhoto({ ...newCarouselPhoto, description: e.target.value })}
                                    rows={3}
                                    placeholder="Breve descripción de la postal..."
                                />
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={loading || !carouselFile}
                                style={{
                                    ...btnPrimary,
                                    opacity: loading || !carouselFile ? 0.5 : 1,
                                    cursor: loading || !carouselFile ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {loading ? 'Subiendo...' : '🚀 Agregar al Carrusel'}
                            </button>
                        </form>

                        <h4 style={{ 
                            fontSize: '1.2rem', 
                            color: COLOR_BLUE, 
                            marginBottom: '20px',
                            fontWeight: 'bold'
                        }}>Fotos Actuales ({carouselPhotos.length})</h4>
                        
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                            gap: '20px' 
                        }}>
                            {carouselPhotos.map((photo: CarouselPhoto) => (
                                <div key={photo.id} style={{
                                    background: 'white',
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    border: `2px solid ${photo.is_active ? COLOR_GOLD : '#ccc'}`,
                                    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                }}>
                                    <div style={{ position: 'relative', height: '150px', overflow: 'hidden' }}>
                                        <NextImage 
                                            src={photo.image_url} 
                                            alt={photo.title || 'Postal'} 
                                            width={250}
                                            height={150}
                                            style={{ 
                                                width: '100%', 
                                                height: '100%', 
                                                objectFit: 'cover',
                                                borderRadius: '8px 8px 0 0'
                                            }}
                                        />
                                        {!photo.is_active && (
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                background: 'rgba(0,0,0,0.6)',
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: 'white',
                                                fontWeight: 'bold',
                                                fontSize: '1.2rem'
                                            }}>
                                                INACTIVA
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: '15px' }}>
                                        {photo.title && (
                                            <h5 style={{ 
                                                margin: '0 0 8px 0', 
                                                color: COLOR_BLUE,
                                                fontSize: '1rem',
                                                fontWeight: 'bold'
                                            }}>
                                                {photo.title}
                                            </h5>
                                        )}
                                        {photo.description && (
                                            <p style={{ 
                                                margin: '0 0 12px 0', 
                                                fontSize: '0.85rem',
                                                color: '#64748b'
                                            }}>
                                                {photo.description}
                                            </p>
                                        )}
                                        <div style={{ 
                                            display: 'flex', 
                                            gap: '8px',
                                            marginTop: '12px'
                                        }}>
                                            <button
                                                onClick={() => moveCarouselPhoto(photo.id, -1)}
                                                disabled={(photo.order_position || 0) === 0}
                                                style={{
                                                    padding: '8px',
                                                    background: '#3490dc',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '50px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold',
                                                    cursor: (photo.order_position || 0) === 0 ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => moveCarouselPhoto(photo.id, 1)}
                                                disabled={(photo.order_position || 0) === (carouselPhotos.length - 1)}
                                                style={{
                                                    padding: '8px',
                                                    background: '#3490dc',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '50px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold',
                                                    cursor: (photo.order_position || 0) === (carouselPhotos.length - 1) ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                ▼
                                            </button>
                                            <button 
                                                onClick={() => toggleCarouselPhotoStatus(photo.id, !!photo.is_active)}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    background: photo.is_active ? '#fbbf24' : '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '50px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {photo.is_active ? '👁️ Ocultar' : '✓ Activar'}
                                            </button>
                                            <button 
                                                onClick={() => deleteCarouselPhoto(photo.id)}
                                                style={{
                                                    padding: '8px 14px',
                                                    background: '#ef4444',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '50px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {carouselPhotos.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px 20px',
                                background: '#f8fafc',
                                borderRadius: '24px',
                                border: `3px dashed ${COLOR_GOLD}44`
                            }}>
                                <span style={{ fontSize: '48px' }}>📸</span>
                                <p style={{
                                    color: '#64748b',
                                    marginTop: '15px',
                                    fontSize: '16px',
                                    fontWeight: '500'
                                }}>
                                    No hay fotos en el carrusel. ¡Agrega la primera!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: NEGOCIOS */}
                {activeTab === 'negocios' && (
                    <div style={cardStyle}>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px', marginBottom: '40px' }}>
                            <form onSubmit={handleAddBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <Input label="Nombre del Negocio" value={newBusiness.name} onChange={v => setNewBusiness({ ...newBusiness, name: v })} />
                                <div className="responsive-row" style={{ gap: '15px' }}>
                                    <div className="responsive-col">
                                        <label style={labelStyle}>Categoría</label>
                                        <select style={inputStyle} value={newBusiness.category} onChange={e => setNewBusiness({ ...newBusiness, category: e.target.value })}>
                                            {businessCategories.map(cat => (
                                                <option key={cat.name} value={cat.name}>
                                                    {cat.icon} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '10px' }}>
                                    <label style={labelStyle}>Foto del Negocio</label>
                                    <div className="responsive-row row-center" style={{ marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <input
                                            ref={businessFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={e => {
                                                const file = e.target.files?.[0] || null;
                                                setBusinessFile(file);
                                                setNewBusinessSelectedFileName(file?.name || '');
                                                if (file) setNewBusiness(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => businessFileInputRef.current?.click()}
                                            style={{ padding: '8px 12px', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            📁 <span className="icon-label">Seleccionar</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => captureImage('business')}
                                            style={{ padding: '8px 12px', background: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            📸 <span className="icon-label">Cámara</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            onClick={() => router.push('/admin/image-manager')}
                                            style={{ padding: '8px 12px', background: '#1A3A6C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                                        >
                                            🗂️ <span className="icon-label">Galería</span>
                                        </button>
                                    </div>
                                    {newBusinessSelectedFileName && (
                                        <p style={{ margin: '4px 0 8px', fontSize: '12px', color: '#565656' }}>
                                            Archivo seleccionado: {newBusinessSelectedFileName}
                                        </p>
                                    )}
                                    {newBusiness.image_url && <NextImage src={newBusiness.image_url} width={90} height={60} style={{ height: '60px', width: 'auto', borderRadius: '8px', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} alt="Vista previa negocio" />}
                                </div>
                                
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={labelStyle}>Descripción del negocio</label>
                                        <button 
                                            type="button"
                                            onClick={() => generateDescription('business')}
                                            disabled={generatingDesc || !newBusiness.name.trim()}
                                            style={{
                                                padding: '6px 12px',
                                                background: generatingDesc ? '#ccc' : '#9333ea',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: generatingDesc || !newBusiness.name.trim() ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {generatingDesc ? '⏳ Generando...' : '✨ Generar con IA'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                                        {['es','en','pt','fr'].map(l => (
                                            <button
                                                key={l}
                                                type="button"
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                onClick={() => setBizDescLang(l as any)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: bizDescLang === l ? '#1A3A6C' : '#ccc',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                {l.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        style={textareaStyle}
                                        placeholder="Descripción del negocio"
                                        value={getBizDesc(bizDescLang)}
                                        onChange={e => setBizDesc(bizDescLang, e.target.value)}
                                        rows={3}
                                    />
                                    <Input label="WhatsApp / Contacto" value={newBusiness.contact} onChange={v => setNewBusiness({ ...newBusiness, contact: v })} />
                                </div>
                                <Input label="Web o Instagram" value={newBusiness.website} onChange={v => setNewBusiness({ ...newBusiness, website: v })} />
                                <button type="submit" style={btnPrimary}>{newBusiness.id ? 'Guardar Cambios' : 'Registrar Negocio'}</button>
                            </form>

                            <div>
                                <label style={labelStyle}>Ubicación del Negocio</label>
                                <AdminMap
                                    initialCoords={[newBusiness.lng, newBusiness.lat]}
                                    onLocationSelect={(lng, lat) => setNewBusiness(prev => ({ ...prev, lat, lng }))}
                                />
                                <div style={{ background: '#eee', padding: '10px', borderRadius: '8px', fontSize: '11px', marginTop: '10px' }}>
                                    Coords: {newBusiness.lat.toFixed(6)}, {newBusiness.lng.toFixed(6)}
                                </div>
                            </div>
                        </div>

                        {/* Filtros para negocios */}
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={labelStyle}>Buscar por nombre</label>
                                <input 
                                    type="text" 
                                    placeholder="Buscar negocios..." 
                                    value={businessSearch} 
                                    onChange={e => setBusinessSearch(e.target.value)} 
                                    style={inputStyle} 
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={labelStyle}>Filtrar por categoría</label>
                                <select 
                                    value={businessCategoryFilter} 
                                    onChange={e => setBusinessCategoryFilter(e.target.value)} 
                                    style={inputStyle}
                                >
                                    <option value="">Todas las categorías</option>
                                    {businessCategories.map(cat => (
                                        <option key={cat.name} value={cat.name}>
                                            {cat.icon} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            {businesses
                                .filter(b => 
                                    b.name.toLowerCase().includes(businessSearch.toLowerCase()) &&
                                    (businessCategoryFilter === '' || b.category === businessCategoryFilter)
                                )
                                .map(b => (
                                <div key={b.id} style={listItem}>
                                    <div className="responsive-row row-center">
                                        <NextImage src={b.image_url || "https://res.cloudinary.com/dhvrrxejo/image/upload/v1768412755/guiarobotalpha_vv5jbj.png"} width={45} height={45} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} alt={b.name || 'Negocio'} />
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ fontSize: '1rem' }}>{b.name}</strong>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#777' }}>{b.category} • {b.contact_info}</p>
                                            
                                            {/* Indicadores de traducciones */}
                                            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ 
                                                    fontSize: '9px', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    background: '#e0e7ff',
                                                    color: '#4338ca',
                                                    fontWeight: '600'
                                                }}>ES</span>
                                                <span style={{ 
                                                    fontSize: '9px', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    background: b.description_en ? '#dcfce7' : '#fee2e2',
                                                    color: b.description_en ? '#166534' : '#991b1b',
                                                    fontWeight: '600'
                                                }}>{b.description_en ? '✓ EN' : '✗ EN'}</span>
                                                <span style={{ 
                                                    fontSize: '9px', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    background: b.description_pt ? '#dcfce7' : '#fee2e2',
                                                    color: b.description_pt ? '#166534' : '#991b1b',
                                                    fontWeight: '600'
                                                }}>{b.description_pt ? '✓ PT' : '✗ PT'}</span>
                                                <span style={{ 
                                                    fontSize: '9px', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    background: b.description_fr ? '#dcfce7' : '#fee2e2',
                                                    color: b.description_fr ? '#166534' : '#991b1b',
                                                    fontWeight: '600'
                                                }}>{b.description_fr ? '✓ FR' : '✗ FR'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => setNewBusiness({ id: b.id || '', name: b.name, category: b.category, description: b.description || '', description_en: b.description_en || '', description_pt: b.description_pt || '', description_fr: b.description_fr || '', contact: b.contact_info || '', website: b.website_url || '', image_url: b.image_url || '', lat: b.lat || -27.7834, lng: b.lng || -64.2599 })} style={btnAction}>✏️</button>
                                        <button
                                            onClick={() => {
                                                setNewBusiness({ id: b.id || '', name: b.name, category: b.category, description: b.description || '', description_en: b.description_en || '', description_pt: b.description_pt || '', description_fr: b.description_fr || '', contact: b.contact_info || '', website: b.website_url || '', image_url: b.image_url || '', lat: b.lat || -27.7834, lng: b.lng || -64.2599 });
                                                router.push('/admin/image-manager');
                                            }}
                                            style={btnAction}
                                        >
                                            🗂️
                                        </button>
                                        <button onClick={async () => { if (confirm('Borrar?')) { await supabase.from('business_profiles').delete().eq('id', b.id); fetchData(); } }} style={btnAction}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab: GALERÍA */}
                {activeTab === 'galeria' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '20px', fontWeight: 'bold' }}>
                            🖼️ Gestor de Imágenes
                        </h3>

                        <div style={{ padding: '30px', background: '#f8fafc', borderRadius: '24px', border: `2px solid ${COLOR_GOLD}22`, textAlign: 'center' }}>
                            <p style={{ marginBottom: '16px', color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                Ahora toda la gestión de imágenes (buckets, subcarpetas, selección y asignación a atractivos o negocios)
                                se realiza desde el nuevo panel dedicado.
                            </p>
                            <p style={{ marginBottom: '24px', color: '#475569', fontSize: '0.9rem' }}>
                                Haz clic en el botón de abajo para abrir el gestor moderno de imágenes.
                            </p>
                            <button
                                onClick={() => router.push('/admin/image-manager')}
                                style={{
                                    ...btnPrimary,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                🖼️ Abrir Gestor de Imágenes
                            </button>
                        </div>
                    </div>
                )}

                {/* Other tabs remain similar but with cardStyle */}
                {activeTab === 'videos' && (
                    <div style={cardStyle}>
                        <form onSubmit={handleAddVideo} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
                            <Input label="Título" value={newVideo.title} onChange={v => setNewVideo({ ...newVideo, title: v })} />
                            <Input label="Link de YouTube" value={newVideo.url} onChange={v => setNewVideo({ ...newVideo, url: v })} />
                            <button type="submit" style={btnPrimary}>Cargar Video</button>
                        </form>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {videos.map(v => (
                                <div key={v.id} style={{ ...placeCard, padding: '15px' }}>
                                    <h4>{v.title}</h4>
                                    <iframe width="100%" height="150" src={v.video_url} frameBorder="0" allowFullScreen style={{ borderRadius: '8px' }}></iframe>
                                    <button onClick={async () => { await supabase.from('app_videos').delete().eq('id', v.id); fetchData(); }} style={btnDelete}>Eliminar</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab: EMAILS */}
                {activeTab === 'emails' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '25px', fontWeight: 'bold' }}>
                            📧 Sistema de Notificaciones por Email
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', marginBottom: '30px' }}>
                            <div 
                                style={{ 
                                    background: 'white',
                                    padding: '30px',
                                    borderRadius: '20px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                    border: `3px solid ${COLOR_GOLD}`,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onClick={() => router.push('/admin/email-templates')}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.boxShadow = `0 15px 50px rgba(0,0,0,0.15)`;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)';
                                }}
                            >
                                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                                <h4 style={{ color: COLOR_BLUE, marginBottom: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    Plantillas de Email
                                </h4>
                                <p style={{ color: '#64748b', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                                    Crear, editar y gestionar plantillas con vista previa en tiempo real
                                </p>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '15px',
                                    right: '15px',
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '50%',
                                    background: COLOR_GOLD,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '16px'
                                }}>→</div>
                            </div>
                            
                            <div 
                                style={{ 
                                    background: 'white',
                                    padding: '30px',
                                    borderRadius: '20px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                    border: `3px solid ${COLOR_BLUE}44`,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onClick={() => router.push('/admin/email')}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.boxShadow = `0 15px 50px rgba(0,0,0,0.15)`;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.1)';
                                }}
                            >
                                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📧</div>
                                <h4 style={{ color: COLOR_BLUE, marginBottom: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    Gestión de Emails
                                </h4>
                                <p style={{ color: '#64748b', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                                    Enviar emails masivos y gestionar listas de contactos
                                </p>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '15px',
                                    right: '15px',
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '50%',
                                    background: COLOR_BLUE,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '16px',
                                    color: 'white'
                                }}>→</div>
                            </div>
                            
                            <div 
                                style={{ 
                                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)',
                                    padding: '30px',
                                    borderRadius: '20px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                    border: `3px solid #818cf8`,
                                    textAlign: 'center',
                                    gridColumn: 'span 2',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚡</div>
                                <h4 style={{ color: '#4338ca', marginBottom: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    Notificaciones Automáticas Activas
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '20px' }}>
                                    <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '5px' }}>👋</div>
                                        <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>BIENVENIDA</div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>Nuevos usuarios</div>
                                    </div>
                                    <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '5px' }}>🏪</div>
                                        <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>REGISTRO</div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>Nuevos negocios</div>
                                    </div>
                                    <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '5px' }}>💳</div>
                                        <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>PAGOS</div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>Confirmaciones</div>
                                    </div>
                                    <div style={{ background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '5px' }}>✅</div>
                                        <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>APROBACIÓN</div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>Negocios aprobados</div>
                                    </div>
                                </div>
                                <p style={{ color: '#64748b', margin: '20px 0 0 0', fontSize: '13px', fontStyle: 'italic' }}>
                                    Emails enviados automáticamente cuando ocurren estos eventos en la plataforma
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab: PLANES */}
                {activeTab === 'planes' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '25px', fontWeight: 'bold' }}>
                            💳 {editingPlanId ? 'Editar Plan de Pago' : 'Gestión de Planes de Pago'}
                        </h3>
                        
                        <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
                            <div className="responsive-row" style={{ gap: '15px' }}>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Nombre Interno</label>
                                    <input 
                                        style={inputStyle} 
                                        placeholder="Ej: pro" 
                                        value={newPlan.name} 
                                        onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} 
                                        required 
                                        disabled={!!editingPlanId} // No permitir cambiar name al editar
                                    />
                                </div>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Nombre para Mostrar</label>
                                    <input 
                                        style={inputStyle} 
                                        placeholder="Ej: Plan Pro" 
                                        value={newPlan.display_name} 
                                        onChange={e => setNewPlan({ ...newPlan, display_name: e.target.value })} 
                                        required 
                                    />
                                </div>
                            </div>
                            
                            <div className="responsive-row" style={{ gap: '15px' }}>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Precio Mensual (ARS)</label>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        style={inputStyle} 
                                        placeholder="9.99" 
                                        value={newPlan.price_monthly} 
                                        onChange={e => setNewPlan({ ...newPlan, price_monthly: parseFloat(e.target.value) || 0 })} 
                                        required 
                                    />
                                </div>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Precio Anual (ARS)</label>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        style={inputStyle} 
                                        placeholder="99.99" 
                                        value={newPlan.price_yearly} 
                                        onChange={e => setNewPlan({ ...newPlan, price_yearly: parseFloat(e.target.value) || 0 })} 
                                        required 
                                    />
                                </div>
                            </div>
                            
                            <div className="responsive-row" style={{ gap: '15px' }}>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Máximo de Imágenes</label>
                                    <input 
                                        type="number"
                                        style={inputStyle} 
                                        placeholder="5 (-1 para ilimitado)" 
                                        value={newPlan.max_images} 
                                        onChange={e => setNewPlan({ ...newPlan, max_images: parseInt(e.target.value) || 5 })} 
                                    />
                                </div>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Prioridad (orden)</label>
                                    <input 
                                        type="number"
                                        style={inputStyle} 
                                        placeholder="1" 
                                        value={newPlan.priority} 
                                        onChange={e => setNewPlan({ ...newPlan, priority: parseInt(e.target.value) || 0 })} 
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label style={labelStyle}>ID de MercadoPago</label>
                                <input 
                                    style={inputStyle} 
                                    placeholder="ID del producto en MercadoPago" 
                                    value={newPlan.mercadopago_id} 
                                    onChange={e => setNewPlan({ ...newPlan, mercadopago_id: e.target.value })} 
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>Características (una por línea)</label>
                                <textarea 
                                    style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} 
                                    rows={5}
                                    placeholder="Acceso ilimitado&#10;Soporte prioritario&#10;Estadísticas avanzadas" 
                                    value={newPlan.features.join('\n')} 
                                    onChange={e => setNewPlan({ ...newPlan, features: e.target.value.split('\n').filter(f => f.trim()) })} 
                                />
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" style={submitBtn} disabled={loading}>
                                    {loading ? 'Guardando...' : editingPlanId ? 'Actualizar Plan' : 'Crear Plan'}
                                </button>
                                {editingPlanId && (
                                    <button type="button" onClick={cancelEditing} style={btnStyle}>
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>

                        <h4 style={{ fontSize: '1.2rem', color: COLOR_BLUE, marginBottom: '15px' }}>Planes Existentes</h4>
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {plans.map(plan => (
                                <div key={plan.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', background: '#fafafa' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <h5 style={{ margin: 0, color: COLOR_BLUE }}>{plan.display_name} ({plan.name})</h5>
                                        <div>
                                            <button 
                                                onClick={() => startEditingPlan(plan)} 
                                                style={{ ...btnStyle, background: '#17a2b8', marginRight: '5px' }}
                                            >
                                                Editar
                                            </button>
                                            <button 
                                                onClick={() => handleUpdatePlan(plan.id, { is_active: !plan.is_active })} 
                                                style={{ ...btnStyle, background: plan.is_active ? '#28a745' : '#dc3545', marginRight: '5px' }}
                                            >
                                                {plan.is_active ? 'Activo' : 'Inactivo'}
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePlan(plan.id)} 
                                                style={{ ...btnStyle, background: '#dc3545' }}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                    <p style={{ margin: '5px 0', fontSize: '14px' }}>
                                        Precio: ${plan.price_monthly}/mes - ${plan.price_yearly}/año | Máx imágenes: {plan.max_images === -1 ? 'Ilimitado' : plan.max_images} | Prioridad: {plan.priority}
                                    </p>
                                    <p style={{ margin: '5px 0', fontSize: '14px' }}>ID MP: {plan.mercadopago_id || 'No configurado'}</p>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} style={{ fontSize: '14px' }}>{feature}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab: USUARIOS */}
                {activeTab === 'usuarios' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Búsqueda y Filtros */}
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: '15px',
                                padding: '20px',
                                background: `${COLOR_GOLD}11`,
                                borderRadius: '12px',
                                border: `2px solid ${COLOR_GOLD}33`
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={labelStyle}>🔍 Buscar Usuario</label>
                                    <input 
                                        style={inputStyle}
                                        placeholder="Buscar por nombre, email o ciudad..."
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={labelStyle}>📁 Filtrar por Rol</label>
                                    <select 
                                        style={inputStyle}
                                        value={userRoleFilter}
                                        onChange={(e) => setUserRoleFilter(e.target.value as 'all' | 'tourist' | 'business' | 'admin')}
                                    >
                                        <option value="all">Todos los roles</option>
                                        <option value="tourist">🧳 Turistas</option>
                                        <option value="business">🏢 Negocios</option>
                                        <option value="admin">⚙️ Administradores</option>
                                    </select>
                                </div>
                            </div>

                            {/* Estadísticas */}
                            <div style={{ 
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: '15px'
                            }}>
                                <div style={{
                                    padding: '20px',
                                    background: 'white',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLOR_BLUE }}>
                                        {users.length}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Total Usuarios</div>
                                </div>
                                <div style={{
                                    padding: '20px',
                                    background: 'white',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F1C40F' }}>
                                        {users.filter(u => u.role === 'tourist').length}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Turistas</div>
                                </div>
                                <div style={{
                                    padding: '20px',
                                    background: 'white',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10B981' }}>
                                        {users.filter(u => u.role === 'business').length}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Negocios</div>
                                </div>
                                <div style={{
                                    padding: '20px',
                                    background: 'white',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#EF4444' }}>
                                        {users.filter(u => u.role === 'admin').length}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Administradores</div>
                                </div>
                            </div>

                            {/* Tabla de Usuarios */}
                            <div style={{
                                overflowX: 'auto',
                                borderRadius: '12px',
                                border: `2px solid ${COLOR_GOLD}33`
                            }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    backgroundColor: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ 
                                            background: `${COLOR_GOLD}22`,
                                            borderBottom: `2px solid ${COLOR_GOLD}33`
                                        }}>
                                            <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: COLOR_BLUE, fontSize: '14px' }}>Nombre</th>
                                            <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: COLOR_BLUE, fontSize: '14px' }}>Email</th>
                                            <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: COLOR_BLUE, fontSize: '14px' }}>Rol</th>
                                            <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: COLOR_BLUE, fontSize: '14px' }}>Ubicación</th>
                                            <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: COLOR_BLUE, fontSize: '14px' }}>Registro</th>
                                            <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: COLOR_BLUE, fontSize: '14px' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users
                                            .filter(u => {
                                                const matchesSearch = userSearchTerm === '' || 
                                                    u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                    u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                    u.city?.toLowerCase().includes(userSearchTerm.toLowerCase());
                                                const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
                                                return matchesSearch && matchesRole;
                                            })
                                            .map((user) => (
                                                <tr key={user.id} style={{
                                                    borderBottom: `1px solid #e2e8f0`,
                                                    transition: 'background-color 0.2s'
                                                }}>
                                                    <td style={{ padding: '15px', fontSize: '14px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {user.avatar_url && (
                                                                <NextImage src={user.avatar_url} alt={user.name || 'Usuario'} width={32} height={32} style={{
                                                                    borderRadius: '50%',
                                                                    objectFit: 'cover'
                                                                }} />
                                                            )}
                                                            <span style={{ fontWeight: '500' }}>{user.name || 'Sin nombre'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px', fontSize: '14px', color: '#333', fontWeight: '500', minWidth: '200px', wordBreak: 'break-word' }}>
                                                        {user.email}
                                                    </td>
                                                    <td style={{ padding: '15px', fontSize: '13px' }}>
                                                        <span style={{
                                                            padding: '4px 12px',
                                                            borderRadius: '20px',
                                                            background: user.role === 'admin' ? '#EF4444' : 
                                                                       user.role === 'business' ? '#10B981' : 
                                                                       '#F1C40F',
                                                            color: user.role === 'admin' ? 'white' :
                                                                   user.role === 'business' ? 'white' :
                                                                   '#000',
                                                            fontWeight: 'bold',
                                                            display: 'inline-block'
                                                        }}>
                                                            {user.role === 'tourist' ? '🧳' : 
                                                             user.role === 'business' ? '🏢' : 
                                                             '⚙️'} {user.role}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '15px', fontSize: '13px', color: '#666' }}>
                                                        {user.city && user.country ? `${user.city}, ${user.country}` : user.city || user.country || '-'}
                                                    </td>
                                                    <td style={{ padding: '15px', fontSize: '13px', color: '#666' }}>
                                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('es-AR') : '-'}
                                                    </td>
                                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedUserDetail(user);
                                                                setShowUserModal(true);
                                                            }}
                                                            style={{
                                                                padding: '6px 12px',
                                                                background: COLOR_BLUE,
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            Ver Detalles
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {(users.filter(u => {
                                const matchesSearch = userSearchTerm === '' || 
                                    u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                    u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                    u.city?.toLowerCase().includes(userSearchTerm.toLowerCase());
                                const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
                                return matchesSearch && matchesRole;
                            }).length === 0) && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '40px',
                                    color: '#999',
                                    background: '#f9fafb',
                                    borderRadius: '12px'
                                }}>
                                    <p style={{ fontSize: '16px', fontWeight: 'bold' }}>No se encontraron usuarios</p>
                                    <p style={{ fontSize: '14px' }}>Intenta con otros términos de búsqueda</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Modal de Detalles de Usuario */}
                {showUserModal && selectedUserDetail && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '30px',
                            maxWidth: '500px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, color: COLOR_BLUE }}>Detalles del Usuario</h2>
                                <button 
                                    onClick={() => setShowUserModal(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '24px',
                                        cursor: 'pointer',
                                        color: '#999'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Información básica */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px',
                                marginBottom: '25px'
                            }}>
                                {selectedUserDetail.avatar_url && (
                                    <div style={{ textAlign: 'center' }}>
                                        <NextImage 
                                            src={selectedUserDetail.avatar_url} 
                                            alt={selectedUserDetail.name || 'Usuario'}
                                            width={80}
                                            height={80}
                                            style={{
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: `3px solid ${COLOR_GOLD}`
                                            }}
                                        />
                                    </div>
                                )}

                                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                                    <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px', fontWeight: 'bold' }}>NOMBRE</p>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{selectedUserDetail.name}</p>
                                </div>

                                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                                    <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px', fontWeight: 'bold' }}>EMAIL</p>
                                    <p style={{ margin: 0, fontSize: '14px' }}>{selectedUserDetail.email}</p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px', fontWeight: 'bold' }}>ROL</p>
                                        <select 
                                            value={editingUserRole || selectedUserDetail.role}
                                            onChange={(e) => setEditingUserRole(e.target.value as 'tourist' | 'business' | 'admin')}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                border: `2px solid ${COLOR_GOLD}`,
                                                background: 'white',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="tourist">🧳 Turista</option>
                                            <option value="business">🏢 Negocio</option>
                                            <option value="admin">⚙️ Administrador</option>
                                        </select>
                                    </div>
                                    <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px', fontWeight: 'bold' }}>REGISTRO</p>
                                        <p style={{ margin: 0, fontSize: '13px' }}>
                                            {selectedUserDetail.created_at ? new Date(selectedUserDetail.created_at).toLocaleDateString('es-AR') : '-'}
                                        </p>
                                    </div>
                                </div>

                                {(selectedUserDetail.city || selectedUserDetail.country || selectedUserDetail.age || selectedUserDetail.phone) && (
                                    <>
                                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '15px 0' }} />
                                        <h4 style={{ margin: '10px 0 15px 0', color: COLOR_BLUE, fontSize: '14px', fontWeight: 'bold' }}>INFORMACIÓN ADICIONAL</h4>
                                        
                                        {selectedUserDetail.city && (
                                            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                                                <strong>Ciudad:</strong> {selectedUserDetail.city}
                                            </div>
                                        )}
                                        {selectedUserDetail.country && (
                                            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                                                <strong>País:</strong> {selectedUserDetail.country}
                                            </div>
                                        )}
                                        {selectedUserDetail.age && (
                                            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                                                <strong>Edad:</strong> {selectedUserDetail.age} años
                                            </div>
                                        )}
                                        {selectedUserDetail.phone && (
                                            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                                                <strong>Teléfono:</strong> {selectedUserDetail.phone}
                                            </div>
                                        )}
                                        {selectedUserDetail.bio && (
                                            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                                                <strong>Biografía:</strong> {selectedUserDetail.bio}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Botones de acción */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    onClick={async () => {
                                        if (editingUserRole && editingUserRole !== selectedUserDetail.role) {
                                            const { error } = await supabase
                                                .from('profiles')
                                                .update({ role: editingUserRole })
                                                .eq('id', selectedUserDetail.id);
                                            
                                            if (!error) {
                                                console.log('✅ Rol actualizado:', editingUserRole);
                                                setEditingUserRole(null);
                                                fetchUsers();
                                                alert(`Rol actualizado a: ${editingUserRole}`);
                                            } else {
                                                alert(getErrorMessage(error));
                                            }
                                        }
                                        setShowUserModal(false);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: COLOR_BLUE,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {editingUserRole ? 'Guardar Cambios' : 'Guardar'}
                                </button>
                                <button 
                                    onClick={() => setShowUserModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: '#e2e8f0',
                                        color: '#333',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '25px', fontWeight: 'bold' }}>🤖 IA y TTS</h3>
                        <AdminAISettings />
                    </div>
                )}

                {/* Tab: VISION IA */}
                {activeTab === 'vision' && (
                    <VisionAnalysisPanel />
                )}

                {/* Tab: BACKUP/EXPORT */}
                {activeTab === 'backup' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '25px', fontWeight: 'bold' }}>💾 Copia de Seguridad</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <button
                                onClick={exportAllJson}
                                style={{ ...submitBtn, width: 'auto' }}
                                disabled={exporting}
                            >
                                {exporting ? 'Exportando...' : 'Descargar JSON completo'}
                            </button>
                            <button
                                onClick={exportAllSql}
                                style={{ ...submitBtn, width: 'auto' }}
                                disabled={exporting}
                            >
                                {exporting ? 'Exportando...' : 'Descargar SQL completo'}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <select
                                    style={inputStyle}
                                    value={selectedExportTable}
                                    onChange={e => setSelectedExportTable(e.target.value)}
                                >
                                    <option value="">-- Seleccionar tabla --</option>
                                    <option value="all">📁 Todas las tablas</option>
                                    {EXPORT_TABLES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={exportCsv}
                                    disabled={exporting || !selectedExportTable}
                                    style={{ ...submitBtn, width: 'auto' }}
                                >
                                    {exporting ? 'Exportando...' : 'Descargar CSV'}
                                </button>
                                <button
                                    onClick={() => exportTableSql(selectedExportTable)}
                                    disabled={exporting || !selectedExportTable}
                                    style={{ ...submitBtn, width: 'auto' }}
                                >
                                    {exporting ? 'Exportando...' : 'Descargar SQL'}
                                </button>
                            </div>

                            <p style={{ fontSize: '13px', color: '#64748b' }}>
                                La lista de tablas puede ajustarse en el código. Cada botón genera un fichero descargable que puedes guardar en tu equipo.
                            </p>
                        </div>
                    </div>
                )}

                {/* Tab: CATEGORÍAS */}
                {activeTab === 'categorias' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '25px', fontWeight: 'bold' }}>🏷️ Crear Nueva Categoría</h3>
                        
                        <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
                            <div className="responsive-row" style={{ gap: '15px' }}>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Nombre de la Categoría</label>
                                    <input 
                                        style={inputStyle} 
                                        placeholder="Ej: histórico, restaurante..." 
                                        value={newCategory.name} 
                                        onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} 
                                        required 
                                    />
                                </div>
                                <div className="responsive-col">
                                    <label style={labelStyle}>Ícono (emoji)</label>
                                    <input 
                                        style={inputStyle} 
                                        placeholder="Ej: 🏛️, 🍽️..." 
                                        value={newCategory.icon} 
                                        onChange={e => setNewCategory({ ...newCategory, icon: e.target.value })} 
                                        required 
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label style={labelStyle}>Tipo</label>
                                <select 
                                    style={inputStyle} 
                                    value={newCategory.type} 
                                    onChange={e => setNewCategory({ ...newCategory, type: e.target.value })}
                                >
                                    <option value="attraction">Atractivos</option>
                                    <option value="business">Negocios</option>
                                </select>
                            </div>
                            
                            <button type="submit" style={btnPrimary}>Crear Categoría</button>
                        </form>

                        <h4>Categorías Existentes</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                            {[...attractionCategories, ...businessCategories].map(cat => (
                                <div key={`${cat.type}-${cat.name}`} style={{
                                    padding: '15px',
                                    border: `2px solid ${COLOR_GOLD}22`,
                                    borderRadius: '12px',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                                    <div>
                                        <strong>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</strong>
                                        <p style={{ margin: '0', fontSize: '0.8rem', color: '#777' }}>
                                            {cat.type === 'attraction' ? 'Atractivos' : 'Negocios'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab: FRASES */}
                {activeTab === 'frases' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '25px', fontWeight: 'bold' }}>💬 Frases de Santi</h3>
                        
                        <form onSubmit={handleAddPhrase} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
                            <Input label="Frase" value={newPhrase.text} onChange={v => setNewPhrase({ ...newPhrase, text: v })} placeholder="Escribe una frase inspiradora..." />
                            <div>
                                <label style={labelStyle}>Categoría</label>
                                <select style={inputStyle} value={newPhrase.category} onChange={e => setNewPhrase({ ...newPhrase, category: e.target.value })}>
                                    <option value="general">General</option>
                                    <option value="motivacional">Motivacional</option>
                                    <option value="reflexiva">Reflexiva</option>
                                    <option value="humorística">Humorística</option>
                                </select>
                            </div>
                            <button type="submit" style={btnPrimary}>Agregar Frase</button>
                        </form>

                        <h4>Frases Existentes ({phrases.length})</h4>
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {phrases.map(phrase => (
                                <div key={phrase.id} style={listItem}>
                                    <div>
                                        <p style={{ margin: '0', fontSize: '1rem', fontStyle: 'italic' }}>&quot;{phrase.phrase}&quot;</p>
                                        <span style={{ fontSize: '0.8rem', color: '#777', textTransform: 'capitalize' }}>{phrase.category}</span>
                                    </div>
                                    <button onClick={async () => { if (confirm('¿Eliminar esta frase?')) { await supabase.from('santis_phrases').delete().eq('id', phrase.id); fetchData(); } }} style={btnAction}>🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tab: MENSAJES PROMOCIONALES */}
                {activeTab === 'promociones' && (
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '1.5rem', color: COLOR_BLUE, marginBottom: '15px', fontWeight: 'bold' }}>💼 Mensajes Promocionales de Santi</h3>
                        <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '0.95rem' }}>
                            Estos mensajes aparecen de forma aleatoria cuando el usuario está inactivo por 2 minutos. 
                            La probabilidad por defecto es 25% (ajustable por mensaje).
                        </p>
                        
                        <form onSubmit={handleAddPromotionalMessage} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
                            <Input 
                                label="Nombre del Negocio/Categoría" 
                                value={newPromotionalMessage.business_name} 
                                onChange={v => setNewPromotionalMessage({ ...newPromotionalMessage, business_name: v })} 
                                placeholder="Ej: Nodo Tecnológico" 
                            />
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={labelStyle}>Mensaje Promocional</label>
                                    <button 
                                        type="button"
                                        onClick={generatePromotionalMessage}
                                        disabled={generatingPromo || !newPromotionalMessage.business_name.trim()}
                                        style={{ 
                                            ...btnAction, 
                                            fontSize: '0.85rem',
                                            padding: '6px 12px',
                                            opacity: (generatingPromo || !newPromotionalMessage.business_name.trim()) ? 0.5 : 1,
                                            cursor: (generatingPromo || !newPromotionalMessage.business_name.trim()) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {generatingPromo ? '⏳ Generando...' : '✨ Generar con IA'}
                                    </button>
                                </div>
                                <textarea
                                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                                    value={newPromotionalMessage.message}
                                    onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, message: e.target.value })}
                                    placeholder="Escribe el mensaje completo que Santi dirá..."
                                    required
                                />
                            </div>
                            
                            {/* Mensajes en otros idiomas */}
                            <div style={{ 
                                background: 'rgba(100, 150, 200, 0.1)', 
                                padding: '15px', 
                                borderRadius: '8px',
                                borderLeft: '4px solid #4995cc'
                            }}>
                                <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#1a3a6c' }}>🌐 Traducciones (Opcional)</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={labelStyle}>🇬🇧 English</label>
                                        <textarea
                                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontSize: '0.9rem' }}
                                            value={newPromotionalMessage.message_en}
                                            onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, message_en: e.target.value })}
                                            placeholder="English version..."
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>🇧🇷 Português</label>
                                        <textarea
                                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontSize: '0.9rem' }}
                                            value={newPromotionalMessage.message_pt}
                                            onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, message_pt: e.target.value })}
                                            placeholder="Versão em português..."
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>🇫🇷 Français</label>
                                        <textarea
                                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontSize: '0.9rem' }}
                                            value={newPromotionalMessage.message_fr}
                                            onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, message_fr: e.target.value })}
                                            placeholder="Version française..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={labelStyle}>Categoría</label>
                                    <select 
                                        style={inputStyle} 
                                        value={newPromotionalMessage.category} 
                                        onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, category: e.target.value })}
                                    >
                                        <option value="general">General</option>
                                        <option value="gastronomia">Gastronomía</option>
                                        <option value="hoteleria">Hotelería</option>
                                        <option value="tecnologia">Tecnología</option>
                                        <option value="cultura">Cultura</option>
                                        <option value="turismo">Turismo</option>
                                        <option value="servicios">Servicios</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Prioridad (0-10)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        style={inputStyle}
                                        value={newPromotionalMessage.priority}
                                        onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, priority: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Probabilidad (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        style={inputStyle}
                                        value={newPromotionalMessage.show_probability}
                                        onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, show_probability: parseInt(e.target.value) || 25 })}
                                    />
                                </div>
                            </div>
                            {/* New fields for media */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                                <div>
                                    <label style={labelStyle}>Imagen (URL o archivo)</label>
                                    <input
                                        type="text"
                                        style={inputStyle}
                                        value={newPromotionalMessage.image_url || ''}
                                        onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, image_url: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ marginTop: '6px' }}
                                        onChange={async e => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            // upload handled below
                                            const url = await handleFileUpload(file, 'images');
                                            if (url) setNewPromotionalMessage(prev => ({ ...prev, image_url: url }));
                                        }}
                                    />
                                    {newPromotionalMessage.image_url && (
                                        <NextImage src={newPromotionalMessage.image_url} alt="preview" width={400} height={300} style={{ maxWidth: '100%', marginTop: '8px', borderRadius: '6px' }} />
                                    )}
                                </div>
                                <div>
                                    <label style={labelStyle}>Video (URL o archivo)</label>
                                    <input
                                        type="text"
                                        style={inputStyle}
                                        value={newPromotionalMessage.video_url || ''}
                                        onChange={e => setNewPromotionalMessage({ ...newPromotionalMessage, video_url: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    <input
                                        type="file"
                                        accept="video/*"
                                        style={{ marginTop: '6px' }}
                                        onChange={async e => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            // upload handled below
                                            // upload to images bucket for simplicity
                                            const url = await handleFileUpload(file, 'images');
                                            if (url) setNewPromotionalMessage(prev => ({ ...prev, video_url: url }));
                                        }}
                                    />
                                    {newPromotionalMessage.video_url && (
                                        <div style={{ marginTop: '8px' }}>
                                            <a href={newPromotionalMessage.video_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>Ver video</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" style={{ ...btnPrimary, flex: 1 }}>
                                    {editingPromotionalMessageId ? '💾 Actualizar Mensaje' : '✅ Agregar Mensaje Promocional'}
                                </button>
                                {editingPromotionalMessageId && (
                                    <button 
                                        type="button" 
                                        onClick={handleCancelEditPromotionalMessage}
                                        style={{ 
                                            ...btnAction, 
                                            background: '#6b7280',
                                            color: 'white',
                                            padding: '12px 20px'
                                        }}
                                    >
                                        ❌ Cancelar
                                    </button>
                                )}
                            </div>
                        </form>

                        <h4>Mensajes Existentes ({promotionalMessages.length})</h4>
                        <div style={{ display: 'grid', gap: '20px' }}>
                            {promotionalMessages.map(promo => (
                                <div 
                                    key={promo.id} 
                                    style={{
                                        ...listItem,
                                        flexDirection: 'column',
                                        alignItems: 'stretch',
                                        padding: '20px',
                                        background: promo.is_active ? 'white' : '#f8f9fa',
                                        opacity: promo.is_active ? 1 : 0.6,
                                        border: promo.is_active ? '2px solid #10b981' : '2px solid #e5e7eb'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                        <div>
                                            <h5 style={{ margin: '0 0 8px 0', color: COLOR_BLUE, fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                {promo.business_name}
                                            </h5>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                <span style={{ 
                                                    fontSize: '0.75rem', 
                                                    padding: '4px 8px', 
                                                    borderRadius: '6px',
                                                    background: '#e0e7ff',
                                                    color: '#4338ca',
                                                    fontWeight: '600'
                                                }}>
                                                    {promo.category}
                                                </span>
                                                <span style={{ 
                                                    fontSize: '0.75rem', 
                                                    padding: '4px 8px', 
                                                    borderRadius: '6px',
                                                    background: '#fef3c7',
                                                    color: '#92400e',
                                                    fontWeight: '600'
                                                }}>
                                                    ⭐ Prioridad: {promo.priority}
                                                </span>
                                                <span style={{ 
                                                    fontSize: '0.75rem', 
                                                    padding: '4px 8px', 
                                                    borderRadius: '6px',
                                                    background: '#dbeafe',
                                                    color: '#1e40af',
                                                    fontWeight: '600'
                                                }}>
                                                    🎲 {promo.show_probability}%
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => handleEditPromotionalMessage(promo)}
                                                style={{
                                                    ...btnAction,
                                                    background: '#3b82f6',
                                                    color: 'white',
                                                    padding: '8px 12px',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button 
                                                onClick={() => handleTogglePromotionalMessage(promo.id, promo.is_active)}
                                                style={{
                                                    ...btnAction,
                                                    background: promo.is_active ? '#ef4444' : '#10b981',
                                                    color: 'white',
                                                    padding: '8px 12px',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {promo.is_active ? '⏸️ Pausar' : '▶️ Activar'}
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePromotionalMessage(promo.id)}
                                                style={btnAction}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    <p style={{ 
                                        margin: '0 0 12px 0', 
                                        fontSize: '0.95rem', 
                                        fontStyle: 'italic', 
                                        color: '#475569',
                                        lineHeight: '1.6'
                                    }}>
                                        &quot;{promo.message}&quot;
                                    </p>
                                    {/* Translation status badges */}
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '3px 6px',
                                            borderRadius: '4px',
                                            background: '#dcfce7',
                                            color: '#166534',
                                            fontWeight: 'bold'
                                        }}>
                                            🇪🇸 ES
                                        </span>
                                        {promo.message_en && (
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '3px 6px',
                                                borderRadius: '4px',
                                                background: '#dbeafe',
                                                color: '#1e40af',
                                                fontWeight: 'bold'
                                            }}>
                                                🇬🇧 EN
                                            </span>
                                        )}
                                        {promo.message_pt && (
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '3px 6px',
                                                borderRadius: '4px',
                                                background: '#fed7aa',
                                                color: '#92400e',
                                                fontWeight: 'bold'
                                            }}>
                                                🇧🇷 PT
                                            </span>
                                        )}
                                        {promo.message_fr && (
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '3px 6px',
                                                borderRadius: '4px',
                                                background: '#fce7f3',
                                                color: '#831843',
                                                fontWeight: 'bold'
                                            }}>
                                                🇫🇷 FR
                                            </span>
                                        )}
                                    </div>
                                    {promo.image_url && (
                                        <NextImage src={promo.image_url} alt="promo" width={200} height={112} style={{ maxWidth: '200px', marginTop: '10px', borderRadius: '6px' }} />
                                    )}
                                    {promo.video_url && (
                                        <div style={{ marginTop: '10px' }}>
                                            <a href={promo.video_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>
                                                🔗 Ver video
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {promotionalMessages.length === 0 && (
                                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                                    No hay mensajes promocionales aún. ¡Creá el primero!
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .loading-spinner { border: 3px solid #f3f3f3; border-top: 3px solid #20B2AA; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    .admin-layout { flex-direction: column; }
                    .mobile-only-header { display: flex !important; }
                    .sidebar { position: fixed; left: -260px; top: 60px; height: calc(100vh - 60px); z-index: 1000; width: 260px !important; transition: 0.3s; }
                    .sidebar.open { left: 0; }
                    .main-content { padding: 80px 20px 20px 20px !important; }
                    .form-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}

// Styles
const COLOR_GOLD = '#F1C40F';
const COLOR_BLUE = '#1A3A6C';
const COLOR_DARK = '#0e1f1d';

const tabStyle = (active: boolean) => ({ 
    background: active ? `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)` : 'transparent', 
    border: 'none', 
    padding: '2px 2px', 
    borderRadius: '15px', 
    color: active ? COLOR_DARK : 'rgba(255,255,255,0.8)', 
    textAlign: 'left' as const, 
    cursor: 'pointer', 
    fontSize: '12px',
    fontWeight: active ? 'bold' : '600',
    transition: 'all 0.2s ease',
    boxShadow: active ? `0 6px 14px ${COLOR_GOLD}44` : 'none'
});

const cardStyle = { 
    background: 'white', 
    padding: '5px', 
    borderRadius: '8px', 
    boxShadow: '0 8px 20px rgba(0,0,0,0.11)',
    border: `1px solid ${COLOR_GOLD}22`
};

const logoutBtn = { 
    background: `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)`, 
    border: 'none', 
    color: 'white', 
    padding: '5px', 
    borderRadius: '15px', 
    width: '100%', 
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '15px',
    boxShadow: '0 8px 20px rgba(239,68,68,0.3)',
    transition: 'all 0.2s ease'
};

const labelStyle = { 
    display: 'block', 
    marginBottom: '10px', 
    fontWeight: 'bold', 
    fontSize: '15px', 
    color: COLOR_BLUE 
};

const inputStyle = { 
    width: '100%', 
    padding: '10px 12px', 
    borderRadius: '16px', 
    border: '1px solid #cbd5e1', 
    outline: 'none', 
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease'
};

const textareaStyle = { 
    width: '100%', 
    padding: '10px 12px', 
    borderRadius: '12px', 
    border: '1px solid #cbd5e1', 
    outline: 'none', 
    fontFamily: 'inherit', 
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    minHeight: '80px',
    maxHeight: '120px',
    resize: 'vertical' as const
};

const btnPrimary = { 
    background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`, 
    color: COLOR_DARK, 
    border: 'none', 
    padding: '16px 28px', 
    borderRadius: '50px', 
    fontWeight: 'bold', 
    cursor: 'pointer', 
    flex: 1,
    fontSize: '16px',
    boxShadow: `0 10px 30px ${COLOR_GOLD}44`,
    transition: 'all 0.2s ease'
};

const btnAction = { 
    background: 'white', 
    border: `2px solid ${COLOR_BLUE}22`, 
    padding: '8px 14px', 
    borderRadius: '50px', 
    cursor: 'pointer', 
    fontSize: '13px',
    fontWeight: '700',
    color: COLOR_BLUE,
    transition: 'all 0.25s ease',
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    whiteSpace: 'nowrap' as const
};

const submitBtn = { 
    background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`, 
    color: COLOR_DARK, 
    border: 'none', 
    padding: '16px 28px', 
    borderRadius: '20px', 
    fontWeight: 'bold', 
    cursor: 'pointer', 
    width: '100%',
    fontSize: '16px',
    boxShadow: `0 10px 30px ${COLOR_GOLD}44`,
    transition: 'all 0.2s ease'
};

const btnStyle = { 
    background: 'white', 
    border: `2px solid ${COLOR_BLUE}22`, 
    padding: '8px 14px', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontSize: '14px',
    fontWeight: '600',
    color: COLOR_BLUE,
    transition: 'all 0.2s ease'
};

const btnDelete = { 
    color: 'white', 
    border: 'none', 
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
    padding: '12px', 
    borderRadius: '20px', 
    cursor: 'pointer', 
    fontSize: '14px', 
    width: '100%', 
    marginTop: '12px',
    fontWeight: 'bold',
    boxShadow: '0 6px 20px rgba(239,68,68,0.3)'
};

const listItem = { 
    padding: '10px', 
    border: `1px solid ${COLOR_GOLD}22`, 
    borderRadius: '16px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    background: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    transition: 'all 0.2s ease'
};

const placeCard = { 
    border: `2px solid ${COLOR_GOLD}22`, 
    borderRadius: '18px', 
    overflow: 'hidden', 
    background: '#fff', 
    cursor: 'pointer', 
    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%'
};


const Input = ({ label, value, onChange, placeholder }: { label: string, value: string | number, onChange: (v: string) => void, placeholder?: string }) => (
    <div style={{ width: '100%' }}>
        {label && <label style={labelStyle}>{label}</label>}
        <input style={inputStyle} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
);
