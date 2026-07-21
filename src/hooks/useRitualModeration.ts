import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { callRitualLLM, ensureRitualWalletFunded } from '@/lib/ritualLLM';

export type ModerationStage = 'idle' | 'funding' | 'selecting-executor' | 'awaiting-inference' | 'done' | 'error';

export interface RitualModerationResult {
  flagged: boolean;
  reason: string;
  errored?: boolean;
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
        toast.loading('Waiting for the TEE executor to settle on-chain — this can take up to ~100s…', {
          id: 'ritual-llm',
          duration: 8000,
        });
        const result = await callRitualLLM(publicClient, walletClient, address, SYSTEM_PROMPT, text);
        toast.dismiss('ritual-llm');

        if (result.hasError) {
          setStage('error');
          return { flagged: false, reason: result.errorMessage || 'unknown error', errored: true };
        }

        setStage('done');
        const verdict = result.content.trim();
        if (verdict.toUpperCase().startsWith('FLAGGED')) {
          return { flagged: true, reason: verdict.replace(/^FLAGGED:?\s*/i, '') || 'Flagged by Ritual AI moderation.' };
        }
        return { flagged: false, reason: '' };
      } catch (err: any) {
        setStage('error');
        const message = err?.shortMessage ?? err?.message ?? 'Ritual AI moderation failed';
        return { flagged: false, reason: message, errored: true };
      }
    },
    [publicClient, walletClient, address],
  );

  return { moderate, stage, reset: () => setStage('idle') };
}
