'use client';

/**
 * Componente para escanear códigos QR y obtener información de atractivos turísticos
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Loader2 } from 'lucide-react';
import type { QRScannerProps } from '@/types/ar';

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementIdRef = useRef(`qr-reader-${Date.now()}`);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error al detener escáner:', err);
      }
    }
    setIsScanning(false);
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    console.log('QR detectado:', decodedText);
    
    // Detener escáner después de escaneo exitoso
    void stopScanning();
    
    // Notificar al componente padre
    onScanSuccess(decodedText);
  }, [onScanSuccess, stopScanning]);

  const requestCameraPermission = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      // Primero solicitar permisos explícitamente
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Detener el stream temporal (html5-qrcode creará uno nuevo)
      stream.getTracks().forEach(track => track.stop());
      
      // Si llegamos aquí, tenemos permisos
      setHasPermission(true);
      // No llamar initScanner aquí - se llamará en el useEffect
    } catch (err) {
      console.error('Error al solicitar permisos de cámara:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Permisos de cámara denegados. Por favor, permite el acceso a la cámara en la configuración de tu navegador.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No se encontró ninguna cámara en tu dispositivo.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('La cámara ya está en uso por otra aplicación.');
        } else {
          setError(`Error al acceder a la cámara: ${errorMessage}`);
        }
      } else {
        setError(`No se pudo acceder a la cámara: ${errorMessage}`);
      }
      
      setHasPermission(false);
      setIsInitializing(false);
      
      if (onScanError) {
        onScanError(errorMessage);
      }
    }
  }, [onScanError]);

  const initScanner = useCallback(async () => {
    try {
      // Esperar un poco para asegurar que el elemento esté en el DOM
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verificar que el elemento exista
      const element = document.getElementById(elementIdRef.current);
      if (!element) {
        throw new Error(`No se encontró el elemento con ID: ${elementIdRef.current}`);
      }
      
      setIsScanning(true);
      setError(null);

      // Crear instancia del escáner HTML5 QR Code
      const scanner = new Html5Qrcode(elementIdRef.current);
      scannerRef.current = scanner;

      // Configuración de la cámara
      const config = {
        fps: 10, // Frames por segundo
        qrbox: { width: 250, height: 250 }, // Área de escaneo
        aspectRatio: 1.0,
      };

      // Iniciar escáner con cámara trasera
      await scanner.start(
        { facingMode: 'environment' }, // Cámara trasera
        config,
        handleScanSuccess,
        // Callback de fallo por frame: no hacemos nada para evitar spam de logs
        () => {}
      );

      setIsScanning(true);
      setIsInitializing(false);
    } catch (err) {
      console.error('Error al inicializar escáner QR:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudo iniciar el escáner: ${errorMessage}`);
      setHasPermission(false);
      setIsScanning(false);
      setIsInitializing(false);
      
      if (onScanError) {
        onScanError(errorMessage);
      }
    }
  }, [handleScanSuccess, onScanError]);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      // Limpiar escáner cuando el componente se desmonta
      void stopScanning();
    };
  }, [stopScanning]);

  // Inicializar escáner cuando se otorgan permisos
  useEffect(() => {
    if (hasPermission === true && !scannerRef.current) {
      initScanner();
    }
  }, [hasPermission, initScanner]);

  const handleClose = useCallback(async () => {
    await stopScanning();
    onClose();
  }, [onClose, stopScanning]);

  if (!isMounted) {
    return null; // No renderizar en el servidor
  }

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        padding: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
            <Camera className="h-6 w-6" />
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>Escanear QR</h2>
              <p style={{ fontSize: '0.875rem', color: '#d1d5db', margin: 0 }}>
                Apunta al código QR del lugar turístico
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              color: 'white',
              background: 'transparent',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.5rem',
              cursor: 'pointer',
            }}
            aria-label="Cerrar escáner"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Área de escaneo - centrada */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        {hasPermission === null && !error && (
          <div style={{
            textAlign: 'center',
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            backdropFilter: 'blur(8px)',
            borderRadius: '1rem',
            padding: '2rem',
            border: '1px solid rgb(55, 65, 81)',
          }}>
            <Camera style={{ width: '5rem', height: '5rem', color: '#60a5fa', margin: '0 auto 1.5rem' }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.75rem' }}>
              Activar Cámara
            </h3>
            <p style={{ color: '#d1d5db', marginBottom: '2rem', fontSize: '1rem' }}>
              Necesitamos acceso a tu cámara para escanear códigos QR de lugares turísticos
            </p>
            <button
              onClick={requestCameraPermission}
              disabled={isInitializing}
              style={{
                backgroundColor: isInitializing ? '#6b7280' : '#3b82f6',
                color: 'white',
                fontWeight: '600',
                padding: '1rem 2rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: isInitializing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                margin: '0 auto',
                width: '100%',
                fontSize: '1.125rem',
                boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.5)',
              }}
            >
              {isInitializing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Iniciando cámara...</span>
                </>
              ) : (
                <>
                  <Camera className="h-6 w-6" />
                  <span>Activar Cámara</span>
                </>
              )}
            </button>
          </div>
        )}
        
        {hasPermission && !error && (
          <div style={{ width: '100%', maxWidth: '28rem' }}>
            <div id={elementIdRef.current} style={{ width: '100%' }} />
            {isScanning && (
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white' }}>
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p style={{ fontSize: '0.875rem' }}>Buscando código QR...</p>
              </div>
            )}
          </div>
        )}
        
        {/* Mensajes de error centrados */}
        {error && (
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '1rem',
            border: '1px solid rgb(248, 113, 113)',
          }}>
            <p style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '1.125rem' }}>⚠️ Error de Cámara</p>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
            {hasPermission === false && (
              <>
                <div style={{
                  fontSize: '0.75rem',
                  marginBottom: '1rem',
                  backgroundColor: 'rgba(220, 38, 38, 0.5)',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                }}>
                  <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>💡 ¿Cómo solucionarlo?</p>
                  <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', margin: 0 }}>
                    <li>Asegúrate de estar en una conexión segura (HTTPS)</li>
                    <li>Verifica los permisos de cámara en tu navegador</li>
                    <li>Cierra otras apps que puedan estar usando la cámara</li>
                    <li>Recarga la página e intenta de nuevo</li>
                  </ul>
                </div>
                <button
                  onClick={requestCameraPermission}
                  style={{
                    backgroundColor: 'white',
                    color: 'rgb(239, 68, 68)',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    width: '100%',
                    marginBottom: '0.5rem',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Reintentar
                </button>
              </>
            )}
            <button
              onClick={handleClose}
              style={{
                backgroundColor: 'rgb(220, 38, 38)',
                color: 'white',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                width: '100%',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Instrucciones flotantes */}
      {!error && hasPermission && (
        <div style={{
          position: 'relative',
          zIndex: 10,
          paddingBottom: '2rem',
          paddingLeft: '1rem',
          paddingRight: '1rem',
        }}>
          <div style={{
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.75rem',
            textAlign: 'center',
            maxWidth: '28rem',
            margin: '0 auto',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          }}>
            <p style={{ fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>
              Centra el código QR dentro del recuadro para escanearlo
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
