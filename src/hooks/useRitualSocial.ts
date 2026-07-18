import { useCallback, useState } from 'react';
import { parseEther } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
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
  createPost: 350_000n,
  likePost: 150_000n,
  commentOnPost: 300_000n,
  repost: 300_000n,
  follow: 150_000n,
  unfollow: 150_000n,
  updateProfile: 200_000n,
  tip: 100_000n,
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
          type: 'legacy',
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

export function useLikePost() {
  const action = useRitualAction('likePost');
  const likePost = (postId: bigint | number) => action.send([BigInt(postId)]);
  return { likePost, ...action };
}

export function useCommentOnPost() {
  const action = useRitualAction('commentOnPost');
  const comment = (postId: bigint | number, contentURI: string) => action.send([BigInt(postId), contentURI]);
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
          type: 'legacy',
          gas: GAS_LIMITS[functionName],
        });
        toast.loading('Sending follow transaction…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success(functionName === 'follow' ? 'Followed successfully' : 'Unfollowed successfully', { id: hash });
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
    [writeContractAsync, publicClient],
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
          type: 'legacy',
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
