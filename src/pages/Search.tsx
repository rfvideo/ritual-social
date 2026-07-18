import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Sparkles, Loader2 } from 'lucide-react';
import { useFeed } from '@/hooks/usePosts';
import { useSemanticSearch } from '@/hooks/useAI';
import { PostFeedList } from '@/components/post/PostFeedList';
import { TrendingList } from '@/components/explore/TrendingList';
import { SuggestedUsers } from '@/components/explore/SuggestedUsers';
import { extractHashtags } from '@/lib/utils';

const RECENT_KEY = 'ritual-social:recent-searches';

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function pushRecent(query: string) {
  const next = [query, ...getRecent().filter((q) => q !== query)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>([]);
  const { data: posts = [], isLoading, isError, refetch } = useFeed();
  const { run: aiSearch, loading: aiLoading, result: aiResult } = useSemanticSearch();

  useEffect(() => setRecent(getRecent()), []);
  useEffect(() => {
    if (initialQuery) handleSubmit(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
    setParams({ q: trimmed });
    setRecent(pushRecent(trimmed));
    aiSearch({ query: trimmed });
  }

  const localResults = useMemo(() => {
    if (!submitted) return [];
    const needle = submitted.toLowerCase().replace(/^#/, '');
    return posts.filter(
      (p) =>
        p.caption.toLowerCase().includes(needle) ||
        p.author.username.toLowerCase().includes(needle) ||
        p.author.displayName.toLowerCase().includes(needle) ||
        extractHashtags(p.caption).some((h) => h.toLowerCase() === needle),
    );
  }, [posts, submitted]);

  const aiResults = useMemo(() => {
    if (!aiResult?.output.postIds?.length) return null;
    const byId = new Map(posts.map((p) => [p.id, p]));
    return aiResult.output.postIds.map((id) => byId.get(id)).filter(Boolean) as typeof posts;
  }, [aiResult, posts]);

  const results = aiResults && aiResults.length > 0 ? aiResults : localResults;

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-ash-200 bg-void-100/90 px-4 py-3 backdrop-blur-xl">
        <div className="relative">
          <SearchIcon size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(query)}
            placeholder='Search in natural language: "posts about AI this week"'
            className="w-full rounded-full border border-ash-200 bg-ash-100/60 py-2.5 pl-10 pr-9 text-sm text-mist-light placeholder:text-mist-dim focus:border-ritual-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-dim hover:text-mist"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {aiLoading && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ritual-400">
            <Loader2 size={12} className="animate-spin" /> AI Ritual is understanding the context of your search…
          </p>
        )}
        {aiResult?.output.explanation && !aiLoading && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-mist-dim">
            <Sparkles size={12} className="text-ritual-400" /> {aiResult.output.explanation}
          </p>
        )}
      </div>

      {!submitted ? (
        <div className="space-y-6 p-4">
          {recent.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-mist-light">Recent Search</h2>
              <div className="flex flex-wrap gap-2">
                {recent.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setQuery(q);
                      handleSubmit(q);
                    }}
                    className="rounded-full border border-ash-300 px-3 py-1.5 text-xs text-mist hover:border-ritual-500 hover:text-ritual-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-mist-light">Trending Search</h2>
            <TrendingList posts={posts} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-mist-light">Suggested Users</h2>
            <SuggestedUsers posts={posts} />
          </section>
        </div>
      ) : (
        <PostFeedList
          posts={results}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          emptyTitle={`No results for "${submitted}"`}
          emptyDescription="Try different keywords or use natural language."
        />
      )}
    </div>
  );
}
