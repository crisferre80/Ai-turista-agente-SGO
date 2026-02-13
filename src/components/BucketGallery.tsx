"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Check, X, Download, Trash2 } from 'lucide-react';

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

interface BucketGalleryProps {
  bucketName: string;
  onClose?: () => void;
  maxSelection?: number;
  allowedTypes?: string[]; // e.g., ['image/', 'model/']
}

 
export default function BucketGallery({
  bucketName,
  onClose,
  maxSelection = 10,
  allowedTypes = ['image/']
}: BucketGalleryProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.storage
        .from(bucketName)
        .list('', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      // Filter by allowed types if specified
      const filteredFiles = allowedTypes.length > 0
        ? data?.filter(file => {
            const mimeType = file.metadata?.mimetype || '';
            return allowedTypes.some(type => mimeType.startsWith(type));
          }) || []
        : data || [];

      setFiles(filteredFiles);
    } catch (err) {
      console.error('Error loading files:', err);
      setError('Error al cargar los archivos');
    } finally {
      setLoading(false);
    }
  }, [bucketName, allowedTypes]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const toggleSelection = (fileName: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else if (newSet.size < maxSelection) {
        newSet.add(fileName);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      const allFiles = files.slice(0, maxSelection).map(f => f.name);
      setSelectedFiles(new Set(allFiles));
    }
  };

  const getFileUrl = (fileName: string) => {
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  const downloadSelected = async () => {
    for (const fileName of selectedFiles) {
      const url = getFileUrl(fileName);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`¿Eliminar ${selectedFiles.size} archivo(s)?`)) return;

    try {
      const deletePromises = Array.from(selectedFiles).map(fileName =>
        supabase.storage.from(bucketName).remove([fileName])
      );

      await Promise.all(deletePromises);
      setSelectedFiles(new Set());
      loadFiles(); // Reload files
    } catch (err) {
      console.error('Error deleting files:', err);
      setError('Error al eliminar archivos');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando archivos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadFiles}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Galería de Archivos - {bucketName}</h2>
          <span className="text-sm text-gray-600">
            {selectedFiles.size} de {maxSelection} seleccionados
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            {selectedFiles.size === files.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
          </button>
          {selectedFiles.size > 0 && (
            <>
              <button
                onClick={downloadSelected}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1"
              >
                <Download size={14} />
                Descargar
              </button>
              <button
                onClick={deleteSelected}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center gap-1"
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* File Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {files.map((file) => {
          const isSelected = selectedFiles.has(file.name);
          const isImage = file.metadata?.mimetype?.startsWith('image/');
          const fileUrl = getFileUrl(file.name);

          return (
            <div
              key={file.name}
              onClick={() => toggleSelection(file.name)}
              className={`
                relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all
                ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 z-10">
                  <Check size={12} />
                </div>
              )}

              {/* File Preview */}
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {isImage ? (
                  <Image
                    src={fileUrl}
                    alt={file.name}
                    width={150}
                    height={150}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback for broken images
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling!.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className={`w-full h-full flex items-center justify-center text-gray-500 text-xs p-2 text-center ${
                    isImage ? 'hidden' : 'flex'
                  }`}
                >
                  {file.metadata?.mimetype?.split('/')[1]?.toUpperCase() || 'ARCHIVO'}
                </div>
              </div>

              {/* File Info */}
              <div className="p-2 bg-white">
                <p className="text-xs font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(file.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {files.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No se encontraron archivos en este bucket
        </div>
      )}
    </div>
  );
}