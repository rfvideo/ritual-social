import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { resolveIpfsUri } from '@/lib/ipfs';
import { uploadProfileMetadata } from '@/lib/profile';
import { resizeImage } from '@/lib/image';
import { useUpdateProfile } from '@/hooks/useProfile';
import type { UserProfile } from '@/types';

export function EditProfileModal({
  open,
  profile,
  onClose,
}: {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [website, setWebsite] = useState(profile.website ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const { updateProfile, pending } = useUpdateProfile();

  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : profile.avatarURI ? resolveIpfsUri(profile.avatarURI) : undefined;
  const bannerPreview = bannerFile ? URL.createObjectURL(bannerFile) : profile.bannerURI ? resolveIpfsUri(profile.bannerURI) : undefined;

  async function handleSave() {
    if (!username.trim()) {
      toast.error('Username cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const metadataURI = await uploadProfileMetadata({
        displayName: displayName.trim() || username.trim(),
        username: username.trim().replace(/^@/, ''),
        bio: bio.trim(),
        website: website.trim() || undefined,
        location: location.trim() || undefined,
        avatarFile,
        bannerFile,
        existingAvatarURI: profile.avatarURI,
        existingBannerURI: profile.bannerURI,
      });
      const ok = await updateProfile(metadataURI);
      if (ok) onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="font-display text-lg text-mist-light">Edit Profile</h2>
              <button onClick={onClose} disabled={busy} className="rounded-full p-1.5 text-mist-dim hover:bg-ash-100">
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-4 h-36 w-full bg-ash-100">
              {bannerPreview && <img src={bannerPreview} alt="" className="h-full w-full object-cover" />}
              <button
                onClick={() => bannerInput.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/30 text-white transition hover:bg-black/50 active:bg-black/50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                  <Camera size={18} />
                </span>
              </button>
              <input
                ref={bannerInput}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setBannerFile(await resizeImage(file, 1600));
                }}
              />

              <div className="absolute -bottom-8 left-5 h-20 w-20 overflow-hidden rounded-full border-4 border-ash bg-ash-200">
                {avatarPreview && <img src={avatarPreview} alt="" className="h-full w-full object-cover" />}
                <button
                  onClick={() => avatarInput.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 text-white transition hover:bg-black/50 active:bg-black/50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60">
                    <Camera size={14} />
                  </span>
                </button>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setAvatarFile(await resizeImage(file, 512));
                  }}
                />
              </div>
            </div>

            <div className="space-y-4 px-5 pb-6 pt-12">
              <Field label="Display Name" value={displayName} onChange={setDisplayName} maxLength={50} />
              <Field label="Username" value={username} onChange={setUsername} maxLength={30} prefix="@" />
              <div>
                <label className="mb-1 block text-xs font-medium text-mist-dim">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-ash-300 bg-void-200 px-3 py-2 text-sm text-mist-light focus:border-ritual-500 focus:outline-none"
                />
              </div>
              <Field label="Website / X / Other link" value={website} onChange={setWebsite} maxLength={100} />
              <Field label="Location" value={location} onChange={setLocation} maxLength={50} />

              <button onClick={handleSave} disabled={busy} className="ritual-btn w-full">
                {busy ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  prefix?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-mist-dim">{label}</label>
      <div className="flex items-center rounded-xl border border-ash-300 bg-void-200 px-3">
        {prefix && <span className="text-sm text-mist-dim">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          className="w-full bg-transparent py-2 text-sm text-mist-light focus:outline-none"
        />
      </div>
    </div>
  );
}
