import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import { fetchProfile } from './useProfile';
import { fetchCommentMetadata } from '@/lib/ipfs';
import { useCommentOnPost } from './useRitualSocial';
import type { CommentRecord } from '@/types';

export function useComments(postId: string) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async (): Promise<CommentRecord[]> => {
      const commentIds = (await publicClient!.readContract({
        address: ritualSocialContract.address,
        abi: ritualSocialContract.abi,
        functionName: 'commentIdsForPost',
        args: [BigInt(postId)],
      })) as bigint[];

      const records = await Promise.all(
        commentIds.map(async (commentId) => {
          const rawStruct = (await publicClient!.readContract({
            address: ritualSocialContract.address,
            abi: ritualSocialContract.abi,
            functionName: 'comments',
            args: [commentId],
          })) as unknown as [string, bigint, string, bigint];

          // (author, postId, contentURI, timestamp) — positional, see note in useProfile.ts
          const [author, , contentURI, timestamp] = rawStruct;

          const [profile, meta] = await Promise.all([
            fetchProfile(publicClient!, author as `0x${string}`),
            fetchCommentMetadata(contentURI).catch(() => ({ caption: '(failed to load)' }) as any),
          ]);

          const record: CommentRecord = {
            id: commentId.toString(),
            postId,
            author: profile,
            body: meta.caption,
            createdAt: Number(timestamp) * 1000,
            onChain: {
              txHash: '0x0' as `0x${string}`, // per-event tx hash requires log lookup; struct alone doesn't carry it
              blockNumber: 0,
              timestamp: Number(timestamp) * 1000,
              from: author as `0x${string}`,
              to: ritualSocialContract.address,
              status: 'success',
            },
          };
          return record;
        }),
      );

      return records.sort((a, b) => a.createdAt - b.createdAt);
    },
    enabled: !!publicClient && !!postId,
    staleTime: 10_000,
  });
}

export function usePostComment(postId: string) {
  const { comment, stage, reset } = useCommentOnPost();
  const queryClient = useQueryClient();
  const [contentURIPending, setContentURIPending] = useState<string | null>(null);

  const submit = useCallback(
    async (contentURI: string) => {
      setContentURIPending(contentURI);
      const result = await comment(BigInt(postId), contentURI);
      if (result?.status === 'success') {
        queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      }
      setContentURIPending(null);
      return result;
    },
    [comment, postId, queryClient],
  );

  return { submit, stage, reset, isUploading: contentURIPending !== null };
}
