/*
 * Photos and screenshots are re-encoded in the browser before they are uploaded, so a 6 MB phone photo is stored and
 * served as a few hundred KB. This is what keeps pages light for everyone who opens them later.
 */

/** GIF stays (it may be animated), SVG stays (it is already vector), AVIF is already small. */
const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/;
/** Below this, re-encoding saves too little to be worth the quality loss. */
const SKIP_UNDER_BYTES = 200 * 1024;

type Options = {
  /** Longest side in pixels. Larger images are scaled down to fit, smaller ones are never enlarged. */
  maxEdge?: number;
  /** WebP quality, 0 to 1. */
  quality?: number;
};

/**
 * Returns a smaller WebP copy of the image, or the original file when it is not worth it (not a photo format, already
 * small, the browser cannot decode it, or the copy would be bigger). Orientation from the camera is applied first.
 */
export async function compressImage(file: File, { maxEdge = 2000, quality = 0.82 }: Options = {}): Promise<File> {
  if (!COMPRESSIBLE.test(file.type) || file.size < SKIP_UNDER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    let blob: Blob | null;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
      blob = await canvas.convertToBlob({ type: "image/webp", quality });
    } else {
      const canvas = Object.assign(document.createElement("canvas"), { width, height });
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    }
    bitmap.close();

    // A browser without WebP encoding hands back a PNG; a copy that is not smaller is not an improvement.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
