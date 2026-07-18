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
  images: string[]; // ipfs:// URIs
  createdAt: number;
}

const metadataCache = new Map<string, PostMetadata>();

export async function fetchPostMetadata(contentURI: string): Promise<PostMetadata> {
  if (metadataCache.has(contentURI)) return metadataCache.get(contentURI)!;
  const res = await fetch(resolveIpfsUri(contentURI));
  if (!res.ok) throw new Error(`Failed to fetch post metadata: ${res.status}`);
  const data = (await res.json()) as PostMetadata;
  metadataCache.set(contentURI, data);
  return data;
}

/** Comments reuse the same {caption, images, ...} shape — `caption` holds the comment body. */
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

/** Uploads images + caption to IPFS via the server-side pinning function
 *  and returns the metadata CID to pass into `createPost`. */
export async function uploadPostContent(params: {
  caption: string;
  images: File[];
  hashtags?: string[];
  mentions?: string[];
}): Promise<string> {
  const images = await Promise.all(
    params.images.map(async (file) => ({
      base64: await fileToBase64(file),
      mimeType: file.type,
      filename: file.name,
    })),
  );

  const res = await fetch('/.netlify/functions/ipfs-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption: params.caption, images, hashtags: params.hashtags, mentions: params.mentions }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Upload to IPFS failed');
  }
  const { contentURI } = await res.json();
  return contentURI;
}
