import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient, useWriteContract, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import toast from 'react-hot-toast';
import { ritualSocialContract } from '@/contracts';
import { fetchProfile } from './useProfile';
import { fetchCommentMetadata } from '@/lib/ipfs';
import { chainTimestampToMs } from '@/lib/utils';
import { useCommentOnPost } from './useRitualSocial';
import { ACTION_FEE_ETH } from '@/config/constants';
import type { CommentRecord } from '@/types';

export function useComments(postId: string) {
  const publicClient = usePublicClient();
  const { address: viewer } = useAccount();

  return useQuery({
    queryKey: ['comments', postId, viewer],
    queryFn: async (): Promise<CommentRecord[]> => {
      const commentIds = (await publicClient!.readContract({
        address: ritualSocialContract.address,
        abi: ritualSocialContract.abi,
        functionName: 'commentIdsForPost',
        args: [BigInt(postId)],
      })) as bigint[];

      const profileCache = new Map<string, ReturnType<typeof fetchProfile>>();
      function cachedProfile(address: string) {
        const key = address.toLowerCase();
        if (!profileCache.has(key)) profileCache.set(key, fetchProfile(publicClient!, address as `0x${string}`));
        return profileCache.get(key)!;
      }

      const records = await Promise.all(
        commentIds.map(async (commentId) => {
          const rawStruct = (await publicClient!.readContract({
            address: ritualSocialContract.address,
            abi: ritualSocialContract.abi,
            functionName: 'comments',
            args: [commentId],
          })) as unknown as [string, bigint, bigint, string, bigint, bigint, bigint, boolean, boolean];

          const [author, , parentCommentId, contentURI, timestamp, likeCount, replyCount, exists] = rawStruct;
          if (!exists) return null;

          const [profile, meta, likedByMe] = await Promise.all([
            cachedProfile(author),
            fetchCommentMetadata(contentURI).catch(() => ({ caption: '(failed to load)' }) as any),
            viewer
              ? (publicClient!.readContract({
                  address: ritualSocialContract.address,
                  abi: ritualSocialContract.abi,
                  functionName: 'hasLikedComment',
                  args: [commentId, viewer],
                }) as Promise<boolean>)
              : Promise.resolve(false),
          ]);

          const record: CommentRecord = {
            id: commentId.toString(),
            postId,
            parentCommentId: parentCommentId.toString(),
            author: profile,
            body: meta.caption,
            createdAt: chainTimestampToMs(timestamp),
            likeCount: Number(likeCount),
            replyCount: Number(replyCount),
            likedByMe,
            edited: rawStruct[8],
            onChain: {
              txHash: '0x0' as `0x${string}`,
              blockNumber: 0,
              timestamp: chainTimestampToMs(timestamp),
              from: author as `0x${string}`,
              to: ritualSocialContract.address,
              status: 'success',
            },
          };
          return record;
        }),
      );

      return records.filter((r): r is CommentRecord => r !== null).sort((a, b) => a.createdAt - b.createdAt);
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
    async (contentURI: string, parentCommentId: string | number = 0) => {
      setContentURIPending(contentURI);
      const result = await comment(BigInt(postId), BigInt(parentCommentId), contentURI);
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

const COMMENT_GAS = 150_000n;

export function useLikeComment(postId: string) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const likeComment = useCallback(
    async (commentId: string) => {
      setPending(commentId);
      try {
        const hash = await writeContractAsync({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName: 'likeComment',
          args: [BigInt(commentId)],
          value: parseEther(ACTION_FEE_ETH),
          gas: COMMENT_GAS,
        });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          return true;
        }
        toast.error('Transaction reverted');
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Failed to like comment');
        return false;
      } finally {
        setPending(null);
      }
    },
    [writeContractAsync, publicClient, postId, queryClient],
  );

  return { likeComment, pendingCommentId: pending };
}

export function useEditComment(postId: string) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const editComment = useCallback(
    async (commentId: string, newContentURI: string) => {
      setPending(true);
      try {
        const hash = await writeContractAsync({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName: 'editComment',
          args: [BigInt(commentId), newContentURI],
          gas: COMMENT_GAS,
        });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success('Comment updated');
          queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          return true;
        }
        toast.error('Transaction reverted');
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Failed to edit comment');
        return false;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient, postId, queryClient],
  );

  return { editComment, pending };
}

export function useDeleteComment(postId: string) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const deleteComment = useCallback(
    async (commentId: string) => {
      setPending(true);
      try {
        const hash = await writeContractAsync({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName: 'deleteComment',
          args: [BigInt(commentId)],
          gas: COMMENT_GAS,
        });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success('Comment deleted');
          queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          return true;
        }
        toast.error('Transaction reverted');
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Failed to delete comment');
        return false;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient, postId, queryClient],
  );

  return { deleteComment, pending };
    }
