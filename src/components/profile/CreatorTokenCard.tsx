import { useState } from 'react';
import { Coins, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useCreatorTokenForCreator, useCreatorToken, useCreateCreatorToken, useTradeCreatorToken, formatTokenAmount } from '@/hooks/useCreatorToken';
import { RITUAL_CREATOR_TOKEN_FACTORY_ADDRESS } from '@/config/constants';
import type { UserProfile } from '@/types';

export function CreatorTokenCard({ profile }: { profile: UserProfile }) {
  const { address: viewer } = useAccount();
  const isOwn = viewer?.toLowerCase() === profile.address.toLowerCase();
  const { data: tokenAddress } = useCreatorTokenForCreator(profile.address);
  const { data: token } = useCreatorToken(tokenAddress ?? undefined);
  const { createToken, pending: createPending } = useCreateCreatorToken();
  const { buy, sell, pending: tradePending } = useTradeCreatorToken(tokenAddress ?? undefined);
  const [amount, setAmount] = useState('0.01');
  const [tokenAmount, setTokenAmount] = useState('1');

  if (RITUAL_CREATOR_TOKEN_FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  if (!tokenAddress) {
    if (!isOwn) return null;
    return (
      <div className="rounded-2xl border border-ash-200 bg-ash-100/20 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-mist-light">
          <Coins size={16} className="text-ritual-400" /> Creator Token
        </div>
        <p className="mt-1 text-xs text-mist-dim">Launch your own bonding-curve social token. Fans buy/sell with RITUAL.</p>
        <button
          onClick={() => createToken(`${profile.displayName} Token`, `${profile.username.slice(0, 3).toUpperCase()}T`)}
          disabled={createPending}
          className="ritual-btn mt-3 w-full text-xs"
        >
          {createPending ? <Loader2 size={14} className="animate-spin" /> : 'Launch Token'}
        </button>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="rounded-2xl border border-ash-200 bg-ash-100/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-mist-light">
          <Coins size={16} className="text-ritual-400" /> {token.name} ({token.symbol})
        </div>
        <span className="text-xs text-mist-dim">Supply: {formatTokenAmount(token.totalSupply)}</span>
      </div>

      {token.balance !== undefined && token.balance > 0n && (
        <p className="mt-1 text-xs text-mist-dim">You hold: {formatTokenAmount(token.balance)} {token.symbol}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-mist-dim">Buy with RITUAL</label>
          <div className="flex items-center gap-1">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-ash-300 bg-void-200 px-2 py-1 text-xs text-mist-light focus:outline-none"
            />
            <button onClick={() => buy(amount)} disabled={tradePending} className="rounded-lg bg-ritual-500 px-2 py-1 text-xs text-white">
              <TrendingUp size={12} />
            </button>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-mist-dim">Sell {token.symbol}</label>
          <div className="flex items-center gap-1">
            <input
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              className="w-full rounded-lg border border-ash-300 bg-void-200 px-2 py-1 text-xs text-mist-light focus:outline-none"
            />
            <button onClick={() => sell(tokenAmount)} disabled={tradePending} className="rounded-lg bg-red-500 px-2 py-1 text-xs text-white">
              <TrendingDown size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
