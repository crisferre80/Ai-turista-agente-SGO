import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface PhotoResult {
    blob: Blob;
    url: string;
    format: string;
}

// Check if we're running in native app or web
const isNative = Capacitor.isNativePlatform();

export const takePhoto = async (): Promise<PhotoResult | null> => {
    try {
        // For web, use standard file input with camera
        if (!isNative) {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                // Request camera on mobile web (some browsers use the 'capture' attribute)
                input.setAttribute('capture', 'environment'); // avoids casting to any
                
                input.onchange = async (e: Event) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    
                    const url = URL.createObjectURL(file);
                    const blob = await file.arrayBuffer().then(ab => new Blob([ab], { type: file.type }));
                    const format = file.type.split('/')[1] || 'jpeg';
                    
                    resolve({ blob, url, format });
                };
                
                input.oncancel = () => resolve(null);
                input.click();
            });
        }
        
        // For native apps, use Capacitor Camera
        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Uri,
            source: CameraSource.Prompt // Asks user to use Camera or Photo Library
        });

        if (!image.webPath) return null;

        // Fetch the local file as a blob
        const response = await fetch(image.webPath);
        const blob = await response.blob();

        return {
            blob,
            url: image.webPath,
            format: image.format
        };
    } catch (error) {
        console.error('Camera error:', error);
        return null;
    }
};
