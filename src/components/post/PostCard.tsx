import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Repeat2 } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { WalletBadge } from '@/components/wallet/WalletBadge';
import { ExplorerLink } from '@/components/common/ExplorerLink';
import { AIExplainTerms } from '@/components/ai/AIExplainTerms';
import { PostActions } from './PostActions';
import { resolveIpfsUri } from '@/lib/ipfs';
import { formatRelativeTime, tokenizeCaption } from '@/lib/utils';
import type { PostRecord } from '@/types';

function CaptionText({ text }: { text: string }) {
  const segments = tokenizeCaption(text);
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-mist-light">
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <Link
            key={i}
            to={seg.type === 'hashtag' ? `/search?q=${encodeURIComponent(seg.value)}` : `/profile/${seg.value}`}
            className="text-ritual-400 hover:underline"
          >
            {seg.value}
          </Link>
        ),
      )}
    </p>
  );
}

function ImageGrid({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  const cols = images.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  return (
    <div className={`mt-3 grid ${cols} gap-1 overflow-hidden rounded-2xl border border-ash-200`}>
      {images.slice(0, 4).map((uri, i) => (
        <img
          key={i}
          src={resolveIpfsUri(uri)}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover ${images.length === 3 && i === 0 ? 'row-span-2' : ''}`}
          style={{ aspectRatio: images.length === 1 ? '16/10' : '1/1' }}
        />
      ))}
    </div>
  );
}

export function PostCard({ post }: { post: PostRecord }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="border-b border-ash-200 px-4 py-4 transition-colors hover:bg-ash-100/20"
    >
      {post.isRepost && (
        <div className="mb-2 flex items-center gap-1.5 pl-11 text-xs text-mist-dim">
          <Repeat2 size={13} /> Reposted
        </div>
      )}

      <div className="flex gap-3">
        <Link to={`/profile/${post.author.address}`}>
          <Avatar address={post.author.address} uri={post.author.avatarURI} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link to={`/profile/${post.author.address}`} className="font-semibold text-mist-light hover:underline">
              {post.author.displayName}
            </Link>
            <span className="text-sm text-mist-dim">@{post.author.username}</span>
            <WalletBadge address={post.author.address} />
            <span className="text-mist-dim">·</span>
            <span className="text-sm text-mist-dim">{formatRelativeTime(post.createdAt)}</span>
          </div>

          <Link to={`/post/${post.id}`}>
            <div className="mt-1">
              <CaptionText text={post.caption} />
            </div>
          </Link>

          <AIExplainTerms text={post.caption} />

          <ImageGrid images={post.images} />

          <PostActions post={post} />

          <div className="mt-2">
            <ExplorerLink txHash={post.onChain.txHash} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
