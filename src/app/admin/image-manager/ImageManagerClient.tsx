"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, Trash2, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface FileMetadata {
  mimetype?: string;
  size?: number;
  cacheControl?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
}

interface FileItem {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: FileMetadata | null;
}

interface Attraction {
  id: string;
  name: string;
  image_url?: string;
  gallery_urls?: string[];
}

interface ImageCardProps {
  file: FileItem;
  bucketName: string;
  currentFolder: string;
  isSelected: boolean;
  onSelect: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}

function ImageCard({ file, bucketName, currentFolder, isSelected, onSelect, onDelete }: ImageCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const fullPath = currentFolder ? `${currentFolder}${file.name}` : file.name;
  const fileUrl = supabase.storage.from(bucketName).getPublicUrl(fullPath).data.publicUrl;
  const isImage = file.metadata?.mimetype?.startsWith('image/');
  const fileSize = file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(1)} KB` : 'Unknown';

  return (
    <div
      className={`group relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      onClick={() => onSelect(file.id)}
    >
      <div
        className="absolute top-2 left-2 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(file.id);
        }}
      >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'bg-white border-gray-300 hover:border-blue-400'
            }`}
          >
            {isSelected && <Check size={12} />}
          </div>
        </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(file.id);
        }}
        className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white p-1 rounded-lg transition-colors shadow-md"
      >
        <Trash2 size={12} />
      </button>

      <div className="aspect-[4/5] bg-gray-100 flex items-center justify-center relative">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}

        {isImage && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={file.name}
            className={`w-full h-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200 group-hover:scale-[1.02]`}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 p-4">
            <ImageIcon size={32} className="mb-2" />
            <span className="text-xs text-center">{file.metadata?.mimetype?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
        <h3 className="text-[11px] sm:text-xs font-medium text-gray-900 truncate" title={file.name}>
          {file.name}
        </h3>
        <p className="text-[11px] text-gray-500 mt-1 flex items-center justify-between gap-2">
          {fileSize} • {new Date(file.updated_at).toLocaleDateString()}
          <span className="inline-flex px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] uppercase tracking-wide text-gray-500">
            {file.metadata?.mimetype?.split('/')[1] || 'img'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default function ImageManagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modeParam = searchParams.get('mode');
  const attractionIdParam = searchParams.get('attractionId');

  type ManagerMode = 'place-main' | 'place-gallery' | 'place-main-new' | 'place-gallery-new';
  const mode = (modeParam as ManagerMode) || null;
  const isNewPlaceContext = mode === 'place-main-new' || mode === 'place-gallery-new';
  const hasPreselectedAttraction = !!attractionIdParam;

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [bucketName] = useState('images');
  const [currentFolder, setCurrentFolder] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(attractionIdParam);
  const [showAttractionSelector, setShowAttractionSelector] = useState(false);
  const initialAssignmentType: 'main' | 'gallery' =
    mode === 'place-gallery' || mode === 'place-gallery-new' ? 'gallery' : 'main';
  const [assignmentType, setAssignmentType] = useState<'main' | 'gallery'>(initialAssignmentType);

  const loadAttractions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('attractions')
        .select('id, name, image_url, gallery_urls')
        .order('name');

      if (error) throw error;
      setAttractions(data || []);
    } catch (err) {
      console.error('Error loading attractions:', err);
    }
  }, []);

  useEffect(() => {
    loadAttractions();
  }, [loadAttractions]);

  useEffect(() => {
    console.debug('ImageManager: modeParam=', modeParam, 'attractionIdParam=', attractionIdParam, 'isNewPlaceContext=', isNewPlaceContext, 'hasPreselectedAttraction=', hasPreselectedAttraction);
  }, [modeParam, attractionIdParam, isNewPlaceContext, hasPreselectedAttraction]);

  const loadFiles = useCallback(async (folderPath: string = '') => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath, {
          limit: 200,
          offset: 0,
          sortBy: { column: 'updated_at', order: 'desc' }
        });

      if (error) throw error;

      if (data) {
        const folders: string[] = [];
        const imageFiles: FileItem[] = [];

        data.forEach(item => {
          if (item.name?.endsWith('/') || !item.metadata?.mimetype) {
            if (!item.name?.endsWith('/')) {
              folders.push(item.name + '/');
            } else {
              folders.push(item.name);
            }
          } else if (item.metadata?.mimetype?.startsWith('image/')) {
            imageFiles.push(item as FileItem);
          }
        });

        console.log('Loaded:', { folders, imageCount: imageFiles.length });
        setFiles(imageFiles);
        setFolders(folders);
      }
    } catch (err) {
      console.error('Error loading files:', err);
      setError(err instanceof Error ? err.message : 'Error loading files');
    } finally {
      setLoading(false);
    }
  }, [bucketName]);

  useEffect(() => {
    loadFiles(currentFolder);
  }, [loadFiles, currentFolder]);

  const handleSelectFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Asigna las imágenes seleccionadas a un nuevo atractivo (guarda en localStorage y vuelve a /admin)
  const assignSelectedToNewPlace = useCallback((fileIdSet: Set<string>) => {
    if (!isNewPlaceContext || fileIdSet.size === 0) return;

    const selectedFileObjects = files.filter(f => fileIdSet.has(f.id));
    const imageUrls = selectedFileObjects.map(f => {
      const fullPath = currentFolder ? `${currentFolder}${f.name}` : f.name;
      return supabase.storage.from(bucketName).getPublicUrl(fullPath).data.publicUrl;
    });

    if (typeof window === 'undefined') return;

    if (mode === 'place-main-new') {
      const mainUrl = imageUrls[0];
      if (mainUrl) {
        window.localStorage.setItem('pendingNewPlaceMainImage', mainUrl);
      }
    } else if (mode === 'place-gallery-new') {
      if (imageUrls.length > 0) {
        window.localStorage.setItem('pendingNewPlaceGalleryImages', JSON.stringify(imageUrls));
      }
    }

    router.push('/admin');
  }, [isNewPlaceContext, files, currentFolder, bucketName, mode, router]);

  

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) return;

    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      const fullPath = currentFolder ? `${currentFolder}${file.name}` : file.name;

      const { error } = await supabase.storage
        .from(bucketName)
        .remove([fullPath]);

      if (error) throw error;

      setFiles(prev => prev.filter(f => f.id !== fileId));
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('Error al eliminar el archivo');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedFiles.size} archivo(s)?`)) return;

    try {
      const filesToDelete = files.filter(f => selectedFiles.has(f.id));
      const fileNames = filesToDelete.map(f => 
        currentFolder ? `${currentFolder}${f.name}` : f.name
      );

      const { error } = await supabase.storage
        .from(bucketName)
        .remove(fileNames);

      if (error) throw error;

      setFiles(prev => prev.filter(f => !selectedFiles.has(f.id)));
      setSelectedFiles(new Set());
    } catch (err) {
      console.error('Error deleting files:', err);
      alert('Error al eliminar los archivos');
    }
  };

  const handleAssignToAttraction = useCallback(async () => {
    await assignSelectedToAttraction(selectedFiles);
  }, [assignSelectedToAttraction, selectedFiles]);

  // Función auxiliar que recibe un Set de fileIds y realiza la asignación
  const assignSelectedToAttraction = useCallback(async (fileIdSet: Set<string>) => {
    const targetAttractionId = attractionIdParam || selectedAttraction;
    if (!targetAttractionId || fileIdSet.size === 0) return;

    try {
      const selectedFileObjects = files.filter(f => fileIdSet.has(f.id));
      const imageUrls = selectedFileObjects.map(f => {
        const fullPath = currentFolder ? `${currentFolder}${f.name}` : f.name;
        return supabase.storage.from(bucketName).getPublicUrl(fullPath).data.publicUrl;
      });

      // Obtener la versión más reciente del atractivo desde la DB
      const { data: attractionFresh, error: fetchErr } = await supabase
        .from('attractions')
        .select('id, gallery_urls, image_url')
        .eq('id', targetAttractionId)
        .single();

      if (fetchErr) throw fetchErr;

      if (assignmentType === 'main') {
        const { error } = await supabase
          .from('attractions')
          .update({ image_url: imageUrls[0] })
          .eq('id', targetAttractionId);

        if (error) throw error;
        router.push(`/admin?editAttractionId=${targetAttractionId}`);
      } else {
        const currentGallery: string[] = Array.isArray(attractionFresh?.gallery_urls) ? attractionFresh.gallery_urls : [];

        // Unir evitando duplicados
        const combined = [...currentGallery, ...imageUrls];
        const newGallery = combined.filter((v, i) => combined.indexOf(v) === i);

        const { error } = await supabase
          .from('attractions')
          .update({ gallery_urls: newGallery })
          .eq('id', targetAttractionId);

        if (error) throw error;
        router.push(`/admin?editAttractionId=${targetAttractionId}`);
      }

      setSelectedFiles(new Set());
      setShowAttractionSelector(false);
      if (!attractionIdParam) {
        setSelectedAttraction(null);
      }
      await loadAttractions();
    } catch (err) {
      console.error('Error assigning images:', err);
      alert('Error al asignar las imágenes');
    }
  }, [attractionIdParam, selectedAttraction, files, currentFolder, bucketName, assignmentType, router, loadAttractions]);

  // React to selection changes to perform safe (post-render) assignments
  useEffect(() => {
    if (selectedFiles.size === 0) return;

    // If creating a new place and selecting main image -> assign first selected and navigate
    if (isNewPlaceContext && mode === 'place-main-new') {
      // Assign only the first selected image for main
      const firstId = Array.from(selectedFiles)[0];
      if (firstId) {
        assignSelectedToNewPlace(new Set([firstId]));
      }
      return;
    }

    // For editing an existing attraction opened with attractionIdParam, auto-assign only when
    // assigning the main image. For gallery assignment, user must confirm via modal/button
    if (hasPreselectedAttraction && assignmentType === 'main') {
      assignSelectedToAttraction(selectedFiles);
    }
  }, [selectedFiles, isNewPlaceContext, mode, hasPreselectedAttraction, assignmentType, assignSelectedToNewPlace, assignSelectedToAttraction]);

  const handleFolderClick = (folderName: string) => {
    setCurrentFolder(prev => prev ? `${prev}${folderName}` : folderName);
  };

  

  const handleUseForNewPlace = () => {
    if (!isNewPlaceContext || selectedFiles.size === 0) return;

    const selectedFileObjects = files.filter(f => selectedFiles.has(f.id));
    const imageUrls = selectedFileObjects.map(f => {
      const fullPath = currentFolder ? `${currentFolder}${f.name}` : f.name;
      return supabase.storage.from(bucketName).getPublicUrl(fullPath).data.publicUrl;
    });

    if (typeof window === 'undefined') return;

    if (mode === 'place-main-new') {
      const mainUrl = imageUrls[0];
      if (mainUrl) {
        window.localStorage.setItem('pendingNewPlaceMainImage', mainUrl);
      }
    } else if (mode === 'place-gallery-new') {
      if (imageUrls.length > 0) {
        window.localStorage.setItem('pendingNewPlaceGalleryImages', JSON.stringify(imageUrls));
      }
    }

    router.push('/admin');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => loadFiles(currentFolder)}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-white rounded shadow">
              <ArrowLeft />
            </button>
            <h1 className="text-xl font-semibold">Image Manager</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSelectAll()} className="px-3 py-2 bg-white rounded shadow">Seleccionar todo</button>
            <button onClick={() => handleDeleteSelected()} className="px-3 py-2 bg-red-600 text-white rounded shadow">Eliminar seleccionados</button>
            <button onClick={() => setShowAttractionSelector(true)} className="px-3 py-2 bg-blue-600 text-white rounded shadow">Asignar</button>
          </div>
        </div>

        {showAttractionSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Asignar imágenes a atractivo</h2>

              {hasPreselectedAttraction ? (
                <div className="mb-4">
                  <p className="text-sm">Asignando a atractivo preseleccionado: <strong>{attractions.find(a=>a.id===attractionIdParam)?.name || attractionIdParam}</strong></p>
                </div>
              ) : isNewPlaceContext ? (
                <div className="mb-4">
                  <p className="text-sm">Estás asignando imágenes a un <strong>nuevo atractivo</strong>. Al confirmar volverás al formulario de creación y las imágenes quedarán preseleccionadas.</p>
                  <p className="text-xs text-gray-500 mt-2">Modo: {mode}</p>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="text-sm block mb-2">Seleccionar atractivo</label>
                  <select className="w-full border p-2 rounded" value={selectedAttraction || ''} onChange={(e) => setSelectedAttraction(e.target.value)}>
                    <option value="">-- Elegir --</option>
                    {attractions.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="text-sm block mb-2">Tipo de asignación</label>
                <div className="flex gap-2">
                  <button onClick={() => setAssignmentType('main')} className={`px-3 py-2 rounded ${assignmentType==='main' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Imagen principal</button>
                  <button onClick={() => setAssignmentType('gallery')} className={`px-3 py-2 rounded ${assignmentType==='gallery' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Galería</button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowAttractionSelector(false); }} className="px-3 py-2 bg-gray-200 rounded">Cancelar</button>
                {isNewPlaceContext ? (
                  <button onClick={() => { handleUseForNewPlace(); }} className="px-3 py-2 bg-blue-600 text-white rounded">Asignar a nuevo atractivo</button>
                ) : (
                  <button onClick={() => handleAssignToAttraction()} className="px-3 py-2 bg-blue-600 text-white rounded">Confirmar</button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-1 bg-white p-4 rounded">
            <h3 className="text-sm font-medium mb-2">Carpetas</h3>
            <div className="flex flex-col gap-2">
              <button onClick={() => setCurrentFolder('')} className="text-left">Raíz</button>
              {folders.map(f => (
                <button key={f} onClick={() => handleFolderClick(f)} className="text-left">{f}</button>
              ))}
            </div>
          </div>

          <div className="col-span-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {files.map(file => (
                <ImageCard
                  key={file.id}
                  file={file}
                  bucketName={bucketName}
                  currentFolder={currentFolder}
                  isSelected={selectedFiles.has(file.id)}
                  onSelect={handleSelectFile}
                  onDelete={handleDeleteFile}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
