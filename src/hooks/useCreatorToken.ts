import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient, useWalletClient, useAccount, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import {
  ritualCreatorTokenFactoryContract,
  ritualCreatorTokenContract,
} from '@/contracts';
import toast from 'react-hot-toast';
import type { CreatorTokenRecord } from '@/types';

export function useCreatorTokenForCreator(creator?: `0x${string}`) {
  const publicClient = usePublicClient();
  return useQuery({
    queryKey: ['creatorToken', creator],
    queryFn: async () => {
      const address = (await publicClient!.readContract({
        address: ritualCreatorTokenFactoryContract.address,
        abi: ritualCreatorTokenFactoryContract.abi,
        functionName: 'getToken',
        args: [creator!],
      })) as `0x${string}`;
      return address === '0x0000000000000000000000000000000000000000' ? null : address;
    },
    enabled: !!publicClient && !!creator && ritualCreatorTokenFactoryContract.address !== '0x0000000000000000000000000000000000000000',
    staleTime: 30_000,
  });
}

export async function fetchCreatorToken(
  publicClient: any,
  tokenAddress: `0x${string}`,
  viewer?: `0x${string}`,
): Promise<CreatorTokenRecord> {
  const contract = ritualCreatorTokenContract(tokenAddress);
  const [name, symbol, totalSupply, creator, balance] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: 'name' }) as Promise<string>,
    publicClient.readContract({ ...contract, functionName: 'symbol' }) as Promise<string>,
    publicClient.readContract({ ...contract, functionName: 'totalSupply' }) as Promise<bigint>,
    publicClient.readContract({ ...contract, functionName: 'creator' }) as Promise<`0x${string}`>,
    viewer
      ? (publicClient.readContract({ ...contract, functionName: 'balanceOf', args: [viewer] }) as Promise<bigint>)
      : Promise.resolve(0n),
  ]);

  return {
    address: tokenAddress,
    creator,
    name,
    symbol,
    totalSupply,
    balance,
  };
}

export function useCreatorToken(tokenAddress?: `0x${string}`) {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ['creatorTokenDetails', tokenAddress, address],
    queryFn: () => fetchCreatorToken(publicClient!, tokenAddress!, address),
    enabled: !!publicClient && !!tokenAddress,
    staleTime: 15_000,
  });
}

export function useCreateCreatorToken() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const createToken = useCallback(
    async (name: string, symbol: string) => {
      if (!address) return null;
      setPending(true);
      try {
        const hash = await writeContractAsync({
          address: ritualCreatorTokenFactoryContract.address,
          abi: ritualCreatorTokenFactoryContract.abi,
          functionName: 'createToken',
          args: [name, symbol],
          gas: 2_000_000n,
        });
        toast.loading('Deploying creator token…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success('Creator token deployed!', { id: hash });
          queryClient.invalidateQueries({ queryKey: ['creatorToken', address] });
          return true;
        }
        toast.error('Token deployment reverted', { id: hash });
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Token deployment failed');
        return false;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient, address, queryClient],
  );

  return { createToken, pending };
}

export function useTradeCreatorToken(tokenAddress?: `0x${string}`) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const buy = useCallback(
    async (ethAmount: string, minAmountOut = 0n) => {
      if (!tokenAddress || !address) return false;
      setPending(true);
      try {
        const value = parseEther(ethAmount);
        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: ritualCreatorTokenContract(tokenAddress).abi,
          functionName: 'buy',
          args: [minAmountOut],
          value,
          gas: 500_000n,
        });
        toast.loading('Buying creator tokens…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success(`Bought tokens`, { id: hash });
          queryClient.invalidateQueries({ queryKey: ['creatorTokenDetails', tokenAddress, address] });
          return true;
        }
        toast.error('Buy reverted', { id: hash });
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Buy failed');
        return false;
      } finally {
        setPending(false);
      }
    },
    [tokenAddress, address, writeContractAsync, publicClient, queryClient],
  );

  const sell = useCallback(
    async (tokenAmount: string, minRefund = 0n) => {
      if (!tokenAddress || !address) return false;
      setPending(true);
      try {
        const amount = parseEther(tokenAmount);
        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: ritualCreatorTokenContract(tokenAddress).abi,
          functionName: 'sell',
          args: [amount, minRefund],
          gas: 500_000n,
        });
        toast.loading('Selling creator tokens…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success(`Sold tokens for RITUAL`, { id: hash });
          queryClient.invalidateQueries({ queryKey: ['creatorTokenDetails', tokenAddress, address] });
          return true;
        }
        toast.error('Sell reverted', { id: hash });
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Sell failed');
        return false;
      } finally {
        setPending(false);
      }
    },
    [tokenAddress, address, writeContractAsync, publicClient, queryClient],
  );

  return { buy, sell, pending };
}

export function formatTokenAmount(value: bigint): string {
  try {
    return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return '0';
  }
}
