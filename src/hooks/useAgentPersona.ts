import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { callRitualLLM, ensureRitualWalletFunded } from '@/lib/ritualLLM';
import { fetchProfile } from './useProfile';
import type { ProfileMetadata } from '@/types';
import toast from 'react-hot-toast';

const PERSONA_SYSTEM_PROMPT =
  'You are an AI persona engine for a social app. ' +
  'Given a user profile and a request, reply with a short, authentic-sounding post or reply ' +
  'in the user\'s voice. Do not explain yourself. Keep it under 280 characters. ' +
  'If the request is a reply to a post, make it relevant to the topic.';

export function useAgentPersona(address?: `0x${string}`) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: me } = useAccount();
  const [stage, setStage] = useState<'idle' | 'funding' | 'inference' | 'done' | 'error'>('idle');
  const [draft, setDraft] = useState<string | null>(null);

  const generate = useCallback(
    async (context: { postCaption?: string; replyTo?: string }) => {
      if (!publicClient || !walletClient || !me) {
        toast.error('Connect your wallet first.');
        return null;
      }

      setStage('funding');
      try {
        await ensureRitualWalletFunded(publicClient, walletClient, me);
      } catch (err: any) {
        setStage('error');
        toast.error(err?.message ?? 'Funding failed');
        return null;
      }

      const profile = address ? await fetchProfile(publicClient, address) : null;
      const userPrompt = `User: ${profile?.displayName ?? 'Anonymous'} (@${profile?.username ?? 'unknown'}). Bio: ${profile?.bio || 'none'}. Persona: ${profile?.agentPersona || 'none'}.\n` +
        (context.postCaption ? `Post to reply to: """${context.postCaption}"""\n` : 'Draft a new short post.\n');

      setStage('inference');
      toast.loading('Ritual AI agent is drafting…', { id: 'agent-persona', duration: 8000 });
      const result = await callRitualLLM(
        publicClient,
        walletClient,
        me,
        PERSONA_SYSTEM_PROMPT,
        userPrompt,
      );
      toast.dismiss('agent-persona');

      if (result.hasError) {
        setStage('error');
        toast.error(`Agent failed: ${result.errorMessage}`);
        return null;
      }

      setStage('done');
      const clean = result.content.trim().replace(/^["']|["']$/g, '').slice(0, 400);
      setDraft(clean);
      return clean;
    },
    [publicClient, walletClient, me, address],
  );

  const reset = useCallback(() => {
    setStage('idle');
    setDraft(null);
  }, []);

  return { generate, draft, stage, reset };
}

export function useAgentPersonaEdit() {
  const [persona, setPersona] = useState('');
  const { data: profile } = useProfileQueryForPersona();

  // Persona is stored as part of the profile metadata URI, so editing the profile
  // updates the persona. We expose a helper that merges the new persona into
  // the existing metadata.
  return { persona, setPersona, existingProfile: profile };
}

function useProfileQueryForPersona() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  return useQuery({
    queryKey: ['profile', address],
    queryFn: () => fetchProfile(publicClient!, address!),
    enabled: !!publicClient && !!address,
    staleTime: 30_000,
  });
}
