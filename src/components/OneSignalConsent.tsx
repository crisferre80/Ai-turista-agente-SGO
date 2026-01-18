"use client";
import React, { useEffect, useState } from 'react';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load script: ' + src));
    document.head.appendChild(s);
  });
}

export default function OneSignalConsent() {
  const [status, setStatus] = useState<'unknown' | 'granted' | 'dismissed' | 'loading' | 'ready'>('unknown');

  const loadAndInit = async () => {
    // Avoid initializing OneSignal in development unless explicitly enabled for testing
    const enableInDev = Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_ENABLE_IN_DEV);
    if (process.env.NODE_ENV !== 'production' && !enableInDev) {
      console.warn('Skipping OneSignal init in non-production environment (set NEXT_PUBLIC_ONESIGNAL_ENABLE_IN_DEV to enable).');
      setStatus('dismissed');
      return;
    }

    if (!APP_ID) {
      console.warn('OneSignal App ID is not set. Skipping init.');
      setStatus('dismissed');
      return;
    }

    try {
      await loadScript('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');

      type OneSignalAPI = { init: (opts: { appId: string }) => Promise<void>; showNativePrompt?: () => void };

      const win = (window as unknown) as Window & { OneSignal?: OneSignalAPI; OneSignalDeferred?: Array<(s: OneSignalAPI) => void> };

      if (win.OneSignal && typeof win.OneSignal.init === 'function') {
        await win.OneSignal.init({ appId: APP_ID });
        try { win.OneSignal.showNativePrompt?.(); } catch { /* ignore */ }
      } else {
        win.OneSignalDeferred = win.OneSignalDeferred || [];
        win.OneSignalDeferred.push((OneSignal: OneSignalAPI) => {
          void OneSignal.init({ appId: APP_ID }).then(() => {
            try { OneSignal.showNativePrompt?.(); } catch { /* ignore */ }
          }).catch(() => {/* ignore */});
        });
      }

      setStatus('ready');
    } catch (err) {
      console.error('Failed to load/initialize OneSignal', err);
      setStatus('dismissed');
    }
  };

  useEffect(() => {
    const existing = localStorage.getItem('onesignal-consent');
    if (existing === 'granted') {
      const t = setTimeout(() => { setStatus('loading'); void loadAndInit(); }, 0);
      return () => clearTimeout(t);
    } else if (existing === 'dismissed') {
      const t = setTimeout(() => setStatus('dismissed'), 0);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('onesignal-consent', 'granted');
    setStatus('loading');
    void loadAndInit();
  };

  const decline = () => {
    localStorage.setItem('onesignal-consent', 'dismissed');
    setStatus('dismissed');
  };

  // Don't render if consent already accepted/loading/ready or explicitly dismissed
  if (status === 'granted' || status === 'loading' || status === 'ready' || status === 'dismissed') return null;

  return (
    <div style={{
      position: 'fixed',
      right: 20,
      bottom: 20,
      background: 'white',
      padding: '12px 16px',
      boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
      borderRadius: 12,
      zIndex: 9999,
      maxWidth: 340
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>¿Recibir notificaciones?</div>
      <div style={{ fontSize: 13, color: '#333', marginBottom: 12 }}>Activa notificaciones push para recibir novedades y alertas oportunas.</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={decline} style={{ background: 'transparent', border: '1px solid #ccc', borderRadius: 8, padding: '6px 10px' }}>No, gracias</button>
        <button onClick={accept} style={{ background: '#1A3A6C', color: 'white', border: 'none', borderRadius: 8, padding: '6px 10px' }}>Activar</button>
      </div>
    </div>
  );
}
