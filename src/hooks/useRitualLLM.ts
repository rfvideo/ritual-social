/**
 * useRitualLLM — generic hook for calling the Ritual Chain LLM precompile
 * (0x0000000000000000000000000000000000000802) from the browser.
 *
 * This is the on-chain path: the user's connected wallet signs and submits a
 * transaction to the precompile; a TEE executor on Ritual Chain settles it
 * asynchronously; the frontend polls the receipt until the result is decoded.
 *
 * Use this hook for any feature where:
 *   • you want an on-chain attestation / verifiable AI proof, OR
 *   • you want the inference to run on Ritual's decentralized compute network
 *     rather than a self-hosted Infernet container.
 *
 * For non-proof-critical features (translation, summarization without proof)
 * use the Netlify function path (useTranslate, useSummarize, etc. in useAI.ts)
 * which routes through the self-hosted Infernet containers.
 *
 * Usage:
 *   const { run, stage, reset } = useRitualLLM<MyOutput>({
 *     systemPrompt: '...',
 *     parseOutput: (raw) => myParse(raw),
 *   });
 *   const result = await run('user message here');
 */

import { useState, useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { callRitualLLM, ensureRitualWalletFunded } from '@/lib/ritualLLM';

// ── types ─────────────────────────────────────────────────────────────────────

export type RitualLLMStage =
  | 'idle'
  | 'funding'          // ensuring RitualWallet has enough balance
  | 'selecting-executor' // picking an active TEE from TEEServiceRegistry
  | 'awaiting-inference' // tx submitted, polling for settlement
  | 'done'
  | 'error';

export interface RitualLLMResult<T> {
  /** Parsed, typed output from the model. null if errored. */
  output: T | null;
  /** Raw text returned by the model, before parsing. */
  raw: string;
  hasError: boolean;
  errorMessage: string;
}

export interface UseRitualLLMOptions<T> {
  /**
   * System prompt sent to the model (GLM-4.7-FP8 on Ritual Chain).
   * Keep it concise — it counts against your token budget.
   */
  systemPrompt: string;
  /**
   * Transform the raw model output string into your typed result.
   * Called only when hasError is false. Throw to signal a parse failure.
   */
  parseOutput: (raw: string) => T;
  /**
   * Minimum RitualWallet balance in wei before submitting the precompile call.
   * Defaults to 0.4 RITUAL (~$0.04 at testnet prices).
   */
  minBalanceWei?: bigint;
  /**
   * Amount deposited to RitualWallet if balance is below minBalanceWei.
   * Defaults to 0.5 RITUAL.
   */
  depositWei?: bigint;
}

// ── hook ─────────────────────────────────────────────────────────────────────

export function useRitualLLM<T>(options: UseRitualLLMOptions<T>) {
  const { systemPrompt, parseOutput, minBalanceWei, depositWei } = options;

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const [stage, setStage] = useState<RitualLLMStage>('idle');
  const [result, setResult] = useState<RitualLLMResult<T> | null>(null);

  const run = useCallback(
    async (userPrompt: string): Promise<RitualLLMResult<T> | null> => {
      if (!publicClient || !walletClient || !address) {
        toast.error('Connect your wallet to use Ritual AI inference.');
        return null;
      }
      if (!userPrompt.trim()) {
        return { output: null, raw: '', hasError: true, errorMessage: 'Empty prompt.' };
      }

      setResult(null);

      try {
        // 1. Ensure the user's RitualWallet has enough balance for the call.
        setStage('funding');
        await ensureRitualWalletFunded(
          publicClient,
          walletClient,
          address,
          minBalanceWei,
          depositWei,
        );

        // 2. Submit the precompile transaction and wait for TEE settlement.
        setStage('selecting-executor');
        setStage('awaiting-inference');

        const toastId = 'ritual-llm-inference';
        toast.loading('Waiting for Ritual TEE executor to settle on-chain (up to ~100s)…', {
          id: toastId,
          duration: 10_000,
        });

        const llmResult = await callRitualLLM(
          publicClient,
          walletClient,
          address,
          systemPrompt,
          userPrompt,
        );

        toast.dismiss(toastId);

        if (llmResult.hasError) {
          setStage('error');
          const r: RitualLLMResult<T> = {
            output: null,
            raw: '',
            hasError: true,
            errorMessage: llmResult.errorMessage || 'Ritual LLM inference failed.',
          };
          setResult(r);
          return r;
        }

        // 3. Parse the raw model output into the caller's type.
        let parsed: T | null = null;
        let parseError = '';
        try {
          parsed = parseOutput(llmResult.content);
        } catch (err: any) {
          parseError = err?.message ?? 'Failed to parse model output.';
        }

        setStage('done');
        const r: RitualLLMResult<T> = {
          output: parsed,
          raw: llmResult.content,
          hasError: Boolean(parseError),
          errorMessage: parseError,
        };
        setResult(r);
        return r;
      } catch (err: any) {
        toast.dismiss('ritual-llm-inference');
        setStage('error');
        const message = err?.shortMessage ?? err?.message ?? 'Ritual LLM request failed.';
        const r: RitualLLMResult<T> = { output: null, raw: '', hasError: true, errorMessage: message };
        setResult(r);
        return r;
      }
    },
    [publicClient, walletClient, address, systemPrompt, parseOutput, minBalanceWei, depositWei],
  );

  const reset = useCallback(() => {
    setStage('idle');
    setResult(null);
  }, []);

  return { run, stage, result, reset };
}

// ── ready-made hooks for common on-chain AI features ─────────────────────────

/**
 * On-chain translation with TEE attestation.
 * Result carries `{ sourceLanguage, targetLanguage, translatedText }`.
 *
 * Prefer useTranslate() from useAI.ts if you don't need an on-chain proof.
 */
export function useRitualTranslate() {
  return useRitualLLM<{ sourceLanguage: string; targetLanguage: string; translatedText: string }>({
    systemPrompt:
      'You are a translation engine. Reply with ONLY the translated text in the target language. ' +
      'Detect the source language automatically. Do not add explanations, quotes, or labels.',
    parseOutput: (raw) => ({
      sourceLanguage: 'auto',
      targetLanguage: 'unknown',
      translatedText: raw.trim(),
    }),
  });
}

/**
 * On-chain thread summarization with TEE attestation.
 * Result carries `{ summary, keyPoints }`.
 *
 * Prefer useSummarize() from useAI.ts if you don't need an on-chain proof.
 */
export function useRitualSummarize() {
  return useRitualLLM<{ summary: string; keyPoints: string[] }>({
    systemPrompt:
      'You are a concise summarizer for a social media thread. ' +
      'Reply with a JSON object: { "summary": "<2–4 sentence summary>", "keyPoints": ["<point1>", "<point2>", "…"] }. ' +
      'No markdown, no wrapping text — raw JSON only.',
    parseOutput: (raw) => {
      const json = raw.trim().replace(/^```json?\s*/i, '').replace(/```$/, '');
      const parsed = JSON.parse(json);
      return {
        summary: String(parsed.summary ?? ''),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map(String)
          : [],
      };
    },
  });
}

/**
 * On-chain term explanation with TEE attestation.
 * Result carries `{ term, explanation }`.
 *
 * Prefer useExplainTerm() from useAI.ts if you don't need an on-chain proof.
 */
export function useRitualExplain() {
  return useRitualLLM<{ term: string; explanation: string }>({
    systemPrompt:
      'You explain blockchain and AI concepts for a general audience. ' +
      'Reply with a JSON object: { "term": "<exact term>", "explanation": "<1–2 sentence plain-language explanation>" }. ' +
      'No markdown, no wrapping text — raw JSON only.',
    parseOutput: (raw) => {
      const json = raw.trim().replace(/^```json?\s*/i, '').replace(/```$/, '');
      const parsed = JSON.parse(json);
      return {
        term: String(parsed.term ?? ''),
        explanation: String(parsed.explanation ?? ''),
      };
    },
  });
}
