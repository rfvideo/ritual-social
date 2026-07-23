import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { formatCount, truncateAddress } from '@/lib/utils';
import type { PostRecord } from '@/types';

export function SuggestedUsers({ posts, limit = 4 }: { posts: PostRecord[]; limit?: number }) {
  const creators = useMemo(() => {
    const map = new Map<string, PostRecord['author']>();
    for (const post of posts) map.set(post.author.address, post.author);
    return [...map.values()].sort((a, b) => b.followerCount - a.followerCount).slice(0, limit);
  }, [posts, limit]);

  if (creators.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 text-sm font-semibold text-mist-light">Suggested Creators</div>
      <ul className="space-y-3">
        {creators.map((c) => (
          <li key={c.address}>
            <Link to={`/profile/${c.address}`} className="flex items-center gap-2.5 group">
              <Avatar address={c.address} uri={c.avatarURI} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mist-light group-hover:text-ritual-300">
                  {c.displayName}
                </p>
                <p className="truncate text-xs text-mist-dim">{truncateAddress(c.address)}</p>
              </div>
              <span className="text-xs text-mist-dim">{formatCount(c.followerCount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
