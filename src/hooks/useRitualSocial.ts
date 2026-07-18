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

/**
 * Wraps a single fee-gated write call to RitualSocial with the full
 * lifecycle the spec requires: wallet confirmation → real broadcast →
 * wait for receipt → only then treat the action as applied.
 * Nothing here is simulated — a reverted or rejected tx yields no
 * optimistic state change upstream.
 */
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
        });

        setStage('pending');
        toast.loading('Menunggu konfirmasi di Ritual Chain…', { id: hash });

        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
          setStage('confirmed');
          toast.success('Transaksi terkonfirmasi on-chain', { id: hash });
        } else {
          setStage('failed');
          toast.error('Transaksi revert di chain', { id: hash });
        }

        return { hash, blockNumber: receipt.blockNumber, status: receipt.status };
      } catch (err: any) {
        setStage('failed');
        const message = err?.shortMessage ?? err?.message ?? 'Transaksi gagal atau ditolak';
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

/** Follow / unfollow are free (no action fee) per spec — separate from useRitualAction. */
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
        });
        toast.loading('Mengirim transaksi follow…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success(functionName === 'follow' ? 'Berhasil follow' : 'Berhasil unfollow', { id: hash });
          return true;
        }
        toast.error('Transaksi revert', { id: hash });
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Transaksi gagal atau ditolak');
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
        });
        toast.loading('Mengirim tip…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success('Tip terkirim on-chain 🎉', { id: hash });
          return { hash };
        }
        toast.error('Transaksi tip revert', { id: hash });
        return null;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Transaksi gagal atau ditolak');
        return null;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient],
  );

  return { tip, pending };
}
