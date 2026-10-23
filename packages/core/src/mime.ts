/** MIME helpers aligned with sentx-drop MEDIA_EXT. */

export const MEDIA_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
};

export const MAX_DREAMFORGE_FILENAME = 32;

export function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase() : '';
}

export function mimeForFilename(filename: string): string {
  return MEDIA_EXT[extOf(filename)] ?? 'application/octet-stream';
}

export function mimeForExt(ext: string): string {
  const e = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return MEDIA_EXT[e] ?? 'application/octet-stream';
}

export function normalizeExt(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase();
}
