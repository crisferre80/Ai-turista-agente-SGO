'use client';

import { useState } from 'react';
import { Camera, Download, Printer, QrCode, Image as ImageIcon } from 'lucide-react';
import { generateAttractionQRCode, downloadQRCode, printQRCode, type QRCodeOptions } from '@/lib/qr-code-generator';
import type { TrackableImage } from './ARPageClient/ARImageTracking';

interface QRCodeManagerProps {
  attractionId: string;
  attractionName: string;
  baseUrl: string;
  onImagesGenerated?: (images: TrackableImage[]) => void;
}

/**
 * Componente para gestionar códigos QR y marcadores AR
 * Permite generar, previsualizar y descargar QR codes para atractivos turísticos
 */
export default function QRCodeManager({
  attractionId,
  attractionName,
  baseUrl,
  onImagesGenerated
}: QRCodeManagerProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [physicalWidth, setPhysicalWidth] = useState(0.08); // 8 cm por defecto
  
  // Opciones de personalización
  const [qrOptions, setQrOptions] = useState<Partial<QRCodeOptions>>({
    size: 1024,
    errorCorrectionLevel: 'H',
    color: '#000000',
    backgroundColor: '#FFFFFF'
  });

  const handleGenerateQR = async () => {
    setGenerating(true);
    
    try {
      const result = await generateAttractionQRCode(
        attractionId,
        baseUrl,
        qrOptions
      );
      
      setQrDataUrl(result.dataUrl);
      setQrBlob(result.blob);
      setPhysicalWidth(result.recommendedPhysicalWidth);
      
      // Notificar las imágenes generadas
      if (onImagesGenerated) {
        const trackableImage: TrackableImage = {
          id: `qr-${attractionId}`,
          name: `QR - ${attractionName}`,
          imageUrl: result.dataUrl,
          widthInMeters: result.recommendedPhysicalWidth
        };
        
        onImagesGenerated([trackableImage]);
      }
      
    } catch (error) {
      console.error('Error generando QR:', error);
      alert('Error generando código QR. Asegúrate de tener la librería qrcode instalada.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!qrBlob) return;
    const filename = `qr-${attractionName.toLowerCase().replace(/\s+/g, '-')}.png`;
    downloadQRCode(qrBlob, filename);
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    printQRCode(
      qrDataUrl,
      attractionName,
      'Escanea este código QR con tu dispositivo móvil para iniciar la experiencia de Realidad Aumentada. Asegúrate de estar en una área con buena iluminación.'
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg">
          <QrCode className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Generador de Códigos QR
          </h3>
          <p className="text-sm text-gray-600">
            Crea marcadores AR para posicionar objetos automáticamente
          </p>
        </div>
      </div>

      {/* Opciones de personalización */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tamaño (px)
            </label>
            <select
              value={qrOptions.size}
              onChange={(e) => setQrOptions(prev => ({ ...prev, size: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value={512}>512x512 (Pantalla)</option>
              <option value={1024}>1024x1024 (Impresión)</option>
              <option value={2048}>2048x2048 (Alta calidad)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Corrección de errores
            </label>
            <select
              value={qrOptions.errorCorrectionLevel}
              onChange={(e) => setQrOptions(prev => ({ ...prev, errorCorrectionLevel: e.target.value as 'L' | 'M' | 'Q' | 'H' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="L">Baja (7%)</option>
              <option value="M">Media (15%)</option>
              <option value="Q">Alta (25%)</option>
              <option value="H">Muy alta (30%)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color QR
            </label>
            <input
              type="color"
              value={qrOptions.color}
              onChange={(e) => setQrOptions(prev => ({ ...prev, color: e.target.value }))}
              className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color fondo
            </label>
            <input
              type="color"
              value={qrOptions.backgroundColor}
              onChange={(e) => setQrOptions(prev => ({ ...prev, backgroundColor: e.target.value }))}
              className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Botón de generación */}
      <button
        onClick={handleGenerateQR}
        disabled={generating}
        className="w-full mb-6 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        {generating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Generando...
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            Generar Código QR
          </>
        )}
      </button>

      {/* Previsualización */}
      {qrDataUrl && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={qrDataUrl} 
                alt="QR Code" 
                width={256}
                height={256}
                className="w-64 h-64 border-2 border-gray-300 rounded-lg bg-white p-2"
              />
              
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-gray-700">
                  Tamaño físico recomendado
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {(physicalWidth * 100).toFixed(1)} cm
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Para detección óptima en AR
                </p>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </div>

          {/* Instrucciones de uso */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              📋 Instrucciones de uso
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Imprime el código QR en papel de buena calidad</li>
              <li>Colócalo en una ubicación visible y bien iluminada</li>
              <li>Asegúrate de que el tamaño físico sea aproximadamente {(physicalWidth * 100).toFixed(1)} cm</li>
              <li>Los usuarios podrán escanearlo para activar la experiencia AR automáticamente</li>
            </ol>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Sobre los marcadores AR
        </h4>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            • Los códigos QR permiten posicionar objetos AR automáticamente sin necesidad de tocar la pantalla
          </p>
          <p>
            • Funciona mejor con buena iluminación y superficies planas
          </p>
          <p>
            • Compatible con Android Chrome 88+ e iOS Safari 15+
          </p>
          <p>
            • Cada QR es único para este atractivo turístico
          </p>
        </div>
      </div>
    </div>
  );
}
