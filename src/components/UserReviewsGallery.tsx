"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import UserReviewModal from './UserReviewModal';

const COLOR_GOLD = '#F1C40F';
const COLOR_BLUE = '#1A3A6C';

interface UserReview {
  id: string;
  photo_url: string;
  review_text: string;
  rating: number;
  location_name: string;
  created_at: string;
  profiles?: {
    name: string;
    avatar_url?: string;
  };
}

export default function UserReviewsGallery({ placeId, isBusiness }: { placeId?: string; isBusiness?: boolean } = {}) {
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [placeId, isBusiness]);

  const fetchReviews = async () => {
    try {
      let query = supabase.from('user_reviews').select(`
          *,
          profiles(name, avatar_url)
        `).eq('is_public', true).order('created_at', { ascending: false }).limit(20);

      if (placeId) {
        if (isBusiness) query = query.eq('business_id', placeId);
        else query = query.eq('attraction_id', placeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error de Supabase:', error.message, error.details, error.hint);
        throw error;
      }
      setReviews(data || []);
    } catch (err) {
      console.error('Error cargando reseñas:', err instanceof Error ? err.message : String(err));
      // Silently fail - table might not exist yet
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: COLOR_BLUE,
        fontWeight: 'bold',
        fontSize: '18px'
      }}>
        Cargando experiencias...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
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
          Todavía no hay experiencias compartidas. ¡Sé el primero!
        </p>
        {placeId && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowModal(true)} style={{ padding: '10px 14px', borderRadius: 10, background: '#1A3A6C', color: 'white', border: 'none' }}>Escribir reseña</button>
          </div>
        )}
        {showModal && (
          <UserReviewModal isOpen={true} onClose={() => { setShowModal(false); fetchReviews(); }} attractionId={!isBusiness ? placeId : undefined} businessId={isBusiness ? placeId : undefined} locationName={reviews[0]?.location_name || ''} />
        )}
      </div>
    );
  }

  return (
    <>
      {/* Botón para agregar reseña */}
      {placeId && (
        <div style={{
          textAlign: 'center',
          marginBottom: '30px',
          padding: '20px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
          borderRadius: '16px',
          border: `2px solid ${COLOR_GOLD}44`
        }}>
          <p style={{
            color: COLOR_BLUE,
            fontSize: '1.1rem',
            fontWeight: '600',
            marginBottom: '15px'
          }}>
            💬 ¿Ya visitaste este lugar? ¡Comparte tu experiencia!
          </p>
          <button 
            onClick={() => setShowModal(true)} 
            style={{ 
              padding: '12px 24px', 
              borderRadius: '12px', 
              background: COLOR_BLUE, 
              color: 'white', 
              border: 'none',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(26, 58, 108, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0f2952';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(26, 58, 108, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = COLOR_BLUE;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 58, 108, 0.3)';
            }}
          >
            ✨ Dejar mi Reseña
          </button>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '25px',
        padding: '20px 0'
      }}>
        {reviews.map((review) => (
        <div
          key={review.id}
          className="user-review-card"
          style={{
            background: 'white',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            border: `2px solid ${COLOR_GOLD}22`,
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
        >
          {/* Imagen */}
          <div style={{ position: 'relative', paddingTop: '75%', overflow: 'hidden' }}>
            <Image
              src={review.photo_url}
              alt={review.location_name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              style={{ objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: COLOR_GOLD,
              color: COLOR_BLUE,
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⭐ {review.rating}
            </div>
          </div>

          {/* Contenido */}
          <div style={{ padding: '20px' }}>
            <h4 style={{
              margin: '0 0 10px 0',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: COLOR_BLUE
            }}>
              📍 {review.location_name}
            </h4>
            
            <p style={{
              margin: '0 0 15px 0',
              fontSize: '0.9rem',
              color: '#64748b',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              &ldquo;{review.review_text}&rdquo;
            </p>

            {/* Usuario */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingTop: '15px',
              borderTop: `2px solid ${COLOR_GOLD}22`
            }}>
              {review.profiles?.avatar_url ? (
                <Image
                  src={review.profiles.avatar_url}
                  alt={review.profiles.name || 'Usuario'}
                  width={32}
                  height={32}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: `2px solid ${COLOR_GOLD}`,
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              ) : (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: COLOR_GOLD,
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 'bold',
                  color: COLOR_BLUE
                }}>
                  {review.profiles?.name?.charAt(0) || '?'}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: COLOR_BLUE
                }}>
                  {review.profiles?.name || 'Usuario'}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8'
                }}>
                  {new Date(review.created_at).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Modal de creación de reseña */}
      {showModal && placeId && (
        <UserReviewModal 
          isOpen={true} 
          onClose={() => { 
            setShowModal(false); 
            fetchReviews(); 
          }} 
          attractionId={!isBusiness ? placeId : undefined} 
          businessId={isBusiness ? placeId : undefined} 
          locationName={reviews[0]?.location_name || ''} 
        />
      )}
    </div>

      <style jsx>{`
        .user-review-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.2);
          border-color: ${COLOR_GOLD};
        }
      `}</style>
    </>
  );
}
