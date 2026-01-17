"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { takePhoto } from '@/lib/photoService';

const COLOR_GOLD = '#F1C40F';
const COLOR_BLUE = '#1A3A6C';
const COLOR_DARK = '#0e1f1d';

interface UserReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attractionId?: string;
  businessId?: string;
  locationName: string;
}

export default function UserReviewModal({ 
  isOpen, 
  onClose, 
  attractionId, 
  businessId, 
  locationName 
}: UserReviewModalProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleTakePhoto = async () => {
    try {
      const photo = await takePhoto();
      if (photo) {
        const file = new File(
          [photo.blob], 
          `review-${Date.now()}.${photo.format}`, 
          { type: `image/${photo.format}` }
        );
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
      }
    } catch (err) {
      console.error('Error tomando foto:', err);
      setError('No se pudo acceder a la cámara');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressed);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8
          );
        };
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Debes iniciar sesión para dejar una reseña');
        setLoading(false);
        return;
      }

      if (!photoFile) {
        setError('Debes agregar una foto');
        setLoading(false);
        return;
      }

      // Comprimir imagen
      const compressedPhoto = await compressImage(photoFile);

      // Subir foto a Supabase Storage
      const fileExt = compressedPhoto.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `user-reviews/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, compressedPhoto);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      // Insertar reseña en la base de datos
      const { error: insertError } = await supabase
        .from('user_reviews')
        .insert({
          user_id: user.id,
          attraction_id: attractionId,
          business_id: businessId,
          photo_url: publicUrl,
          review_text: reviewText,
          rating: rating,
          location_name: locationName,
          is_public: true
        });

      if (insertError) throw insertError;

      // Limpiar y cerrar
      setPhotoFile(null);
      setPhotoPreview(null);
      setReviewText('');
      setRating(5);
      onClose();
      
      alert('¡Reseña publicada con éxito! 🎉');
    } catch (err: unknown) {
      console.error('Error al publicar reseña:', err);
      setError('Error al publicar: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
      backdropFilter: 'blur(8px)'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '32px',
          padding: '40px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: `0 25px 70px rgba(0,0,0,0.4)`,
          border: `2px solid ${COLOR_GOLD}33`
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.8rem',
            fontWeight: '950',
            color: COLOR_BLUE,
            letterSpacing: '-0.5px'
          }}>📸 Tu Experiencia</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '2rem',
              cursor: 'pointer',
              color: '#666',
              lineHeight: 1,
              padding: '0 10px'
            }}
          >×</button>
        </div>

        <p style={{
          margin: '0 0 25px 0',
          fontSize: '1rem',
          color: '#64748b',
          fontWeight: '500'
        }}>
          Compartí tu visita a <strong style={{ color: COLOR_BLUE }}>{locationName}</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Foto */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontWeight: 'bold',
              fontSize: '15px',
              color: COLOR_BLUE
            }}>Tu Foto</label>
            
            {photoPreview ? (
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                <Image
                  src={photoPreview}
                  alt="Preview"
                  width={500}
                  height={300}
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '20px',
                    boxShadow: `0 10px 30px ${COLOR_GOLD}44`
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(239,68,68,0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                  }}
                >×</button>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  style={{
                    flex: 1,
                    minWidth: '150px',
                    background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`,
                    color: COLOR_DARK,
                    border: 'none',
                    padding: '16px 24px',
                    borderRadius: '50px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '16px',
                    boxShadow: `0 10px 30px ${COLOR_GOLD}44`,
                    transition: 'all 0.2s ease'
                  }}
                >
                  📷 Abrir Cámara
                </button>
                <label style={{
                  flex: 1,
                  minWidth: '150px',
                  background: 'white',
                  color: COLOR_BLUE,
                  border: `2px solid ${COLOR_BLUE}33`,
                  padding: '16px 24px',
                  borderRadius: '50px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '16px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  display: 'block'
                }}>
                  📁 Elegir Archivo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Calificación */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontWeight: 'bold',
              fontSize: '15px',
              color: COLOR_BLUE
            }}>Tu Calificación</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '2.5rem',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    filter: star <= rating ? 'none' : 'grayscale(100%)',
                    opacity: star <= rating ? 1 : 0.3
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          {/* Reseña */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontWeight: 'bold',
              fontSize: '15px',
              color: COLOR_BLUE
            }}>¿Qué te pareció?</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Contanos tu experiencia..."
              rows={4}
              style={{
                width: '100%',
                padding: '16px 22px',
                borderRadius: '24px',
                border: '2px solid #e2e8f0',
                outline: 'none',
                fontSize: '16px',
                fontFamily: 'inherit',
                fontWeight: '500',
                resize: 'vertical'
              }}
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#fee',
              color: '#c00',
              padding: '12px 20px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !photoFile}
            style={{
              background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #e8b90f 100%)`,
              color: COLOR_DARK,
              border: 'none',
              padding: '18px',
              borderRadius: '50px',
              fontWeight: 'bold',
              cursor: loading || !photoFile ? 'not-allowed' : 'pointer',
              fontSize: '17px',
              boxShadow: `0 10px 30px ${COLOR_GOLD}44`,
              opacity: loading || !photoFile ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Publicando...' : '🚀 Publicar Mi Experiencia'}
          </button>
        </form>
      </div>
    </div>
  );
}
