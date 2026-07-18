/**
 * Resizes + re-compresses an image client-side before it's ever base64-encoded
 * and sent to a Netlify function. Phone camera photos are routinely 4-12MB,
 * which blows past Netlify's ~6MB request body limit once base64-encoded
 * (+33% overhead) — this keeps every upload comfortably small regardless of
 * what the original photo looked like.
 */
export async function resizeImage(file: File, maxDimension: number, quality = 0.85): Promise<File> {
  // Skip re-encoding tiny files/non-image types — nothing to gain.
  if (!file.type.startsWith('image/') || file.size < 150 * 1024) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // fall back to original if decoding fails for any reason

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}
