import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface PhotoResult {
    blob: Blob;
    url: string;
    format: string;
}

export const takePhoto = async (): Promise<PhotoResult | null> => {
    try {
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
