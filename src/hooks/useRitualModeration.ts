import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { callRitualLLM, ensureRitualWalletFunded } from '@/lib/ritualLLM';
import type { ModerationOutput } from '@/types';

export type ModerationStage = 'idle' | 'funding' | 'selecting-executor' | 'awaiting-inference' | 'done' | 'error';

export interface RitualModerationResult {
  flagged: boolean;
  reason: string;
  errored?: boolean;
  /** true when the on-chain path failed and we used the Infernet/local fallback */
  fallback?: boolean;
}

const SYSTEM_PROMPT =
  'You moderate posts for a social app. Reply with exactly one line. ' +
  'If the text is safe, reply: SAFE. ' +
  'If it contains spam, scams, hate speech, harassment, or explicit content, reply: FLAGGED: <short reason>. ' +
  'Do not add any other text.';

/** Call the Infernet ai-moderate Netlify function (has its own local heuristic fallback). */
async function callInfernetModerate(text: string): Promise<RitualModerationResult> {
  const res = await fetch('/.netlify/functions/ai-moderate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`ai-moderate returned ${res.status}`);
  const job = (await res.json()) as { output: ModerationOutput };
  return {
    flagged: job.output.flagged,
    reason: job.output.reason ?? '',
    fallback: true,
  };
}

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
          // On-chain executor unavailable — fall back to Infernet/local moderation.
          console.warn('[useRitualModeration] on-chain path errored, falling back to Infernet:', result.errorMessage);
          setStage('done');
          return await callInfernetModerate(text);
        }

        setStage('done');
        const verdict = result.content.trim();
        if (verdict.toUpperCase().startsWith('FLAGGED')) {
          return { flagged: true, reason: verdict.replace(/^FLAGGED:?\s*/i, '') || 'Flagged by Ritual AI moderation.' };
        }
        return { flagged: false, reason: '' };
      } catch (err: any) {
        toast.dismiss('ritual-llm');
        // On-chain path threw (executor selection failed, network error, etc.) — fall back.
        console.warn('[useRitualModeration] on-chain path threw, falling back to Infernet:', err?.message ?? err);
        try {
          setStage('done');
          return await callInfernetModerate(text);
        } catch (fallbackErr: any) {
          setStage('error');
          const message = fallbackErr?.message ?? 'AI moderation unavailable';
          return { flagged: false, reason: message, errored: true };
        }
      }
    },
    [publicClient, walletClient, address],
  );

  return { moderate, stage, reset: () => setStage('idle') };
}
