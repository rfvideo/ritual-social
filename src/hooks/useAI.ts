import { useCallback, useState } from 'react';
import type {
  CaptionOutput,
  ExplainOutput,
  InfernetJobResult,
  ModerationOutput,
  SummaryOutput,
  TranslationOutput,
} from '@/types';

type Endpoint =
  | 'ai-translate'
  | 'ai-caption'
  | 'ai-moderate'
  | 'ai-summarize'
  | 'ai-explain'
  | 'ai-search'
  | 'ai-recommend';

async function callAI<T>(endpoint: Endpoint, payload: unknown): Promise<InfernetJobResult<T>> {
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `AI request failed (${res.status})`);
  }
  return res.json();
}

/** Generic loading/error wrapper shared by every AI feature button. */
function useAICall<TInput, TOutput>(endpoint: Endpoint) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InfernetJobResult<TOutput> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (payload: TInput) => {
      setLoading(true);
      setError(null);
      try {
        const job = await callAI<TOutput>(endpoint, payload);
        setResult(job);
        return job;
      } catch (err: any) {
        setError(err.message ?? 'AI request failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [endpoint],
  );

  return { run, loading, result, error };
}

export const useTranslate = () =>
  useAICall<{ text: string; targetLanguage: string }, TranslationOutput>('ai-translate');

export const useAICaption = () => useAICall<{ imageURIs: string[] }, CaptionOutput>('ai-caption');

export const useModeration = () =>
  useAICall<{ text: string; imageURIs?: string[] }, ModerationOutput>('ai-moderate');

export const useSummarize = () => useAICall<{ threadText: string }, SummaryOutput>('ai-summarize');

export const useExplainTerm = () => useAICall<{ term: string }, ExplainOutput>('ai-explain');

export const useSemanticSearch = () =>
  useAICall<{ query: string }, { postIds: string[]; explanation: string }>('ai-search');

export const useFeedRecommendation = () =>
  useAICall<{ address: string; candidatePostIds: string[] }, { rankedPostIds: string[] }>('ai-recommend');
