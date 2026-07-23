import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Calendar, Link2, MapPin, Pencil } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { resolveIpfsUri } from '@/lib/ipfs';
import { formatCount, formatJoinDate } from '@/lib/utils';
import { useFollowGraph, useTipCreator } from '@/hooks/useRitualSocial';
import { useIsFollowing } from '@/hooks/useProfile';
import type { UserProfile } from '@/types';

export function ProfileHeader({
  profile,
  onEdit,
  onFollowChange,
}: {
  profile: UserProfile;
  onEdit: () => void;
  onFollowChange: () => void;
}) {
  const { address: viewer } = useAccount();
  const isOwnProfile = viewer?.toLowerCase() === profile.address.toLowerCase();
  const { data: following } = useIsFollowing(viewer, profile.address);
  const { follow, unfollow, pending } = useFollowGraph();
  const { tip, pending: tipPending } = useTipCreator();
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState('0.01');

  async function handleFollowToggle() {
    const ok = following ? await unfollow(profile.address) : await follow(profile.address);
    if (ok) onFollowChange();
  }

  async function handleTip() {
    const result = await tip(profile.address, tipAmount);
    if (result) setTipOpen(false);
  }

  return (
    <div className="animate-riseIn w-full max-w-full overflow-x-hidden">
      <div className="h-32 w-full bg-ash-100 sm:h-44 md:h-52 lg:h-60">
        {profile.bannerURI ? (
          <img src={resolveIpfsUri(profile.bannerURI)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-ritual-radial" />
        )}
      </div>

      <div className="px-3 pb-4 sm:px-4 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Avatar
            address={profile.address}
            uri={profile.avatarURI}
            size="xl"
            ring
            className="-mt-10 border-4 border-void sm:-mt-12 md:-mt-14"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {isOwnProfile ? (
              <button onClick={onEdit} className="ritual-btn-ghost whitespace-nowrap">
                <Pencil size={14} /> Edit Profile
              </button>
            ) : (
              <>
                <button onClick={() => setTipOpen((v) => !v)} className="ritual-btn-ghost whitespace-nowrap">
                  Tip
                </button>
                <button
                  onClick={handleFollowToggle}
                  disabled={pending}
                  className={`whitespace-nowrap ${following ? 'ritual-btn-ghost text-red-400' : 'ritual-btn'}`}
                >
                  {following ? 'Unfollow' : 'Follow'}
                </button>
              </>
            )}
          </div>
        </div>

        {tipOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-ash-200 bg-ash-100/60 p-3">
            <input
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              className="w-20 min-w-0 flex-shrink-0 rounded-lg border border-ash-300 bg-void-200 px-2 py-1 text-sm text-mist-light focus:outline-none sm:w-24"
            />
            <span className="text-xs text-mist-dim">RITUAL</span>
            <button
              onClick={handleTip}
              disabled={tipPending}
              className="ritual-btn ml-auto whitespace-nowrap px-4 py-1.5 text-xs"
            >
              Send Tip
            </button>
          </div>
        )}

        <div className="mt-3 min-w-0">
          <h1 className="break-words font-display text-lg text-white sm:text-xl">{profile.displayName}</h1>
          <p className="break-words text-sm text-mist-dim">@{profile.username}</p>
        </div>

        {profile.bio && (
          <p className="mt-3 break-words text-[15px] leading-relaxed text-mist-light">{profile.bio}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-mist-dim">
          {profile.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={14} className="flex-shrink-0" />
              <span className="break-words">{profile.location}</span>
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1 text-ritual-400 hover:underline"
            >
              <Link2 size={14} className="flex-shrink-0" />
              <span className="break-all">{profile.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={14} className="flex-shrink-0" /> Joined {formatJoinDate(profile.joinedAt)}
          </span>
        </div>

        <div className="mt-4 flex gap-x-5 text-sm">
          <span className="whitespace-nowrap">
            <strong className="text-mist-light">{formatCount(profile.followingCount)}</strong>{' '}
            <span className="text-mist-dim">Following</span>
          </span>
          <span className="whitespace-nowrap">
            <strong className="text-mist-light">{formatCount(profile.followerCount)}</strong>{' '}
            <span className="text-mist-dim">Followers</span>
          </span>
        </div>
      </div>
    </div>
  );
  }
