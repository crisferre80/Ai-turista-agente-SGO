/**
 * QR Code Generator Utility
 * 
 * Genera códigos QR que pueden ser usados como marcadores AR para posicionar
 * objetos 3D en posiciones específicas del mundo real.
 * 
 * Casos de uso:
 * - Generar QR codes únicos por atractivo turístico
 * - Crear marcadores para ubicaciones específicas
 * - Activar experiencias AR escaneando códigos físicos
 */

export interface QRCodeOptions {
  /**
   * Datos a codificar en el QR (ID del atractivo, URL, JSON, etc.)
   */
  data: string;
  
  /**
   * Tamaño de la imagen en píxeles (ancho = alto)
   * @default 512
   */
  size?: number;
  
  /**
   * Nivel de corrección de errores
   * L = ~7%, M = ~15%, Q = ~25%, H = ~30%
   * @default 'M'
   */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  
  /**
   * Color del QR code
   * @default '#000000'
   */
  color?: string;
  
  /**
   * Color del fondo
   * @default '#FFFFFF'
   */
  backgroundColor?: string;
  
  /**
   * Margen alrededor del QR en módulos
   * @default 4
   */
  margin?: number;
  
  /**
   * Incluir logo central (URL de imagen)
   */
  logo?: string;
  
  /**
   * Tamaño del logo como porcentaje del QR
   * @default 0.2 (20%)
   */
  logoSize?: number;
}

export interface QRCodeResult {
  /**
   * Data URL de la imagen generada (formato PNG)
   */
  dataUrl: string;
  
  /**
   * Blob de la imagen para descarga
   */
  blob: Blob;
  
  /**
   * Ancho físico recomendado en metros para detección óptima
   * (basado en el tamaño de impresión)
   */
  recommendedPhysicalWidth: number;
}

/**
 * Genera un código QR usando la API de QRCode.js o similar
 * 
 * @param options - Opciones de generación
 * @returns Promesa con el resultado del QR generado
 */
export async function generateQRCode(options: QRCodeOptions): Promise<QRCodeResult> {
  const {
    data,
    size = 512,
    errorCorrectionLevel = 'M',
    color = '#000000',
    backgroundColor = '#FFFFFF',
    margin = 4,
    logo,
    logoSize = 0.2
  } = options;

  // Crear canvas para dibujar el QR
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('No se pudo obtener contexto 2D del canvas');
  }

  // Nota: Aquí usarías una librería como qrcode o qr-code-styling
  // Para esta implementación, asumimos que la librería está disponible
  
  try {
    // Importar dinámicamente la librería QRCode
    const QRCodeLib = await import('qrcode');
    
    // Generar el QR code en el canvas
    await QRCodeLib.toCanvas(canvas, data, {
      width: size,
      margin,
      color: {
        dark: color,
        light: backgroundColor
      },
      errorCorrectionLevel
    });
    
    // Si hay logo, agregarlo al centro
    if (logo) {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = logo;
      });
      
      const logoSizePx = size * logoSize;
      const logoX = (size - logoSizePx) / 2;
      const logoY = (size - logoSizePx) / 2;
      
      // Fondo blanco para el logo
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(logoX - 5, logoY - 5, logoSizePx + 10, logoSizePx + 10);
      
      // Dibujar logo
      ctx.drawImage(logoImg, logoX, logoY, logoSizePx, logoSizePx);
    }
    
    // Convertir a blob y data URL
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Error generando blob'));
      }, 'image/png');
    });
    
    const dataUrl = canvas.toDataURL('image/png');
    
    // Calcular ancho físico recomendado
    // Para QR codes, se recomienda entre 5-10 cm para detección óptima
    const recommendedPhysicalWidth = 0.08; // 8 cm en metros
    
    return {
      dataUrl,
      blob,
      recommendedPhysicalWidth
    };
    
  } catch (error) {
    console.error('Error generando QR code:', error);
    throw error;
  }
}

/**
 * Genera un QR code para un atractivo turístico específico
 * 
 * @param attractionId - ID del atractivo
 * @param baseUrl - URL base de la app (ej: 'https://tuapp.com')
 * @returns Promesa con el QR generado
 */
export async function generateAttractionQRCode(
  attractionId: string,
  baseUrl: string,
  options?: Partial<QRCodeOptions>
): Promise<QRCodeResult> {
  // Construir URL de activación AR
  const activationUrl = `${baseUrl}/ar/${attractionId}?source=qr`;
  
  // También podemos codificar datos estructurados en JSON
  const qrData = JSON.stringify({
    type: 'attraction_ar',
    id: attractionId,
    url: activationUrl,
    timestamp: Date.now()
  });
  
  return generateQRCode({
    data: qrData,
    size: 1024, // Alta resolución para impresión
    errorCorrectionLevel: 'H', // Alta corrección para QR con logo
    ...options
  });
}

/**
 * Descarga un QR code como archivo PNG
 * 
 * @param blob - Blob de la imagen
 * @param filename - Nombre del archivo
 */
export function downloadQRCode(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sube un QR code a Supabase Storage
 * 
 * @param blob - Blob de la imagen
 * @param path - Ruta en el storage (ej: 'qr-codes/attraction-123.png')
 * @param supabase - Cliente de Supabase
 * @returns URL pública del QR subido
 */
export async function uploadQRCodeToStorage(
  blob: Blob,
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string> {
  const { error } = await supabase.storage
    .from('ar-markers')
    .upload(path, blob, {
      contentType: 'image/png',
      upsert: true
    });
  
  if (error) {
    throw new Error(`Error subiendo QR: ${error.message}`);
  }
  
  // Obtener URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('ar-markers')
    .getPublicUrl(path);
  
  return publicUrl;
}

/**
 * Genera e imprime un QR code con instrucciones
 * 
 * @param qrDataUrl - Data URL del QR code
 * @param title - Título del atractivo
 * @param instructions - Instrucciones de uso
 */
export function printQRCode(
  qrDataUrl: string,
  title: string,
  instructions?: string
): void {
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Por favor permite ventanas emergentes para imprimir');
    return;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>QR Code - ${title}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { margin: 0; }
          }
          
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
          }
          
          h1 {
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
          }
          
          img {
            width: 400px;
            height: 400px;
            border: 2px solid #333;
            padding: 10px;
            background: white;
          }
          
          .instructions {
            margin-top: 20px;
            max-width: 600px;
            text-align: center;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <img src="${qrDataUrl}" alt="QR Code">
        ${instructions ? `<div class="instructions">${instructions}</div>` : ''}
        <div class="footer">
          Escanea este código QR con tu dispositivo móvil para activar la experiencia de Realidad Aumentada
        </div>
      </body>
    </html>
  `);
  
  printWindow.document.close();
  
  // Esperar a que la imagen cargue antes de imprimir
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}
