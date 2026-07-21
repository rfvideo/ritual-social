import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { callRitualLLM, ensureRitualWalletFunded } from '@/lib/ritualLLM';

export type ModerationStage = 'idle' | 'funding' | 'selecting-executor' | 'awaiting-inference' | 'done' | 'error';

export interface RitualModerationResult {
  flagged: boolean;
  reason: string;
}

const SYSTEM_PROMPT =
  'You moderate posts for a social app. Reply with exactly one line. ' +
  'If the text is safe, reply: SAFE. ' +
  'If it contains spam, scams, hate speech, harassment, or explicit content, reply: FLAGGED: <short reason>. ' +
  'Do not add any other text.';

export function useRitualModeration() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [stage, setStage] = useState<ModerationStage>('idle');

  const moderate = useCallback(
    async (text: string): Promise<RitualModerationResult | null> => {
      if (!publicClient || !walletClient || !address) {
        toast.error('Connect your wallet first.');
        return null;
      }
      if (!text.trim()) {
        return { flagged: false, reason: '' };
      }

      try {
        setStage('funding');
        await ensureRitualWalletFunded(publicClient, walletClient, address);

        setStage('selecting-executor');
        setStage('awaiting-inference');
        const result = await callRitualLLM(publicClient, walletClient, address, SYSTEM_PROMPT, text);

        if (result.hasError) {
          setStage('error');
          toast.error(`Ritual AI moderation failed: ${result.errorMessage || 'unknown error'}`);
          return null;
        }

        setStage('done');
        const verdict = result.content.trim();
        if (verdict.toUpperCase().startsWith('FLAGGED')) {
          return { flagged: true, reason: verdict.replace(/^FLAGGED:?\s*/i, '') || 'Flagged by Ritual AI moderation.' };
        }
        return { flagged: false, reason: '' };
      } catch (err: any) {
        setStage('error');
        toast.error(err?.shortMessage ?? err?.message ?? 'Ritual AI moderation failed');
        return null;
      }
    },
    [publicClient, walletClient, address],
  );

  return { moderate, stage, reset: () => setStage('idle') };
}
