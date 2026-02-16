'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Upload, QrCode, Download, Printer, Image as ImageIcon, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateQRCode, downloadQRCode, printQRCode, type QRCodeOptions } from '@/lib/qr-code-generator';

interface ImageQRUploaderProps {
  attractionId: string;
  attractionName: string;
  onQRGenerated?: (qrUrl: string, imageUrl: string, physicalWidth: number) => void;
}

/**
 * Componente para subir imagen de referencia y generar QR que la vincule
 * Flujo: Subir imagen → Generar QR → Imprimir → Escanear con cámara → Anclar objeto 3D
 */
export default function ImageQRUploader({
  attractionId,
  attractionName,
  onQRGenerated
}: ImageQRUploaderProps) {
  // Cargar valores existentes desde la tabla `attractions`
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('attractions')
          .select('reference_image_url, qr_code_url, qr_physical_width')
          .eq('id', attractionId)
          .single();

        if (error) {
          console.warn('No se pudo cargar datos existentes del atractivo:', error.message || error);
          return;
        }

        if (!mounted) return;
        if (data?.reference_image_url) setReferenceImageUrl(data.reference_image_url);
        if (data?.qr_code_url) setQrDataUrl(data.qr_code_url);
        if (data?.qr_physical_width) setPhysicalWidth(parseFloat(String(data.qr_physical_width)));
      } catch (err) {
        console.error('Error cargando datos de atractivo para QR:', err);
      }
    })();

    return () => { mounted = false; };
  }, [attractionId]);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [physicalWidth, setPhysicalWidth] = useState(0.15); // 15cm por defecto para imágenes
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida (JPG, PNG, etc.)');
      return;
    }

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen debe ser menor a 5MB');
      return;
    }

    setReferenceImage(file);
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setReferenceImageUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const bucketName = process.env.NEXT_PUBLIC_AR_ASSETS_BUCKET || 'ar-assets';
    const fileName = `reference-images/${attractionId}/${Date.now()}-${file.name}`;

    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: publicData } = await supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

      return publicData.publicUrl;
    } catch (err: unknown) {
      // Manejo específico cuando el bucket no existe
      const msg = (err instanceof Error ? err.message : String(err)) || String(err);
      console.error('Error subiendo imagen a Storage:', err);
      if (msg.includes('Bucket not found') || msg.includes("bucket") && msg.includes('not found')) {
        throw new Error(
          `Bucket '${bucketName}' no encontrado en Supabase Storage. Crea el bucket desde Supabase Dashboard -> Storage -> Create bucket con ese nombre, o define NEXT_PUBLIC_AR_ASSETS_BUCKET en .env.local apuntando a un bucket existente.`
        );
      }

      throw err;
    }
  };

  const handleGenerateQR = async () => {
    if (!referenceImage) {
      alert('Primero selecciona una imagen de referencia');
      return;
    }

    setUploading(true);
    setGenerating(true);

    try {
      // 1. Subir imagen a Supabase Storage
      const uploadedImageUrl = await uploadImageToStorage(referenceImage);
      console.log('✅ Imagen subida:', uploadedImageUrl);

      // 2. Crear datos para el QR (JSON con toda la info necesaria)
      const qrData = JSON.stringify({
        type: 'ar-marker',
        attractionId: attractionId,
        attractionName: attractionName,
        referenceImageUrl: uploadedImageUrl,
        physicalWidth: physicalWidth,
        timestamp: Date.now()
      });

      // 3. Generar QR code
      const qrOptions: QRCodeOptions = {
        data: qrData,
        size: 1024,
        errorCorrectionLevel: 'H', // Alta corrección de errores
        color: '#000000',
        backgroundColor: '#FFFFFF',
        margin: 2
      };

      const result = await generateQRCode(qrOptions);
      
      setQrDataUrl(result.dataUrl);
      setQrBlob(result.blob);

      // 4. Guardar QR en la base de datos
      const { error: updateError } = await supabase
        .from('attractions')
        .update({
          qr_code_url: result.dataUrl,
          qr_physical_width: physicalWidth,
          reference_image_url: uploadedImageUrl
        })
        .eq('id', attractionId);

      if (updateError) {
        console.warn('Error actualizando BD:', updateError);
      }

      // 5. Notificar generación exitosa
      if (onQRGenerated) {
        onQRGenerated(result.dataUrl, uploadedImageUrl, physicalWidth);
      }

      alert('✅ QR generado exitosamente. Puedes descargarlo o imprimirlo.');

    } catch (error) {
      console.error('Error generando QR:', error);
      alert('Error generando QR: ' + (error as Error).message);
    } finally {
      setUploading(false);
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!qrBlob) return;
    const filename = `qr-marker-${attractionName.toLowerCase().replace(/\s+/g, '-')}.png`;
    downloadQRCode(qrBlob, filename);
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    printQRCode(
      qrDataUrl,
      `Marcador AR - ${attractionName}`,
      `Coloca este QR junto a la imagen de referencia. Al escanear el QR con la app, el objeto 3D se anclará automáticamente en esa ubicación. Tamaño recomendado de impresión: ${(physicalWidth * 100).toFixed(0)} cm.`
    );
  };

  const handleReset = () => {
    setReferenceImage(null);
    setReferenceImageUrl(null);
    setQrDataUrl(null);
    setQrBlob(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Paso 1: Subir imagen de referencia */}
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ImageIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              1. Imagen de Referencia
            </h3>
            <p className="text-sm text-gray-600">
              Sube la imagen que se usará como marcador AR (póster, logo, cartel, etc.)
            </p>
          </div>
        </div>

        {!referenceImageUrl ? (
          <div className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              id="reference-image-input"
            />
            <label
              htmlFor="reference-image-input"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
            >
              <Upload className="h-4 w-4" />
              Seleccionar Imagen
            </label>
            <p className="text-xs text-gray-500 mt-2">
              JPG, PNG • Máx 5MB • Recomendado: Alta calidad, buen contraste
            </p>
          </div>
        ) : (
          <div className="relative">
              <Image
                src={referenceImageUrl}
                alt="Referencia"
                width={256}
                height={256}
                style={{ width: 'auto' }}
                className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
              />
            <button
              onClick={handleReset}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              title="Eliminar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mt-4 flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Imagen cargada</span>
            </div>
          </div>
        )}

        {/* Tamaño físico */}
        {referenceImageUrl && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tamaño físico de la imagen impresa (en metros)
            </label>
            <input
              type="number"
              min="0.05"
              max="2"
              step="0.01"
              value={physicalWidth}
              onChange={(e) => setPhysicalWidth(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              ≈ {(physicalWidth * 100).toFixed(0)} cm (tamaño real cuando imprimes la imagen)
            </p>
          </div>
        )}
      </div>

      {/* Paso 2: Generar QR */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <QrCode className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              2. Generar Código QR
            </h3>
            <p className="text-sm text-gray-600">
              El QR vinculará la imagen con el objeto 3D del atractivo
            </p>
          </div>
        </div>

        {!qrDataUrl ? (
          <button
            onClick={handleGenerateQR}
            disabled={!referenceImage || uploading || generating}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {uploading
              ? 'Subiendo imagen...'
              : generating
              ? 'Generando QR...'
              : 'Generar Código QR'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 flex justify-center">
              <Image src={qrDataUrl} alt="QR Code" width={256} height={256} className="w-64 h-64" />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
            </div>

            <button
              onClick={handleReset}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Generar Nuevo QR
            </button>
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-semibold text-amber-900 mb-2">📋 Instrucciones de Uso</h4>
        <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
          <li>Imprime la <strong>imagen de referencia</strong> y colócala en la ubicación física</li>
          <li>Imprime el <strong>código QR</strong> generado y colócalo junto a la imagen</li>
          <li>Los usuarios escanean el QR con la app móvil</li>
          <li>La cámara detecta la imagen de referencia automáticamente</li>
          <li>El objeto 3D se ancla en esa posición cuando se detecta la imagen</li>
        </ol>
      </div>
    </div>
  );
}
