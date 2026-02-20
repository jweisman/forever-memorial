/**
 * Client-side image resize utilities using Canvas API.
 * Resizes and converts images to WebP before S3 upload.
 */

async function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Resize an image to fit within maxDimension (preserving aspect ratio).
 * Always re-encodes to WebP for compression even if already small enough.
 */
export async function resizeImage(
  file: File,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  // Skip resize for GIFs — canvas loses animation
  if (file.type === "image/gif") {
    return file;
  }

  const bitmap = await loadImage(file);
  const { width, height } = bitmap;

  let targetWidth = width;
  let targetHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((height / width) * maxDimension);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((width / height) * maxDimension);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  return canvasToBlob(canvas, quality);
}

/**
 * Center-crop to square, then resize to the given size.
 * Used for memorial profile pictures.
 */
export async function resizeImageSquare(
  file: File,
  size: number,
  quality: number
): Promise<Blob> {
  if (file.type === "image/gif") {
    return file;
  }

  const bitmap = await loadImage(file);
  const { width, height } = bitmap;

  // Center-crop to square
  const cropSize = Math.min(width, height);
  const sx = Math.round((width - cropSize) / 2);
  const sy = Math.round((height - cropSize) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, sx, sy, cropSize, cropSize, 0, 0, size, size);
  bitmap.close();

  return canvasToBlob(canvas, quality);
}
