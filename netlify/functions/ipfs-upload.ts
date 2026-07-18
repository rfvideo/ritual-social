import type { Handler } from '@netlify/functions';
import { jsonResponse } from './_infernet-client';

/**
 * Pins post content to IPFS and returns the CID that RitualSocial's
 * `contentURI` field will reference on-chain. The blockchain never stores
 * raw image bytes — only this reference, per the spec.
 *
 * Runs server-side so your PINATA_JWT / WEB3_STORAGE_TOKEN never reaches
 * the browser bundle.
 *
 * Supports two call shapes:
 *  - { imagesOnly: true, images: [...] }               → pins just the images,
 *    returns { imageURIs }. Used by the composer right after image select so
 *    AI captioning has real fetchable URIs to analyze before the user hits Publish.
 *  - { caption, images, existingImageURIs, hashtags, mentions } → pins the
 *    final metadata JSON. If `existingImageURIs` is provided, those are reused
 *    as-is (no re-upload); otherwise any `images` present are uploaded first.
 */

interface UploadPayload {
  caption?: string;
  images?: Array<{ base64: string; mimeType: string; filename: string }>;
  existingImageURIs?: string[];
  hashtags?: string[];
  mentions?: string[];
  imagesOnly?: boolean;
}

const PROVIDER = process.env.STORAGE_PROVIDER ?? 'pinata';

async function pinImagesPinata(images: NonNullable<UploadPayload['images']>): Promise<string[]> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT is not configured');

  const imageCIDs: string[] = [];
  for (const img of images) {
    const buffer = Buffer.from(img.base64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: img.mimeType }), img.filename);
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Pinata image upload failed: ${res.status}`);
    const data = await res.json();
    imageCIDs.push(`ipfs://${data.IpfsHash}`);
  }
  return imageCIDs;
}

async function pinImagesWeb3Storage(images: NonNullable<UploadPayload['images']>): Promise<string[]> {
  const token = process.env.WEB3_STORAGE_TOKEN;
  if (!token) throw new Error('WEB3_STORAGE_TOKEN is not configured');

  const imageCIDs: string[] = [];
  for (const img of images) {
    const buffer = Buffer.from(img.base64, 'base64');
    const res = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': img.mimeType },
      body: buffer,
    });
    if (!res.ok) throw new Error(`web3.storage image upload failed: ${res.status}`);
    const data = await res.json();
    imageCIDs.push(`ipfs://${data.cid}`);
  }
  return imageCIDs;
}

async function pinImages(images: NonNullable<UploadPayload['images']>): Promise<string[]> {
  return PROVIDER === 'web3storage' ? pinImagesWeb3Storage(images) : pinImagesPinata(images);
}

async function pinMetadataPinata(metadata: unknown): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT is not configured');
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinataContent: metadata }),
  });
  if (!res.ok) throw new Error(`Pinata metadata upload failed: ${res.status}`);
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

async function pinMetadataWeb3Storage(metadata: unknown): Promise<string> {
  const token = process.env.WEB3_STORAGE_TOKEN;
  if (!token) throw new Error('WEB3_STORAGE_TOKEN is not configured');
  const res = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error(`web3.storage metadata upload failed: ${res.status}`);
  const data = await res.json();
  return `ipfs://${data.cid}`;
}

async function pinMetadata(metadata: unknown): Promise<string> {
  return PROVIDER === 'web3storage' ? pinMetadataWeb3Storage(metadata) : pinMetadataPinata(metadata);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const payload: UploadPayload = JSON.parse(event.body ?? '{}');
    const images = payload.images ?? [];

    const totalBytes = images.reduce((sum, i) => sum + i.base64.length * 0.75, 0);
    if (totalBytes > 25 * 1024 * 1024) {
      return jsonResponse({ error: 'Upload exceeds 25MB limit' }, 413);
    }

    if (payload.imagesOnly) {
      if (images.length === 0) return jsonResponse({ error: 'No images provided' }, 400);
      const imageURIs = await pinImages(images);
      return jsonResponse({ imageURIs });
    }

    if (!payload.caption?.trim() && images.length === 0 && !payload.existingImageURIs?.length) {
      return jsonResponse({ error: 'Provide text and/or at least one image' }, 400);
    }

    const imageURIs = payload.existingImageURIs?.length
      ? payload.existingImageURIs
      : images.length > 0
        ? await pinImages(images)
        : [];

    const metadata = {
      caption: payload.caption ?? '',
      hashtags: payload.hashtags ?? [],
      mentions: payload.mentions ?? [],
      images: imageURIs,
      createdAt: Date.now(),
    };

    const contentURI = await pinMetadata(metadata);
    return jsonResponse({ contentURI });
  } catch (err: any) {
    console.error('[ipfs-upload]', err);
    return jsonResponse({ error: err.message ?? 'Upload failed' }, 500);
  }
};
