export interface ProfileUpdateInput {
  displayName: string;
  username: string;
  bio: string;
  website?: string;
  location?: string;
  avatarFile?: File | null;
  bannerFile?: File | null;
  existingAvatarURI?: string;
  existingBannerURI?: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Uploads changed avatar/banner (if any) + profile fields, returns the metadata CID for `updateProfile`. */
export async function uploadProfileMetadata(input: ProfileUpdateInput): Promise<string> {
  const [avatar, banner] = await Promise.all([
    input.avatarFile
      ? fileToBase64(input.avatarFile).then((base64) => ({ base64, mimeType: input.avatarFile!.type }))
      : Promise.resolve(null),
    input.bannerFile
      ? fileToBase64(input.bannerFile).then((base64) => ({ base64, mimeType: input.bannerFile!.type }))
      : Promise.resolve(null),
  ]);

  const res = await fetch('/.netlify/functions/profile-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: input.displayName,
      username: input.username,
      bio: input.bio,
      website: input.website,
      location: input.location,
      avatar,
      banner,
      existingAvatarURI: input.existingAvatarURI,
      existingBannerURI: input.existingBannerURI,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Gagal menyimpan profil ke IPFS');
  }

  const { metadataURI } = await res.json();
  return metadataURI;
}
