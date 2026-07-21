import { useCallback, useState } from 'react';
import { parseEther } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { ritualSocialContract, ritualTreasuryContract } from '@/contracts';
import { ACTION_FEE_ETH } from '@/config/constants';
import toast from 'react-hot-toast';

export type TxStage = 'idle' | 'awaiting-wallet' | 'pending' | 'confirmed' | 'failed';

export interface TxResult {
  hash: `0x${string}`;
  blockNumber: bigint;
  status: 'success' | 'reverted';
}

const GAS_LIMITS: Record<string, bigint> = {
  createPost: 500_000n,
  editPost: 200_000n,
  deletePost: 150_000n,
  likePost: 250_000n,
  commentOnPost: 400_000n,
  editComment: 150_000n,
  deleteComment: 150_000n,
  likeComment: 200_000n,
  repost: 400_000n,
  follow: 200_000n,
  unfollow: 200_000n,
  updateProfile: 250_000n,
  tip: 150_000n,
};

function useRitualAction(functionName: string) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (args: unknown[]): Promise<TxResult | null> => {
      setError(null);
      try {
        setStage('awaiting-wallet');
        const hash = await writeContractAsync({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName,
          args,
          value: parseEther(ACTION_FEE_ETH),
          gas: GAS_LIMITS[functionName],
        });

        setStage('pending');
        toast.loading('Waiting for confirmation on Ritual Chain…', { id: hash });

        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
          setStage('confirmed');
          toast.success('Transaction confirmed on-chain', { id: hash });
        } else {
          setStage('failed');
          toast.error('Transaction reverted on-chain', { id: hash });
        }

        return { hash, blockNumber: receipt.blockNumber, status: receipt.status };
      } catch (err: any) {
        setStage('failed');
        const message = err?.shortMessage ?? err?.message ?? 'Transaction failed or rejected';
        setError(message);
        toast.error(message);
        return null;
      }
    },
    [writeContractAsync, publicClient, functionName],
  );

  return { send, stage, error, reset: () => setStage('idle') };
}

export function useCreatePost() {
  const action = useRitualAction('createPost');
  const createPost = (contentURI: string) => action.send([contentURI]);
  return { createPost, ...action };
}

function useFreeAction(functionName: 'editPost' | 'deletePost') {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (args: unknown[]) => {
      setPending(true);
      try {
        const hash = await writeContractAsync({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName,
          args,
          gas: GAS_LIMITS[functionName],
        });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') return true;
        toast.error('Transaction reverted');
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Transaction failed or rejected');
        return false;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient, functionName],
  );

  return { run, pending };
}

export function useEditPost() {
  const { run, pending } = useFreeAction('editPost');
  const editPost = (postId: bigint | number | string, newContentURI: string) => run([BigInt(postId), newContentURI]);
  return { editPost, pending };
}

export function useDeletePost() {
  const { run, pending } = useFreeAction('deletePost');
  const deletePost = (postId: bigint | number | string) => run([BigInt(postId)]);
  return { deletePost, pending };
}

export function useLikePost() {
  const action = useRitualAction('likePost');
  const likePost = (postId: bigint | number) => action.send([BigInt(postId)]);
  return { likePost, ...action };
}

export function useCommentOnPost() {
  const action = useRitualAction('commentOnPost');
  const comment = (postId: bigint | number, parentCommentId: bigint | number, contentURI: string) =>
    action.send([BigInt(postId), BigInt(parentCommentId), contentURI]);
  return { comment, ...action };
}

export function useRepost() {
  const action = useRitualAction('repost');
  const repost = (postId: bigint | number) => action.send([BigInt(postId)]);
  return { repost, ...action };
}

export function useFollowGraph() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address: viewer } = useAccount();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (functionName: 'follow' | 'unfollow', account: `0x${string}`) => {
      setPending(true);
      try {
        const hash = await writeContractAsync({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName,
          args: [account],
          gas: GAS_LIMITS[functionName],
        });
        toast.loading('Sending follow transaction…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success(functionName === 'follow' ? 'Followed successfully' : 'Unfollowed successfully', { id: hash });
          queryClient.invalidateQueries({ queryKey: ['isFollowing', viewer, account] });
          queryClient.invalidateQueries({ queryKey: ['profile', account] });
          queryClient.invalidateQueries({ queryKey: ['profile', viewer] });
          return true;
        }
        toast.error('Transaction reverted', { id: hash });
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Transaction failed or rejected');
        return false;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient, viewer, queryClient],
  );

  return {
    follow: (account: `0x${string}`) => run('follow', account),
    unfollow: (account: `0x${string}`) => run('unfollow', account),
    pending,
  };
}

export function useTipCreator() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [pending, setPending] = useState(false);

  const tip = useCallback(
    async (creator: `0x${string}`, amountEth: string) => {
      setPending(true);
      try {
        const hash = await writeContractAsync({
          address: ritualTreasuryContract.address,
          abi: ritualTreasuryContract.abi,
          functionName: 'tip',
          args: [creator],
          value: parseEther(amountEth),
          gas: GAS_LIMITS.tip,
        });
        toast.loading('Sending tip…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success('Tip sent on-chain 🎉', { id: hash });
          return { hash };
        }
        toast.error('Tip transaction reverted', { id: hash });
        return null;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Transaction failed or rejected');
        return null;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient],
  );

  return { tip, pending };
    }
