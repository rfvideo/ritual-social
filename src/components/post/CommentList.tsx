import { Link } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { WalletBadge } from '@/components/wallet/WalletBadge';
import { TranslateButton } from '@/components/ai/TranslateButton';
import { SkeletonPost } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/States';
import { useComments } from '@/hooks/useComments';
import { useSummarize } from '@/hooks/useAI';
import { formatRelativeTime } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';

export function CommentList({ postId }: { postId: string }) {
  const { data: comments, isLoading, isError } = useComments(postId);
  const { run: summarize, loading: summarizing, result: summary } = useSummarize();

  const showSummaryCta = (comments?.length ?? 0) >= 6 && !summary;

  return (
    <div>
      {showSummaryCta && (
        <div className="border-b border-ash-200 px-4 py-3">
          <button
            onClick={() => summarize({ threadText: comments!.map((c) => c.body).join(' ') })}
            disabled={summarizing}
            className="flex items-center gap-1.5 text-sm text-ritual-400 hover:text-ritual-300"
          >
            {summarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Ringkas dengan AI
          </button>
        </div>
      )}

      {summary && (
        <div className="border-b border-ash-200 bg-ritual-900/20 px-4 py-3">
          <p className="text-sm text-mist-light">{summary.output.summary}</p>
        </div>
      )}

      {isLoading && (
        <>
          <SkeletonPost />
          <SkeletonPost />
        </>
      )}

      {isError && <EmptyState title="Gagal memuat komentar" icon={<MessageCircle size={20} />} />}

      {!isLoading && comments?.length === 0 && (
        <EmptyState title="Belum ada komentar" description="Jadilah yang pertama membalas." icon={<MessageCircle size={20} />} />
      )}

      {comments?.map((c) => (
        <div key={c.id} className="flex gap-3 border-b border-ash-200 px-4 py-4 animate-riseIn">
          <Link to={`/profile/${c.author.address}`}>
            <Avatar address={c.author.address} uri={c.author.avatarURI} size="sm" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link to={`/profile/${c.author.address}`} className="text-sm font-semibold text-mist-light hover:underline">
                {c.author.displayName}
              </Link>
              <WalletBadge address={c.author.address} />
              <span className="text-xs text-mist-dim">· {formatRelativeTime(c.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-sm text-mist-light">{c.body}</p>
            <div className="mt-1">
              <TranslateButton text={c.body} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
