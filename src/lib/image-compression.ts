/**
 * Client-side WebP image compressor using HTML5 <canvas>.
 * Strictly adheres to Zero Paid Storage principle by keeping images <= ~40KB.
 */

export interface CompressionOptions {
  maxSizeKB?: number;
  maxWidth?: number;
  maxHeight?: number;
  initialQuality?: number;
}

export interface CompressionResult {
  dataUrl: string;
  sizeKB: number;
  width: number;
  height: number;
  format: "image/webp";
}

export async function compressImageToWebP(
  fileOrBlob: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxSizeKB = 40,
    maxWidth = 800,
    maxHeight = 800,
    initialQuality = 0.82,
  } = options;

  const targetSizeBytes = maxSizeKB * 1024;

  // 1. Load image into HTMLImageElement
  const objectUrl = URL.createObjectURL(fileOrBlob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = objectUrl;
  });

  try {
    let { width, height } = image;

    // 2. Resize maintaining aspect ratio
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create canvas 2D rendering context");
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    // 3. Iterative quality compression to guarantee targetSizeBytes <= 40KB
    let quality = initialQuality;
    let dataUrl = canvas.toDataURL("image/webp", quality);
    let size = calculateBase64Bytes(dataUrl);

    // If still too large, step down quality
    while (size > targetSizeBytes && quality > 0.25) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/webp", quality);
      size = calculateBase64Bytes(dataUrl);
    }

    // If still too large, further downscale dimensions
    if (size > targetSizeBytes) {
      let scale = 0.8;
      while (size > targetSizeBytes && scale >= 0.4) {
        const scaledWidth = Math.round(width * scale);
        const scaledHeight = Math.round(height * scale);
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        ctx.drawImage(image, 0, 0, scaledWidth, scaledHeight);
        dataUrl = canvas.toDataURL("image/webp", Math.max(0.3, quality));
        size = calculateBase64Bytes(dataUrl);
        scale -= 0.15;
      }
    }

    return {
      dataUrl,
      sizeKB: Math.round((size / 1024) * 10) / 10,
      width: canvas.width,
      height: canvas.height,
      format: "image/webp",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function calculateBase64Bytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] || "";
  // Base64 length to byte size estimation
  const padding = (base64.match(/=/g) || []).length;
  return (base64.length * 3) / 4 - padding;
}
