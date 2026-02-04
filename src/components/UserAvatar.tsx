"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  name: string | null;
  avatar_url: string | null;
}

interface UserAvatarProps {
  size?: number;
  showName?: boolean;
  className?: string;
}

export default function UserAvatar({ size = 32, showName = false, className = '' }: UserAvatarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          // Obtener perfil
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', user.id)
            .single();

          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData();
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.4,
          color: '#9ca3af',
          flexShrink: 0
        }}
      >
        ⏳
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          color: '#2563eb',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            background: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.4,
            color: '#9ca3af',
            flexShrink: 0
          }}
        >
          👤
        </div>
        {showName && <span>Ingresar</span>}
      </Link>
    );
  }

  const displayName = profile?.name || user.email?.split('@')[0] || 'Usuario';
  const avatarUrl = profile?.avatar_url;

  return (
    <Link
      href="/profile"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
        color: 'inherit',
        flexShrink: 0
      }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={size}
          height={size}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #e5e7eb',
            flexShrink: 0
          }}
        />
      ) : (
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            background: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.4,
            fontWeight: 'bold',
            color: '#374151',
            border: '2px solid #e5e7eb',
            flexShrink: 0
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      {showName && (
        <span style={{
          fontSize: '14px',
          fontWeight: '500',
          color: '#374151'
        }}>
          {displayName}
        </span>
      )}
    </Link>
  );
}