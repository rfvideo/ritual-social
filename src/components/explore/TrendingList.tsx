import { TrendingUp } from 'lucide-react';
import { extractHashtags, formatCount } from '@/lib/utils';
import type { PostRecord } from '@/types';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export function TrendingList({ posts, limit = 5 }: { posts: PostRecord[]; limit?: number }) {
  const trending = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      for (const tag of extractHashtags(post.caption)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  }, [posts, limit]);

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <TrendingUp size={16} className="text-ritual-400" /> Trending di Ritual
      </div>
      {trending.length === 0 ? (
        <p className="text-sm text-mist-dim">Belum ada tren — jadilah yang pertama memulai percakapan.</p>
      ) : (
        <ul className="space-y-3">
          {trending.map(([tag, count], i) => (
            <li key={tag}>
              <Link to={`/search?q=%23${tag}`} className="group block">
                <p className="text-xs text-mist-dim">#{i + 1} · Trending</p>
                <p className="font-medium text-mist-light group-hover:text-ritual-300">#{tag}</p>
                <p className="text-xs text-mist-dim">{formatCount(count)} postingan</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
