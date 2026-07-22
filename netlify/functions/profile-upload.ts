import type { Handler } from '@netlify/functions';
import { jsonResponse } from './_infernet-client';

interface ProfileUploadPayload {
  displayName: string;
  username: string;
  bio: string;
  website?: string;
  location?: string;
  agentPersona?: string;
  avatar?: { base64: string; mimeType: string } | null;
  banner?: { base64: string; mimeType: string } | null;
  existingAvatarURI?: string;
  existingBannerURI?: string;
}

const PROVIDER = process.env.STORAGE_PROVIDER ?? 'pinata';

async function pinFile(base64: string, mimeType: string, filename: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');

  if (PROVIDER === 'web3storage') {
    const token = process.env.WEB3_STORAGE_TOKEN;
    if (!token) throw new Error('WEB3_STORAGE_TOKEN is not configured');
    const res = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
      body: buffer,
    });
    if (!res.ok) throw new Error(`web3.storage upload failed: ${res.status}`);
    const data = await res.json();
    return `ipfs://${data.cid}`;
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT is not configured');
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata upload failed: ${res.status}`);
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

async function pinJSON(metadata: unknown): Promise<string> {
  if (PROVIDER === 'web3storage') {
    const token = process.env.WEB3_STORAGE_TOKEN;
    const res = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!res.ok) throw new Error(`web3.storage metadata upload failed: ${res.status}`);
    const data = await res.json();
    return `ipfs://${data.cid}`;
  }

  const jwt = process.env.PINATA_JWT;
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinataContent: metadata }),
  });
  if (!res.ok) throw new Error(`Pinata metadata upload failed: ${res.status}`);
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const payload: ProfileUploadPayload = JSON.parse(event.body ?? '{}');

    const [uploadedAvatarURI, uploadedBannerURI] = await Promise.all([
      payload.avatar ? pinFile(payload.avatar.base64, payload.avatar.mimeType, 'avatar') : Promise.resolve(undefined),
      payload.banner ? pinFile(payload.banner.base64, payload.banner.mimeType, 'banner') : Promise.resolve(undefined),
    ]);
    const avatarURI = uploadedAvatarURI ?? payload.existingAvatarURI;
    const bannerURI = uploadedBannerURI ?? payload.existingBannerURI;

    const metadataURI = await pinJSON({
      displayName: payload.displayName,
      username: payload.username,
      bio: payload.bio,
      website: payload.website,
      location: payload.location,
      agentPersona: payload.agentPersona,
      avatarURI,
      bannerURI,
      updatedAt: Date.now(),
    });

    return jsonResponse({ metadataURI });
  } catch (err: any) {
    console.error('[profile-upload]', err);
    return jsonResponse({ error: err.message ?? 'Upload failed' }, 500);
  }
};
