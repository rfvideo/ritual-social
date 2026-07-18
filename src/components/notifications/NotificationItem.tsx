import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Repeat2, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { formatRelativeTime } from '@/lib/utils';
import type { NotificationRecord } from '@/types';

const ICONS: Record<NotificationRecord['kind'], any> = {
  like: Heart,
  comment: MessageCircle,
  reply: MessageCircle,
  mention: MessageCircle,
  follow: UserPlus,
  repost: Repeat2,
};

const ICON_COLOR: Record<NotificationRecord['kind'], string> = {
  like: 'text-red-400',
  comment: 'text-ritual-400',
  reply: 'text-ritual-400',
  mention: 'text-ritual-400',
  follow: 'text-ritual-400',
  repost: 'text-emerald-400',
};

const VERB: Record<NotificationRecord['kind'], string> = {
  like: 'liked your post',
  comment: 'commented on your post',
  reply: 'replied to your comment',
  mention: 'mentioned you',
  follow: 'followed you',
  repost: 'reposted your post',
};

export function NotificationItem({ notification }: { notification: NotificationRecord }) {
  const Icon = ICONS[notification.kind];
  const content = (
    <div className="flex items-center gap-3 border-b border-ash-200 px-4 py-4 transition hover:bg-ash-100/20">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-ash-100 ${ICON_COLOR[notification.kind]}`}>
        <Icon size={16} fill={notification.kind === 'like' ? 'currentColor' : 'none'} />
      </div>
      <Avatar address={notification.actor.address} uri={notification.actor.avatarURI} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-mist-light">
          <span className="font-semibold">{notification.actor.displayName}</span>{' '}
          <span className="text-mist">{VERB[notification.kind]}</span>
        </p>
        <p className="text-xs text-mist-dim">{formatRelativeTime(notification.createdAt)}</p>
      </div>
    </div>
  );

  return notification.postId ? <Link to={`/post/${notification.postId}`}>{content}</Link> : content;
}
