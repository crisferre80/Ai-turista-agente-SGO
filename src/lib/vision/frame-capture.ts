/**
 * Servicio para capturar frames de cámara (WebXR o getUserMedia)
 * para análisis de visión artificial
 */

export interface FrameCaptureOptions {
  width?: number;
  height?: number;
  quality?: number; // 0-1
}

const DEFAULT_OPTIONS: Required<FrameCaptureOptions> = {
  width: 640,
  height: 640,
  quality: 0.9,
};

/**
 * Captura frame actual desde video element
 */
export function captureFrameFromVideo(
  videoElement: HTMLVideoElement,
  options: FrameCaptureOptions = {}
): ImageData | null {
  const config = { ...DEFAULT_OPTIONS, ...options };

  if (!videoElement || videoElement.readyState < 2) {
    console.warn('Video element no está listo');
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('No se pudo obtener contexto 2D del canvas');
      return null;
    }

    // Dibujar frame del video al canvas
    ctx.drawImage(videoElement, 0, 0, config.width, config.height);
    
    // Extraer ImageData
    const imageData = ctx.getImageData(0, 0, config.width, config.height);
    return imageData;
    
  } catch (err) {
    console.error('Error capturando frame desde video:', err);
    return null;
  }
}

/**
 * Captura frame desde MediaStream (getUserMedia)
 */
export function captureFrameFromStream(
  stream: MediaStream,
  options: FrameCaptureOptions = {}
): ImageData | null {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.width = config.width;
    video.height = config.height;
    
    // Esperar a que el video esté listo (sync en este caso)
    if (video.readyState < 2) {
      console.warn('Stream no está listo');
      return null;
    }

    return captureFrameFromVideo(video, options);
    
  } catch (err) {
    console.error('Error capturando frame desde stream:', err);
    return null;
  }
}

/**
 * Captura frame desde canvas (para WebXR AR)
 */
export function captureFrameFromCanvas(
  canvas: HTMLCanvasElement,
  options: FrameCaptureOptions = {}
): ImageData | null {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('No se pudo obtener contexto 2D del canvas');
      return null;
    }

    // Si el canvas ya tiene el tamaño correcto, extraer directo
    if (canvas.width === config.width && canvas.height === config.height) {
      return ctx.getImageData(0, 0, config.width, config.height);
    }

    // Si no, redimensionar
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = config.width;
    tempCanvas.height = config.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    tempCtx.drawImage(canvas, 0, 0, config.width, config.height);
    return tempCtx.getImageData(0, 0, config.width, config.height);
    
  } catch (err) {
    console.error('Error capturando frame desde canvas:', err);
    return null;
  }
}

/**
 * Captura frame desde un elemento de imagen
 */
export function captureFrameFromImage(
  image: HTMLImageElement,
  options: FrameCaptureOptions = {}
): ImageData | null {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const canvas = document.createElement('canvas');
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(image, 0, 0, config.width, config.height);
    return ctx.getImageData(0, 0, config.width, config.height);
    
  } catch (err) {
    console.error('Error capturando frame desde imagen:', err);
    return null;
  }
}

/**
 * Obtiene el video de cámara activo en la página
 * Útil para capturar frames del AR fallback
 */
export function findActiveCameraVideo(): HTMLVideoElement | null {
  // Buscar video element que esté reproduciendo
  const videos = document.querySelectorAll('video');
  
  for (const video of videos) {
    if (
      !video.paused &&
      !video.ended &&
      video.readyState >= 2 &&
      video.srcObject instanceof MediaStream
    ) {
      return video;
    }
  }

  return null;
}

/**
 * Captura frame automático detectando la fuente disponible
 */
export async function captureFrameAuto(
  options: FrameCaptureOptions = {}
): Promise<ImageData | null> {
  // Opción 1: Video activo (AR fallback o cámara normal)
  const activeVideo = findActiveCameraVideo();
  if (activeVideo) {
    console.log('📷 Capturando frame desde video activo');
    return captureFrameFromVideo(activeVideo, options);
  }

  // Opción 2: Obtener stream de cámara
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.width = options.width || 640;
    video.height = options.height || 640;
    
    // Esperar a que el video esté listo
    await new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve();
      video.play();
    });

    const frame = captureFrameFromVideo(video, options);
    
    // Detener stream después de capturar
    stream.getTracks().forEach(track => track.stop());
    
    console.log('📷 Frame capturado desde getUserMedia');
    return frame;
    
  } catch (err) {
    console.error('❌ No se pudo capturar frame:', err);
    return null;
  }
}

/**
 * Cola de frames para procesamiento
 * Evita saturar el sistema procesando demasiados frames a la vez
 */
export class FrameQueue {
  private queue: ImageData[] = [];
  private maxSize: number;
  private processing = false;

  constructor(maxSize: number = 3) {
    this.maxSize = maxSize;
  }

  enqueue(frame: ImageData): boolean {
    if (this.queue.length >= this.maxSize) {
      // Descartar el frame más antiguo
      this.queue.shift();
    }
    this.queue.push(frame);
    return true;
  }

  dequeue(): ImageData | null {
    return this.queue.shift() || null;
  }

  get length(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  isProcessing(): boolean {
    return this.processing;
  }

  setProcessing(value: boolean): void {
    this.processing = value;
  }
}
