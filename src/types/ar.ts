/**
 * Tipos TypeScript para el sistema de Realidad Aumentada
 */

// Tipo de hotspot AR (punto de interés en la escena)
export type ARHotspotType = 'info' | 'image' | 'video' | '3d_model' | 'audio';

// Vector 3D para posiciones, rotaciones y escalas
// Permite tanto formato array como objeto para compatibilidad
export type Vector3 = [number, number, number] | { x: number; y: number; z: number };

// Hotspot base con propiedades comunes
export interface ARHotspotBase {
  id: string;
  type: ARHotspotType;
  position: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
}

// Hotspot de información
export interface ARInfoHotspot extends ARHotspotBase {
  type: 'info';
  title: string;
  description: string;
  image_url?: string;
}

// Hotspot de imagen (billboard)
export interface ARImageHotspot extends ARHotspotBase {
  type: 'image';
  image_url: string;
  title?: string;
  description?: string;
}

// Hotspot de video
export interface ARVideoHotspot extends ARHotspotBase {
  type: 'video';
  video_url: string;
  thumbnail_url?: string;
  title: string;
  autoplay?: boolean;
}

// Hotspot de modelo 3D
export interface AR3DModelHotspot extends ARHotspotBase {
  type: '3d_model';
  model_url: string;
  animation?: string;
}

// Hotspot de audio
export interface ARAudioHotspot extends ARHotspotBase {
  type: 'audio';
  audio_url: string;
  title: string;
  autoplay?: boolean;
}

// Union de todos los tipos de hotspots
export type ARHotspot = 
  | ARInfoHotspot 
  | ARImageHotspot
  | ARVideoHotspot 
  | AR3DModelHotspot 
  | ARAudioHotspot;

// Estructura de datos AR en la base de datos
export interface ARData {
  hotspots: ARHotspot[];
  // Primitivas y transform del modelo (opcional, guardado por el panel AR)
  primitives?: Array<{
    id: string;
    type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'plane';
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    color?: string;
  }>;
  modelTransform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
}

// Datos completos de un atractivo con AR
export interface AttractionWithAR {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  image_url?: string;
  ar_model_url?: string;
  ar_hotspots?: ARData;
  has_ar_content: boolean;
  qr_code?: string;
  category?: string;
  info_extra?: string;
}

// Estado de capacidades WebXR
export interface WebXRCapabilities {
  isSupported: boolean;
  isSecureContext: boolean;
  hasCamera: boolean;
  arMode?: 'immersive-ar' | 'inline';
}

// Props para el componente ARViewer
export interface ARViewerProps {
  attraction: AttractionWithAR;
  onClose: () => void;
  onError?: (error: Error) => void;
}

// Props para el componente QRScanner
export interface QRScannerProps {
  onScanSuccess: (qrCode: string) => void;
  onScanError?: (error: string) => void;
  onClose: () => void;
}

// Resultado del escaneo de QR
export interface QRScanResult {
  qrCode: string;
  attractionId?: string;
  timestamp: number;
}

// Configuración de la escena AR
export interface ARSceneConfig {
  backgroundColor?: string;
  showGrid?: boolean;
  enableShadows?: boolean;
  ambientLightIntensity?: number;
  directionalLightIntensity?: number;
}

// Estado de carga de recursos AR
export interface ARLoadingState {
  isLoading: boolean;
  progress: number;
  currentAsset?: string;
  error?: Error;
}
