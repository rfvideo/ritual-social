import { IPFS_GATEWAY } from '@/config/constants';

export function resolveIpfsUri(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY.replace(/\/$/, '')}/${uri.replace('ipfs://', '')}`;
  }
  return uri;
}

export interface PostMetadata {
  caption: string;
  hashtags: string[];
  mentions: string[];
  images: string[];
  createdAt: number;
}

const metadataCache = new Map<string, PostMetadata>();

async function fetchWithRetry(url: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return fetch(url, { signal: AbortSignal.timeout(15000) });
  }
}

export async function fetchPostMetadata(contentURI: string): Promise<PostMetadata> {
  if (metadataCache.has(contentURI)) return metadataCache.get(contentURI)!;
  const res = await fetchWithRetry(resolveIpfsUri(contentURI));
  if (!res.ok) throw new Error(`Failed to fetch post metadata: ${res.status}`);
  const data = (await res.json()) as PostMetadata;
  metadataCache.set(contentURI, data);
  return data;
}

export const fetchCommentMetadata = fetchPostMetadata;

export async function uploadCommentContent(body: string): Promise<string> {
  return uploadPostContent({ caption: body, images: [] });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function filesToPayload(files: File[]) {
  return Promise.all(
    files.map(async (file) => ({
      base64: await fileToBase64(file),
      mimeType: file.type,
      filename: file.name,
    })),
  );
}

export async function uploadImagesOnly(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const images = await filesToPayload(files);
  const res = await fetch('/.netlify/functions/ipfs-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagesOnly: true, images }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to upload image to IPFS');
  }
  const { imageURIs } = await res.json();
  return imageURIs;
}

export async function uploadPostContent(params: {
  caption: string;
  images: File[];
  existingImageURIs?: string[];
  hashtags?: string[];
  mentions?: string[];
}): Promise<string> {
  const images = params.existingImageURIs?.length ? [] : await filesToPayload(params.images);

  const res = await fetch('/.netlify/functions/ipfs-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caption: params.caption,
      images,
      existingImageURIs: params.existingImageURIs,
      hashtags: params.hashtags,
      mentions: params.mentions,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Upload to IPFS failed');
  }
  const { contentURI } = await res.json();
  return contentURI;
      }
