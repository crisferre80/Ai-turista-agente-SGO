"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import UserAvatar from './UserAvatar';

const COLOR_GOLD = "#F1C40F";
const COLOR_WHITE = "#FFFFFF";

export default function Header() {
  const [pwaAvailable, setPwaAvailable] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    type PwaDetail = { available?: boolean; installed?: boolean; showIosHint?: boolean };
    type SantIAPwaPromptResult = { outcome: 'accepted' | 'dismissed'; platform?: string };
    type SantIAPwaApi = { isAvailable?: () => boolean; isInstalled?: () => boolean; prompt?: () => Promise<SantIAPwaPromptResult | null>; closeIosHint?: () => void };

    const win = window as unknown as { __santIA_pwa?: SantIAPwaApi };
    const api = win.__santIA_pwa;
    if (api) {
      setTimeout(() => {
        setPwaAvailable(!!api.isAvailable?.());
        setPwaInstalled(!!api.isInstalled?.());
      }, 0);
    }

    const handler = (e: Event) => {
      const custom = e as CustomEvent<PwaDetail>;
      const detail = custom?.detail || {};
      setTimeout(() => {
        setPwaAvailable(!!detail.available);
        setPwaInstalled(!!detail.installed);
      }, 0);
    };

    window.addEventListener('santIA-pwa', handler as EventListener);

    // Check user authentication
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      window.removeEventListener('santIA-pwa', handler as EventListener);
      subscription.unsubscribe();
    };
  }, []);

  const handleInstallClick = async () => {
    type SantIAPwaPromptResult = { outcome: 'accepted' | 'dismissed'; platform?: string };
    const win = window as unknown as { __santIA_pwa?: { prompt?: () => Promise<SantIAPwaPromptResult | null> } };
    const api = win.__santIA_pwa;
    if (api && api.prompt) {
      await api.prompt();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      background: '#0e1f1d',
      borderBottom: `1px solid ${COLOR_GOLD}33`,
      zIndex: 5000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 15, textDecoration: 'none' }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          boxShadow: `0 4px 12px ${COLOR_GOLD}44`,
          border: `2px solid ${COLOR_WHITE}`
        }}>
          <Image
            src="/santi-avatar.png"
            alt="Santi"
            width={42}
            height={42}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.05) translateY(1px)' }}
          />
        </div>
        <div style={{ 
          color: COLOR_WHITE, 
          fontWeight: 900, 
          fontSize: '1.1rem',
          letterSpacing: 0.5 
        }}>
          Santi IA
        </div>
      </Link>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/explorar" style={{ 
          color: COLOR_WHITE, 
          textDecoration: 'none', 
          fontWeight: 600,
          transition: 'color 0.2s'
        }}>
          Explorar
        </Link>
        {user ? (
          <UserAvatar size={32} showName={false} />
        ) : (
          <Link href="/login" style={{ 
            color: '#0e1f1d', 
            background: COLOR_GOLD, 
            padding: '10px 20px', 
            borderRadius: 8, 
            fontWeight: 800, 
            textDecoration: 'none',
            boxShadow: `0 4px 15px ${COLOR_GOLD}44`,
            transition: 'transform 0.2s'
          }}>
            Acreditación
          </Link>
        )}
        {pwaAvailable && !pwaInstalled && (
          <button onClick={handleInstallClick} style={{ 
            background: '#fff', 
            color: '#0e1f1d', 
            padding: '8px 12px', 
            borderRadius: 8, 
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer'
          }}>
            Instalar
          </button>
        )}
      </nav>
    </div>
  );
}
