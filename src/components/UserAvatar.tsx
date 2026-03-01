"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserSafe } from '@/lib/supabaseAuth';
import type { User } from '@supabase/supabase-js';
import { useI18n } from '@/i18n/LanguageProvider';
import { locales, languageNames, Locale } from '@/i18n/translations';

interface UserProfile {
  name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface UserAvatarProps {
  size?: number;
  showName?: boolean;
  className?: string;
}

export default function UserAvatar({ size = 32, showName = false, className = '' }: UserAvatarProps) {
  const { locale, setLocale, t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // offline; skip attempt and leave loading as false later
          console.warn('UserAvatar: offline, skipping user fetch');
          return;
        }

        const { data: { user }, error } = await getUserSafe();
        if (error && error.message && /failed to fetch/i.test(error.message)) {
          // already logged inside helper
        }

        if (user) {
          setUser(user);
          // Obtener perfil
          const { data: profileData, error: profErr } = await supabase
            .from('profiles')
            .select('name, avatar_url, role')
            .eq('id', user.id)
            .single();

          if (profErr) {
            console.warn('Error fetching profile data:', profErr);
          }

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

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
      setShowMenu(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

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
    <div className={className} style={{ position: 'relative', flexShrink: 0 }} ref={menuRef}>
      <button
        onClick={toggleMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '8px',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
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
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            marginLeft: '4px',
            transition: 'transform 0.2s',
            transform: showMenu ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
            minWidth: '160px',
            overflow: 'hidden'
          }}
        >
          <Link
            href="/profile"
            style={{
              display: 'block',
              padding: '12px 16px',
              textDecoration: 'none',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              borderBottom: '1px solid #f3f4f6',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => setShowMenu(false)}
          >
            👤 Ver perfil
          </Link>
          {profile?.role === 'admin' && (
            <Link
              href="/admin"
              style={{
                display: 'block',
                padding: '12px 16px',
                textDecoration: 'none',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500',
                borderBottom: '1px solid #f3f4f6',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => setShowMenu(false)}
            >
              ⚙️ Panel Admin
            </Link>
          )}
          {/* language chooser */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '14px', color: '#374151', marginRight: '8px' }}>{t('language')}:</span>
            <select
              value={locale}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'auto') setLocale('auto');
                else setLocale(v as Locale);
              }}
              style={{ background: 'transparent', border: '1px solid #ccc', borderRadius: 4, padding: '2px 4px', fontSize: '14px' }}
            >
              <option value="auto" style={{ color: '#000' }}>{t('lang.auto')}</option>
              {locales.map(l => (
                <option key={l} value={l} style={{ color: '#000' }}>
                  {languageNames[l]}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#dc2626',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            🚪 Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}