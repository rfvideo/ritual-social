import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Calendar, Link2, MapPin, Pencil } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { WalletBadge } from '@/components/wallet/WalletBadge';
import { FollowListModal } from './FollowListModal';
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
  const [listOpen, setListOpen] = useState<'following' | 'followers' | null>(null);

  async function handleFollowToggle() {
    const ok = following ? await unfollow(profile.address) : await follow(profile.address);
    if (ok) onFollowChange();
  }

  async function handleTip() {
    const result = await tip(profile.address, tipAmount);
    if (result) setTipOpen(false);
  }

  return (
    <div className="animate-riseIn">
      <div className="h-40 w-full bg-ash-100 sm:h-52">
        {profile.bannerURI ? (
          <img src={resolveIpfsUri(profile.bannerURI)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-ritual-radial" />
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end justify-between">
          <Avatar address={profile.address} uri={profile.avatarURI} size="xl" ring className="-mt-12 border-4 border-void" />
          <div className="mt-3 flex gap-2">
            {isOwnProfile ? (
              <button onClick={onEdit} className="ritual-btn-ghost">
                <Pencil size={14} /> Edit Profile
              </button>
            ) : (
              <>
                <button onClick={() => setTipOpen((v) => !v)} className="ritual-btn-ghost">
                  Tip
                </button>
                <button onClick={handleFollowToggle} disabled={pending} className={following ? 'ritual-btn-ghost' : 'ritual-btn'}>
                  {following ? 'Following' : 'Follow'}
                </button>
              </>
            )}
          </div>
        </div>

        {tipOpen && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-ash-200 bg-ash-100/60 p-3">
            <input
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              className="w-24 rounded-lg border border-ash-300 bg-void-200 px-2 py-1 text-sm text-mist-light focus:outline-none"
            />
            <span className="text-xs text-mist-dim">RITUAL</span>
            <button onClick={handleTip} disabled={tipPending} className="ritual-btn ml-auto px-4 py-1.5 text-xs">
              Send Tip
            </button>
          </div>
        )}

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl text-white">{profile.displayName}</h1>
            <WalletBadge address={profile.address} />
          </div>
          <p className="text-sm text-mist-dim">@{profile.username}</p>
        </div>

        {profile.bio && <p className="mt-3 text-[15px] text-mist-light">{profile.bio}</p>}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist-dim">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {profile.location}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-ritual-400 hover:underline"
            >
              <Link2 size={14} /> {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={14} /> Joined {formatJoinDate(profile.joinedAt)}
          </span>
        </div>

        <div className="mt-3 flex gap-4 text-sm">
          <button onClick={() => setListOpen('following')} className="hover:underline">
            <strong className="text-mist-light">{formatCount(profile.followingCount)}</strong>{' '}
            <span className="text-mist-dim">Following</span>
          </button>
          <button onClick={() => setListOpen('followers')} className="hover:underline">
            <strong className="text-mist-light">{formatCount(profile.followerCount)}</strong>{' '}
            <span className="text-mist-dim">Followers</span>
          </button>
          <span>
            <strong className="text-mist-light">{formatCount(profile.postCount)}</strong>{' '}
            <span className="text-mist-dim">Posts</span>
          </span>
        </div>
      </div>

      <FollowListModal
        address={profile.address}
        type={listOpen ?? 'following'}
        open={listOpen !== null}
        onClose={() => setListOpen(null)}
      />
    </div>
  );
                  }
