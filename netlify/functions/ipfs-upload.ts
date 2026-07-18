import type { Handler } from '@netlify/functions';
import { jsonResponse } from './_infernet-client';

/**
 * Pins post content to IPFS and returns the CID that RitualSocial's
 * `contentURI` field will reference on-chain. The blockchain never stores
 * raw image bytes — only this reference, per the spec.
 *
 * Runs server-side so your PINATA_JWT / WEB3_STORAGE_TOKEN never reaches
 * the browser bundle.
 */

interface UploadPayload {
  caption: string;
  images: Array<{ base64: string; mimeType: string; filename: string }>;
  hashtags?: string[];
  mentions?: string[];
}

const PROVIDER = process.env.STORAGE_PROVIDER ?? 'pinata';

async function pinToPinata(payload: UploadPayload): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT is not configured');

  const imageCIDs: string[] = [];
  for (const img of payload.images) {
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

  const metadata = {
    caption: payload.caption,
    hashtags: payload.hashtags ?? [],
    mentions: payload.mentions ?? [],
    images: imageCIDs,
    createdAt: Date.now(),
  };

  const metaRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinataContent: metadata }),
  });
  if (!metaRes.ok) throw new Error(`Pinata metadata upload failed: ${metaRes.status}`);
  const metaData = await metaRes.json();
  return `ipfs://${metaData.IpfsHash}`;
}

async function pinToWeb3Storage(payload: UploadPayload): Promise<string> {
  const token = process.env.WEB3_STORAGE_TOKEN;
  if (!token) throw new Error('WEB3_STORAGE_TOKEN is not configured');

  const imageCIDs: string[] = [];
  for (const img of payload.images) {
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

  const metadata = {
    caption: payload.caption,
    hashtags: payload.hashtags ?? [],
    mentions: payload.mentions ?? [],
    images: imageCIDs,
    createdAt: Date.now(),
  };

  const metaRes = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  if (!metaRes.ok) throw new Error(`web3.storage metadata upload failed: ${metaRes.status}`);
  const metaData = await metaRes.json();
  return `ipfs://${metaData.cid}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const payload: UploadPayload = JSON.parse(event.body ?? '{}');
    payload.images = payload.images ?? [];
    if (!payload.caption?.trim() && payload.images.length === 0) {
      return jsonResponse({ error: 'Provide text and/or at least one image' }, 400);
    }
    // Basic size guard against abusive uploads before they hit the pinning provider.
    const totalBytes = payload.images.reduce((sum, i) => sum + i.base64.length * 0.75, 0);
    if (totalBytes > 25 * 1024 * 1024) {
      return jsonResponse({ error: 'Upload exceeds 25MB limit' }, 413);
    }

    const contentURI =
      PROVIDER === 'web3storage' ? await pinToWeb3Storage(payload) : await pinToPinata(payload);

    return jsonResponse({ contentURI });
  } catch (err: any) {
    console.error('[ipfs-upload]', err);
    return jsonResponse({ error: err.message ?? 'Upload failed' }, 500);
  }
};
