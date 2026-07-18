import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { TrendingList } from '@/components/explore/TrendingList';
import { SuggestedUsers } from '@/components/explore/SuggestedUsers';
import { useFeed } from '@/hooks/usePosts';

export function RightPanel() {
  const { data: posts = [] } = useFeed();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  return (
    <aside className="sticky top-5 hidden w-80 shrink-0 flex-col gap-4 xl:flex">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        }}
        className="relative"
      >
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Ritual Social (natural language OK)"
          className="w-full rounded-full border border-ash-200 bg-ash-100/60 py-2.5 pl-10 pr-4 text-sm text-mist-light placeholder:text-mist-dim focus:border-ritual-500 focus:outline-none focus:ring-1 focus:ring-ritual-500"
        />
      </form>

      <TrendingList posts={posts} />
      <SuggestedUsers posts={posts} />

      <p className="px-2 text-xs text-mist-dim">
        Ritual Social · built on Ritual Chain. Every transaction can be verified on Ritual Explorer.
      </p>
    </aside>
  );
}
