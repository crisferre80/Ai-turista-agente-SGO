"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, Trash2, Folder, Image as ImageIcon, ArrowLeft, Plus } from 'lucide-react';
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

  // Construir la ruta completa del archivo (carpeta actual + nombre del archivo)
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
      {/* Selection Checkbox */}
      <div
        className="absolute top-2 left-2 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(file.id);
        }}
      >
        <div
          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-white border-gray-300 hover:border-blue-400'
          }`}
        >
          {isSelected && <Check size={14} />}
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(file.id);
        }}
        className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg transition-colors shadow-md"
      >
        <Trash2 size={14} />
      </button>

      {/* Image Preview */}
      <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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

      {/* File Info */}
      <div className="p-3 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
        <h3 className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={file.name}>
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
  
  // Estado para gestión de atractivos
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(attractionIdParam);
  const [showAttractionSelector, setShowAttractionSelector] = useState(false);
  const initialAssignmentType: 'main' | 'gallery' =
    mode === 'place-gallery' || mode === 'place-gallery-new' ? 'gallery' : 'main';
  const [assignmentType, setAssignmentType] = useState<'main' | 'gallery'>(initialAssignmentType);

  // Cargar atractivos
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
        // Separar archivos y carpetas
        // Las carpetas en Supabase Storage no tienen metadata o mimetype
        const folders: string[] = [];
        const imageFiles: FileItem[] = [];

        data.forEach(item => {
          // Es una carpeta si termina en '/' o no tiene mimetype
          if (item.name?.endsWith('/') || !item.metadata?.mimetype) {
            if (!item.name?.endsWith('/')) {
              // Es una carpeta sin el '/' final, agregarlo
              folders.push(item.name + '/');
            } else {
              folders.push(item.name);
            }
          } else if (item.metadata?.mimetype?.startsWith('image/')) {
            // Es un archivo de imagen
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

      // Construir la ruta completa del archivo
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
      // Construir rutas completas para cada archivo
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

  const handleAssignToAttraction = async () => {
    const targetAttractionId = attractionIdParam || selectedAttraction;
    if (!targetAttractionId || selectedFiles.size === 0) return;

    try {
      const selectedFileObjects = files.filter(f => selectedFiles.has(f.id));
      // Construir rutas completas para obtener las URLs públicas
      const imageUrls = selectedFileObjects.map(f => {
        const fullPath = currentFolder ? `${currentFolder}${f.name}` : f.name;
        return supabase.storage.from(bucketName).getPublicUrl(fullPath).data.publicUrl;
      });

      const attraction = attractions.find(a => a.id === targetAttractionId);
      if (!attraction) return;

      if (assignmentType === 'main') {
        // Asignar como imagen principal
        const { error } = await supabase
          .from('attractions')
          .update({ image_url: imageUrls[0] })
          .eq('id', targetAttractionId);

        if (error) throw error;
        alert('Imagen principal asignada correctamente');
      } else {
        // Asignar a galería
        const currentGallery = attraction.gallery_urls || [];
        const newGallery = [...currentGallery, ...imageUrls];

        const { error } = await supabase
          .from('attractions')
          .update({ gallery_urls: newGallery })
          .eq('id', targetAttractionId);

        if (error) throw error;
        alert(`${imageUrls.length} imagen(es) agregada(s) a la galería`);
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
  };

  const handleFolderClick = (folderName: string) => {
    setCurrentFolder(prev => prev ? `${prev}${folderName}` : folderName);
  };

  const handleGoBack = () => {
    if (currentFolder) {
      const parts = currentFolder.split('/').filter(Boolean);
      parts.pop();
      setCurrentFolder(parts.length > 0 ? parts.join('/') + '/' : '');
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur sticky top-0 z-20 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestor de Imágenes</h1>
                <p className="text-xs text-gray-500 mt-0.5">Explora, selecciona y asigna imágenes a tus atractivos.</p>
              </div>
              {currentFolder && (
                <button
                  onClick={handleGoBack}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  ← Volver
                </button>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="hidden sm:inline">
                {files.length} archivo(s) • {selectedFiles.size} seleccionado(s)
              </span>
              <span className="sm:hidden">
                {files.length} imgs
              </span>
            </div>
          </div>
          {currentFolder && (
            <div className="mt-2 text-sm text-gray-600">
              Carpeta: <span className="font-medium">{currentFolder}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      {selectedFiles.size > 0 && (
        <div className="bg-blue-50/90 border-b border-blue-200/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSelectAll}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm font-medium"
                >
                  {selectedFiles.size === files.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Eliminar ({selectedFiles.size})
                </button>
              </div>
              {isNewPlaceContext ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleUseForNewPlace}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Usar en nuevo atractivo
                  </button>
                </div>
              ) : hasPreselectedAttraction ? (
                <div className="flex items-center space-x-3">
                  <select
                    value={assignmentType}
                    onChange={(e) => setAssignmentType(e.target.value as 'main' | 'gallery')}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                  >
                    <option value="main">Imagen Principal</option>
                    <option value="gallery">Galería</option>
                  </select>
                  <button
                    onClick={async () => {
                      await handleAssignToAttraction();
                      router.push('/admin');
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Asignar a este atractivo
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <select
                    value={assignmentType}
                    onChange={(e) => setAssignmentType(e.target.value as 'main' | 'gallery')}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                  >
                    <option value="main">Imagen Principal</option>
                    <option value="gallery">Galería</option>
                  </select>
                  <button
                    onClick={() => setShowAttractionSelector(!showAttractionSelector)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Asignar a Atractivo
                  </button>
                </div>
              )}
            </div>

            {/* Attraction Selector */}
            {!isNewPlaceContext && !hasPreselectedAttraction && showAttractionSelector && (
              <div className="mt-3 bg-white rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Atractivo:
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedAttraction || ''}
                    onChange={(e) => setSelectedAttraction(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">-- Seleccionar --</option>
                    {attractions.map(attr => (
                      <option key={attr.id} value={attr.id}>{attr.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignToAttraction}
                    disabled={!selectedAttraction}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm font-medium transition"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setShowAttractionSelector(false);
                      setSelectedAttraction(null);
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Carpetas</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {folders.map((folder) => (
                    <button
                      key={folder}
                      onClick={() => handleFolderClick(folder)}
                      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow flex flex-col items-center"
                    >
                      <Folder size={32} className="text-blue-500 mb-2" />
                      <span className="text-sm font-medium text-gray-900 truncate w-full text-center">
                        {folder.replace('/', '')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {files.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Imágenes</h2>
                  {files.length > 0 && (
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {selectedFiles.size === files.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                  {files.map((file) => (
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
            ) : (
              <div className="text-center py-12">
                <ImageIcon size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay imágenes</h3>
                <p className="text-gray-500">
                  {currentFolder ? 'Esta carpeta está vacía' : 'No se encontraron imágenes en el bucket'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
