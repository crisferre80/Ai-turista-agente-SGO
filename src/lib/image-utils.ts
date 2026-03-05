// Utilities for client-side image manipulation

/**
 * Resize/compress an image file using a canvas element.
 * Keeps aspect ratio and constrains to maxWidth/maxHeight.
 * Returns a new File object with the same mime type.
 */
export async function resizeImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // calculate new dimensions while preserving aspect ratio
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2D context')); return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const newFile = new File([blob], file.name, { type: file.type });
          resolve(newFile);
        },
        file.type,
        quality
      );
    };
    img.onerror = (e) => reject(e);
    img.src = URL.createObjectURL(file);
  });
}
