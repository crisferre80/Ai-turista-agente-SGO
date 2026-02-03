"use client";
import React, { useEffect, useState } from 'react';

// Lightweight typing for the beforeinstallprompt event (not in lib.dom yet)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
  platforms?: string[];
  preventDefault: () => void;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type SantIAPwaApi = {
  isAvailable?: () => boolean;
  isInstalled?: () => boolean;
  showIosHint?: () => boolean;
  prompt?: () => Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string } | null>;
  closeIosHint?: () => void;
};

const PwaInstall: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const bHandler = (e: Event) => {
      const ev = e as BeforeInstallPromptEvent;
      ev.preventDefault();
      setDeferredPrompt(ev);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Use EventListener typing to satisfy DOM overloads
    window.addEventListener('beforeinstallprompt', bHandler as EventListener);
    window.addEventListener('appinstalled', installedHandler as EventListener);

    // If we're in development, unregister any previously registered app SW to avoid intercepting dev asset requests
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then(async (regs) => {
        await Promise.all(regs.map(async (r) => {
          const scriptUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL;
          if (scriptUrl && (scriptUrl.includes('/sw.js') || scriptUrl.includes('OneSignalSDKWorker.js') || scriptUrl.includes('OneSignalSDKUpdaterWorker.js'))) {
            try { await r.unregister(); console.log('Unregistered dev service worker:', scriptUrl); } catch { /* ignore */ }
          }
        }));
        // Also clear the offline cache used by the SW to prevent stale resources
        try { await caches.delete('sant-ia-cache-v1'); } catch {}
      }).catch(() => {});
    }

    // Register service worker only in production to avoid conflicts with the dev server/HMR
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then(() => {
        // console.log('SW registered');
      }).catch((err) => {
        console.warn('SW registration failed', err);
      });
    } else {
      // Skipping SW registration in development to prevent fetch interception errors
    }

    // Detect iOS and show hint if not installed
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as NavigatorWithStandalone).standalone === true;
    if (isIos && !isInStandalone) {
      // Defer setState to avoid synchronous state updates within the effect
      setTimeout(() => setShowIosHint(true), 0);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', bHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const onCloseHint = () => {
    setShowIosHint(false);
  };

  // Toast visibility & dismissed tracker to ensure only once per page load
  const [showToast, setShowToast] = useState(false);

  // Expose a lightweight global API for header/button integration and dispatch events
  useEffect(() => {
    const api = {
      isAvailable: () => !!deferredPrompt,
      isInstalled: () => isInstalled,
      showIosHint: () => showIosHint,
      prompt: async () => {
        if (!deferredPrompt) return null;
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        // Notify listeners
        window.dispatchEvent(new CustomEvent('santIA-pwa', { detail: { available: false, installed: isInstalled, showIosHint } }));
        return choice;
      },
      closeIosHint: () => setShowIosHint(false)
    };

    (window as unknown as { __santIA_pwa?: SantIAPwaApi }).__santIA_pwa = api;

    // Dispatch initial state
    window.dispatchEvent(new CustomEvent('santIA-pwa', { detail: { available: !!deferredPrompt, installed: isInstalled, showIosHint } }));

    return () => {
      try { delete (window as unknown as { __santIA_pwa?: SantIAPwaApi }).__santIA_pwa; } catch {}
    };
  }, [deferredPrompt, isInstalled, showIosHint]);

  // Show a one-time toast when install is available and app is not installed
  useEffect(() => {
    if (deferredPrompt && !isInstalled && sessionStorage.getItem('pwaInstallDismissed') !== 'true') {
      // Show the toast shortly after availability to avoid jank
      const t = setTimeout(() => setShowToast(true), 400);
      return () => clearTimeout(t);
    }
  }, [deferredPrompt, isInstalled]);

  const handleToastInstall = async () => {
    const win = window as unknown as { __santIA_pwa?: SantIAPwaApi };
    const api = win.__santIA_pwa;
    setShowToast(false);
    sessionStorage.setItem('pwaInstallDismissed', 'true');
    if (api && api.prompt) {
      await api.prompt();
    }
  };

  const handleToastLater = () => {
    setShowToast(false);
    sessionStorage.setItem('pwaInstallDismissed', 'true');
  };

  // Keep iOS hint UI (but no floating install button) — header will render the install button
  if (isInstalled) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    right: 18,
    bottom: 80,
    zIndex: 9999,
    boxShadow: '0 6px 18px rgba(0,0,0,0.18)'
  };

  const toastStyle: React.CSSProperties = {
    position: 'fixed',
    right: 18,
    top: 80, // below header (header height ~70)
    zIndex: 6000,
    background: '#0e1f1d',
    color: '#fff',
    padding: '12px 14px',
    borderRadius: 10,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
  };

  const installBtnStyle: React.CSSProperties = { background: '#fff', color: '#0e1f1d', border: 'none', padding: '8px 12px', borderRadius: 8, fontWeight: 800, cursor: 'pointer' };
  const laterBtnStyle: React.CSSProperties = { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' };

  return (
    <div>
      {showToast && (
        <div style={toastStyle} role="dialog" aria-live="polite" aria-label="Instalar SantIA">
          <div style={{ fontSize: 14, fontWeight: 700 }}>Instalar SantIA</div>
          <div style={{ fontSize: 13, color: '#cfe6ff', opacity: 0.95 }}>Instálala para usarla como una app en tu dispositivo.</div>
          <div style={{ marginLeft: 8, display: 'flex', gap: 8 }}>
            <button onClick={handleToastInstall} style={installBtnStyle} aria-label="Instalar">Instalar</button>
            <button onClick={handleToastLater} style={laterBtnStyle} aria-label="En otro momento">En otro momento</button>
          </div>
        </div>
      )}

      {showIosHint && (
        <div style={{ ...containerStyle, width: 260, background: '#fff', padding: 12, borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: '#222', marginBottom: 8, fontWeight: 700 }}>Instalar SantIA</div>
          <div style={{ fontSize: 12, color: '#444', marginBottom: 8 }}>En iOS, toca <strong>Compartir → Añadir a pantalla de inicio</strong>.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCloseHint} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #eee', background: '#fff', cursor: 'pointer' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PwaInstall;
