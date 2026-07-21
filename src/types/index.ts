export interface OnChainMeta {
  txHash: `0x${string}`;
  blockNumber: number;
  timestamp: number;
  from: `0x${string}`;
  to: `0x${string}`;
  status: 'success' | 'reverted';
}

export interface ProfileMetadata {
  displayName: string;
  username: string;
  bio: string;
  website?: string;
  location?: string;
  avatarURI?: string;
  bannerURI?: string;
}

export interface UserProfile extends ProfileMetadata {
  address: `0x${string}`;
  joinedAt: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
}

export interface PostRecord {
  id: string;
  author: UserProfile;
  images: string[];
  caption: string;
  createdAt: number;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount: number;
  isRepost: boolean;
  originalPostId?: string;
  edited?: boolean;
  onChain: OnChainMeta;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  detectedLanguage?: string;
}

export interface CommentRecord {
  id: string;
  postId: string;
  parentCommentId: string;
  author: UserProfile;
  body: string;
  createdAt: number;
  likeCount: number;
  replyCount: number;
  likedByMe?: boolean;
  edited: boolean;
  onChain: OnChainMeta;
}

export type NotificationKind = 'like' | 'comment' | 'reply' | 'mention' | 'follow' | 'repost';

export interface NotificationRecord {
  id: string;
  kind: NotificationKind;
  actor: UserProfile;
  postId?: string;
  commentText?: string;
  createdAt: number;
  read: boolean;
}

export interface InfernetJobResult<T> {
  jobId: string;
  status: 'completed' | 'failed' | 'pending';
  model: string;
  output: T;
  proof?: {
    type: 'tee-attestation' | 'zk-proof' | 'none';
    attestation?: string;
    verifiedAt?: number;
  };
  latencyMs: number;
}

export interface TranslationOutput {
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
}

export interface ModerationOutput {
  flagged: boolean;
  categories: Array<'spam' | 'scam' | 'phishing' | 'toxic' | 'nsfw'>;
  reason?: string;
}

export interface CaptionOutput {
  caption: string;
  hashtags: string[];
}

export interface SummaryOutput {
  summary: string;
  keyPoints: string[];
}

export interface ExplainOutput {
  term: string;
  explanation: string;
}
